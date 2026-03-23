import { GoogleGenAI } from "@google/genai";
import type { SourceFile } from "../types";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Characters per chunk (~800 tokens). Keeps each packet well inside model limits. */
const CHUNK_SIZE_CHARS = 3200;

/** Max chars to feed into the final synthesis prompt. */
const SYNTHESIS_BUDGET_CHARS = 12_000;

/** Similarity threshold — chunks below this score are dropped before synthesis. */
const MIN_RELEVANCE_SCORE = 0.25;

/** How many top chunks to forward to the validation step. */
const TOP_K_CHUNKS = 8;

/** Max parallel validate calls (avoids flooding the API). */
const MAX_PARALLEL_VALIDATE = 4;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Chunk {
  text: string;
  embedding?: number[];
  sourceName: string;
}

interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

interface PacketAnswer {
  packetIndex: number;
  sourceName: string;
  answer: string;
  relevant: boolean;
}

// ─── Embedding cache ────────────────────────────────────────────────────────────

const embedCache = new Map<string, number[]>();

// ─── Cosine similarity ──────────────────────────────────────────────────────────

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Text chunking ──────────────────────────────────────────────────────────────

/**
 * Splits text into overlapping paragraph-aware chunks.
 * Last paragraph of each chunk is reused as the seed of the next chunk
 * to preserve cross-boundary context.
 */
export function chunkText(text: string, chunkSizeChars = CHUNK_SIZE_CHARS): string[] {
  const chunks: string[] = [];
  let current = "";
  let lastPara = "";

  for (const p of text.split(/\n\s*\n/)) {
    const para = p.trim();
    if (!para) continue;

    if (current.length + para.length > chunkSizeChars && current.length > 0) {
      chunks.push(current.trim());
      current = lastPara + "\n\n" + para + "\n\n"; // overlap: seed next chunk
    } else {
      current += para + "\n\n";
    }
    lastPara = para;
  }

  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

// ─── Embeddings ─────────────────────────────────────────────────────────────────

export async function getEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const ai = new GoogleGenAI({ apiKey });
  const results: number[][] = [];

  for (const txt of texts) {
    if (embedCache.has(txt)) { results.push(embedCache.get(txt)!); continue; }
    try {
      const res = await ai.models.embedContent({ model: "text-embedding-004", contents: txt });
      const vec = res.embeddings?.[0]?.values || [];
      embedCache.set(txt, vec);
      results.push(vec);
    } catch (e) {
      console.warn("Embed failed:", e);
      results.push([]);
    }
  }
  return results;
}

// ─── Index builder ──────────────────────────────────────────────────────────────

export async function buildLocalIndex(sources: SourceFile[], apiKey: string): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];

  for (const source of sources) {
    const isText = source.type.startsWith("text/") || source.name.match(/\.(md|txt|csv)$/);
    if (!isText) continue;
    for (const t of chunkText(source.content)) {
      allChunks.push({ text: t, sourceName: source.name });
    }
  }

  if (allChunks.length > 0 && apiKey) {
    const embeddings = await getEmbeddings(allChunks.map(c => c.text), apiKey);
    allChunks.forEach((c, i) => { c.embedding = embeddings[i]; });
  }

  return allChunks;
}

// ─── Step 1: Vector retrieve top-K chunks ───────────────────────────────────────

async function retrieveTopChunks(
  query: string,
  index: Chunk[],
  apiKey: string,
): Promise<ScoredChunk[]> {
  const ai = new GoogleGenAI({ apiKey });
  let queryVec: number[] | undefined;

  try {
    const res = await ai.models.embedContent({ model: "text-embedding-004", contents: query });
    queryVec = res.embeddings?.[0]?.values;
  } catch (e) { console.warn("Query embed failed:", e); }

  if (!queryVec) return [];

  return index
    .map(chunk => ({
      chunk,
      score: chunk.embedding ? cosineSimilarity(queryVec!, chunk.embedding) : 0,
    }))
    .filter(s => s.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K_CHUNKS);
}

// ─── Step 2: MAP — validate each packet independently ──────────────────────────

async function validatePackets(
  query: string,
  chunks: ScoredChunk[],
  apiKey: string,
): Promise<PacketAnswer[]> {
  const ai = new GoogleGenAI({ apiKey });

  const validateOne = async (sc: ScoredChunk, idx: number): Promise<PacketAnswer> => {
    const prompt =
      `You are a knowledge extraction assistant.\n` +
      `USER QUERY: "${query}"\n\n` +
      `PACKET (from "${sc.chunk.sourceName}"):\n"""\n${sc.chunk.text}\n"""\n\n` +
      `Does this packet contain information relevant to the query?\n` +
      `- If YES: reply with RELEVANT: followed by a concise bullet-point summary of only the relevant facts (max 200 words).\n` +
      `- If NO: reply with exactly: IRRELEVANT\n` +
      `No other text.`;

    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      const text = res.text?.trim() ?? "IRRELEVANT";
      const relevant = text.toUpperCase().startsWith("RELEVANT:");
      return {
        packetIndex: idx,
        sourceName: sc.chunk.sourceName,
        answer: relevant ? text.replace(/^RELEVANT:\s*/i, "").trim() : "",
        relevant,
      };
    } catch (e) {
      console.warn(`Packet ${idx} validation failed:`, e);
      return { packetIndex: idx, sourceName: sc.chunk.sourceName, answer: "", relevant: false };
    }
  };

  // Capped-parallel batches to avoid API rate limits
  const results: PacketAnswer[] = [];
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_VALIDATE) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_VALIDATE);
    const batchResults = await Promise.all(batch.map((sc, j) => validateOne(sc, i + j)));
    results.push(...batchResults);
  }

  return results;
}

// ─── Step 3: REDUCE — combine packet answers into one context string ────────────

function combinePacketAnswers(packets: PacketAnswer[]): string {
  const relevant = packets.filter(p => p.relevant && p.answer.trim().length > 0);
  if (relevant.length === 0) return "";

  // Group by source file
  const bySource = new Map<string, string[]>();
  for (const p of relevant) {
    if (!bySource.has(p.sourceName)) bySource.set(p.sourceName, []);
    bySource.get(p.sourceName)!.push(p.answer);
  }

  let combined =
    `\n\n--- KNOWLEDGE SOURCES` +
    ` (Map-Reduce RAG · ${relevant.length} relevant packet${relevant.length !== 1 ? "s" : ""}` +
    ` from ${bySource.size} file${bySource.size !== 1 ? "s" : ""}) ---\n`;

  for (const [source, answers] of bySource) {
    combined += `\n[Source: ${source}]\n${answers.join("\n")}\n`;
  }

  // Hard cap — protect final synthesis prompt token budget
  if (combined.length > SYNTHESIS_BUDGET_CHARS) {
    combined = combined.slice(0, SYNTHESIS_BUDGET_CHARS) + "\n... [truncated for context budget]\n";
  }

  combined += `\n--- END KNOWLEDGE SOURCES ---\n\n`;
  return combined;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Map-Reduce RAG pipeline:
 *
 *  RETRIEVE  → embed query + vector-search → top-K relevant chunks
 *  MAP       → send each chunk as an independent packet to Gemini Flash
 *              → extract relevant facts or discard (parallel batches)
 *  REDUCE    → merge passing packets grouped by source file
 *              → return combined context string ready for the main AI call
 *
 * For small contexts (≤ 2 chunks worth of chars) the map-reduce overhead
 * is skipped and the raw chunks are returned directly.
 */
export async function getRelevantContext(
  query: string,
  sources: SourceFile[],
  apiKey: string,
  _topK: number = TOP_K_CHUNKS, // kept for backward compat, uses TOP_K_CHUNKS constant
): Promise<string> {
  if (sources.length === 0 || !apiKey) return "";

  // Step 1: Build vector index
  const index = await buildLocalIndex(sources, apiKey);
  if (index.length === 0) return "";

  // Step 2: Retrieve top-K
  const topChunks = await retrieveTopChunks(query, index, apiKey);
  if (topChunks.length === 0) return "";

  // Small-context fast path — skip map-reduce overhead
  const totalChars = topChunks.reduce((sum, sc) => sum + sc.chunk.text.length, 0);
  if (totalChars <= CHUNK_SIZE_CHARS * 2) {
    const contextStr = topChunks
      .map(sc => `[Source: ${sc.chunk.sourceName}]\n${sc.chunk.text}`)
      .join("\n\n");
    return `\n\n--- KNOWLEDGE SOURCES (Local RAG Indexed) ---\n${contextStr}\n--- END KNOWLEDGE SOURCES ---\n\n`;
  }

  // Step 3: MAP — validate packets
  const packetAnswers = await validatePackets(query, topChunks, apiKey);

  // Step 4: REDUCE — combine into final context
  return combinePacketAnswers(packetAnswers);
}
