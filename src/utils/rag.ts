import { GoogleGenAI } from "@google/genai";
import type { SourceFile } from "../types";

export interface Chunk {
  text: string;
  embedding?: number[];
  sourceName: string;
}

// Simple text chunking by paragraph
export function chunkText(text: string, maxTokens: number = 800): string[] {
  const chunkSize = maxTokens * 4; // approx chars
  const chunks: string[] = [];
  let currentChunk = "";
  
  const paragraphs = text.split(/\n\s*\n/);
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += p + "\n\n";
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// Cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple in-memory cache for embeddings keyed by source string hash or content
const embedCache = new Map<string, number[]>();

export async function getEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const ai = new GoogleGenAI({ apiKey });
  const results: number[][] = [];
  
  for (const txt of texts) {
    if (embedCache.has(txt)) {
      results.push(embedCache.get(txt)!);
      continue;
    }
    try {
      const res = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: txt,
      });
      const vec = res.embeddings?.[0]?.values || [];
      embedCache.set(txt, vec);
      results.push(vec);
    } catch (e) {
      console.warn("Failed to embed chunk:", e);
      results.push([]);
    }
  }
  return results;
}

// Build or get local index chunks with embeddings
export async function buildLocalIndex(sources: SourceFile[], apiKey: string): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];
  
  for (const source of sources) {
    // Only process text based sources
    if (source.type.startsWith("text/") || source.name.match(/\.(md|txt|csv)$/)) {
      const texts = chunkText(source.content);
      for (const t of texts) {
        allChunks.push({ text: t, sourceName: source.name });
      }
    }
  }

  if (allChunks.length > 0 && apiKey) {
    const texts = allChunks.map(c => c.text);
    const embeddings = await getEmbeddings(texts, apiKey);
    for (let i = 0; i < allChunks.length; i++) {
      allChunks[i].embedding = embeddings[i];
    }
  }

  return allChunks;
}

// Retrieve relevant context from sources using RAG
export async function getRelevantContext(query: string, sources: SourceFile[], apiKey: string, topK: number = 5): Promise<string> {
  if (sources.length === 0 || !apiKey) return "";
  
  const index = await buildLocalIndex(sources, apiKey);
  if (index.length === 0) return "";
  
  const ai = new GoogleGenAI({ apiKey });
  let queryVec: number[] | undefined;
  
  try {
    const queryRes = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: query,
    });
    queryVec = queryRes.embeddings?.[0]?.values;
  } catch (e) {
    console.warn("Failed to embed query:", e);
  }
  
  if (!queryVec) return "";

  // Score chunks
  const scored = index.map(chunk => ({
    chunk,
    score: chunk.embedding ? cosineSimilarity(queryVec, chunk.embedding) : 0
  }));

  // Sort descending
  scored.sort((a, b) => b.score - a.score);

  // Take top K chunks
  const topChunks = scored.slice(0, topK);

  const contextStr = topChunks.map(tc => `[Source: ${tc.chunk.sourceName}]\n${tc.chunk.text}`).join("\n\n");
  
  return `\n\n--- KNOWLEDGE SOURCES (Local RAG Indexed) ---\n${contextStr}\n--- END KNOWLEDGE SOURCES ---\n\n`;
}
