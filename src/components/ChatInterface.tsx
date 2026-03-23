import { GoogleGenAI, Part } from "@google/genai";
import { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
import {
  Send, Upload, Mic, StopCircle, X, FileText,
  BookOpen, Map, Brain, Search, MessageSquare,
  Loader2, AlertTriangle, Copy, Check, Share2,
  RotateCcw, Download, Bookmark
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ExportMenu from "./ExportMenu";
import { Mode, type ChatMessage, type SourceFile } from "../types";
import { exportConversation, shareAsMarkdown, generateShareUrl } from "../utils/export";
import { getRelevantContext } from "../utils/rag";

// ─── Mode config ───────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<Mode, { icon: React.ReactNode; shortLabel: string; color: string; dimColor: string; borderColor: string; hint: string }> = {
  [Mode.CHAT]:          { icon: <MessageSquare size={13}/>, shortLabel:"Chat",          color:"var(--blue)",        dimColor:"var(--blue-dim)",        borderColor:"var(--blue-border)",        hint:"Ask me anything about any subject" },
  [Mode.SUMMARY]:       { icon: <FileText size={13}/>,      shortLabel:"Summary",       color:"var(--periwinkle)",  dimColor:"var(--periwinkle-dim)",  borderColor:"var(--periwinkle-border)",  hint:"ELI5 explanation of any topic or uploaded file" },
  [Mode.CHEATSHEET]:    { icon: <BookOpen size={13}/>,      shortLabel:"Cheat Sheet",   color:"var(--yellow)",      dimColor:"var(--yellow-dim)",      borderColor:"var(--yellow-border)",      hint:"Structured quick-reference card you can export" },
  [Mode.LEARNING_PATH]: { icon: <Map size={13}/>,           shortLabel:"Learning Path", color:"var(--pink)",        dimColor:"var(--pink-dim)",        borderColor:"var(--pink-border)",        hint:"Phase-by-phase roadmap with free resources" },
  [Mode.PRACTICE_QUIZ]: { icon: <Brain size={13}/>,         shortLabel:"Quiz",          color:"var(--periwinkle)",  dimColor:"var(--periwinkle-dim)",  borderColor:"var(--periwinkle-border)",  hint:"MCQ, fill-in-the-blank, short answer — with feedback" },
  [Mode.RESOURCE_FINDER]:{ icon: <Search size={13}/>,       shortLabel:"Resources",     color:"var(--blue)",        dimColor:"var(--blue-dim)",        borderColor:"var(--blue-border)",        hint:"Find the best free learning resources for any topic" },
};

// ─── System prompts ────────────────────────────────────────────────────────────

const BASE = `You are StudentMind — an intelligent, warm AI learning companion for college and university students. Make any subject understandable through progressive, student-centered teaching.
PERSONALITY: Friendly and conversational (like a knowledgeable senior), mentor-like, Socratic (ask guiding questions), exam-focused when relevant, never condescending.
TEACHING TECHNIQUES: Real-world analogies, ASCII diagrams for structures, memory tricks/mnemonics, step-by-step breakdowns, ELI5 mode.
FORMAT: Use markdown. Bold key terms. Code blocks for code. Short paragraphs. End with a follow-up question.`;

const MODE_PROMPTS: Record<Mode, string> = {
  [Mode.CHAT]:          `${BASE}\nMODE: General Chat. Answer naturally. Use search when needed for current info.`,
  [Mode.SUMMARY]:       `${BASE}\nMODE: Simplified Summary.\n1. **ELI5** (2-3 sentences)\n2. **Plain English** with real-world analogy\n3. **Key Ideas** (bold 3-5 concepts)\n4. **Socratic Check** question\n5. "Want me to go deeper into any part?"`,
  [Mode.CHEATSHEET]:    `${BASE}\nMODE: Cheat Sheet. Sections: **Key Definitions** | **Core Rules/Formulas** | **Step-by-Step Process** | **Common Mistakes** | **Memory Tricks** | **Quick Reference Table**. Every point 1-2 lines max.`,
  [Mode.LEARNING_PATH]: `${BASE}\nMODE: Learning Path. Phases: Foundations → Core Concepts → Advanced → Practice. Each phase: what to learn, why, time estimate, mastery checkpoint, 2-3 free resources (MIT OCW, Khan Academy, NPTEL, YouTube, arXiv, OpenStax). End: "Do you have a deadline? I can adjust."`,
  [Mode.PRACTICE_QUIZ]: `${BASE}\nMODE: Quiz. Ask format first: MCQ/Fill-in/True-False/Short/Descriptive/Long/Mixed. Generate Easy→Medium→Hard. After each: ✅/❌ + explanation + concept. After 5+: flag weak areas.`,
  [Mode.RESOURCE_FINDER]:`${BASE}\nMODE: Resource Finder. Organize by: 📺 Video | 📖 Textbook | 🎯 Practice | 📝 Notes | 🔬 Research. For each: what, why, URL. Prioritize MIT OCW, Khan Academy, NPTEL, 3Blue1Brown, CrashCourse, freeCodeCamp, OpenStax.`,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const INDIAN = ["Hindi","Tamil","Telugu","Kannada","Bengali","Marathi","Malayalam","Gujarati","Punjabi","Odia","Assamese","Urdu"];

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function fmt(iso: string) { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); }
function fileToBase64(f: File): Promise<string> {
  return new Promise((res,rej)=>{const r=new FileReader();r.readAsDataURL(f);r.onload=()=>res((r.result as string).split(",")[1]);r.onerror=rej;});
}

async function translate(text:string,lang:string,sk:string,gk:string):Promise<string>{
  if(lang==="English"||!text) return text;
  try{
    if(INDIAN.includes(lang)&&sk){
      const lm:Record<string,string>={Hindi:"hi-IN",Tamil:"ta-IN",Telugu:"te-IN",Kannada:"kn-IN",Bengali:"bn-IN",Marathi:"mr-IN",Malayalam:"ml-IN",Gujarati:"gu-IN",Punjabi:"pa-IN"};
      const r=await fetch("https://api.sarvam.ai/translate",{method:"POST",headers:{"Content-Type":"application/json","api-subscription-key":sk},body:JSON.stringify({input:text,source_language_code:"en-IN",target_language_code:lm[lang]||"hi-IN",mode:"formal",enable_preprocessing:true})});
      const d=await r.json(); return d.translated_text||text;
    }else if(gk){
      const cm:Record<string,string>={French:"fr",Spanish:"es",German:"de",Arabic:"ar",Japanese:"ja",Chinese:"zh"};
      const r=await fetch(`https://translation.googleapis.com/language/translate/v2?key=${gk}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:text,source:"en",target:cm[lang]||lang.slice(0,2).toLowerCase(),format:"text"})});
      const d=await r.json(); return d.data?.translations?.[0]?.translatedText||text;
    }
  }catch(e){ console.warn("Translation failed:",e); }
  return text;
}

// ─── Rebuild AI history from saved messages (for session restore) ──────────────

function rebuildGeminiHistory(messages: ChatMessage[]): Array<{role:"user"|"model";parts:Part[]}> {
  const history: Array<{role:"user"|"model";parts:Part[]}> = [];
  for(const msg of messages){
    if(msg.id==="welcome"||msg.isError) continue;
    history.push({
      role: msg.sender==="user"?"user":"model",
      parts:[{text: msg.text}],
    });
  }
  // Keep last 40 turns
  return history.slice(-40);
}

function rebuildChatHistory(messages: ChatMessage[]): Array<{role:string;content:string}> {
  const history: Array<{role:string;content:string}> = [];
  for(const msg of messages){
    if(msg.id==="welcome"||msg.isError) continue;
    history.push({
      role: msg.sender==="user"?"user":"assistant",
      content: msg.text,
    });
  }
  return history.slice(-40);
}

// ─── Provider callers ──────────────────────────────────────────────────────────

async function callOpenAICompat(base:string,key:string,model:string,sys:string,msgs:Array<{role:string;content:string}>):Promise<string>{
  const r=await fetch(`${base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:sys},...msgs],temperature:0.7,max_tokens:4096})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`API error ${r.status}`);}
  const d=await r.json(); return d.choices?.[0]?.message?.content||"No response.";
}
async function callAnthropic(key:string,model:string,sys:string,msgs:Array<{role:string;content:string}>):Promise<string>{
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model,max_tokens:4096,system:sys,messages:msgs})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`Anthropic error ${r.status}`);}
  const d=await r.json(); return d.content?.[0]?.text||"No response.";
}
async function callCohere(key:string,model:string,sys:string,msgs:Array<{role:string;content:string}>):Promise<string>{
  const history=msgs.slice(0,-1).map(m=>({role:m.role==="assistant"?"CHATBOT":"USER",message:m.content}));
  const last=msgs[msgs.length-1]?.content||"";
  const r=await fetch("https://api.cohere.com/v1/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({model,message:last,preamble:sys,chat_history:history,max_tokens:4096})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.message||`Cohere error ${r.status}`);}
  const d=await r.json(); return d.text||"No response.";
}
async function callOllama(model:string,sys:string,msgs:Array<{role:string;content:string}>):Promise<string>{
  try {
    const r=await fetch("http://localhost:11434/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:sys},...msgs],stream:false})});
    if(!r.ok){throw new Error(`Ollama error ${r.status}. Make sure Ollama is running.`);}
    const d=await r.json(); return d.message?.content||"No response.";
  } catch (e: any) {
    throw new Error(`Failed to connect to Ollama: ${e.message}. Is it running on localhost:11434?`);
  }
}

// ─── Welcome ───────────────────────────────────────────────────────────────────

export function makeWelcome(): ChatMessage {
  return {
    id:"welcome", sender:"ai", timestamp:new Date().toISOString(), mode:Mode.CHAT,
    text:`Hey! I'm **StudentMind** 👋 — your personal AI study companion.

| Mode | What it does |
|------|-------------|
| 💬 **Chat** | Ask me anything, any subject |
| 📄 **Summary** | ELI5 explanations of any topic or uploaded file |
| 📋 **Cheat Sheet** | Structured quick-reference cards you can export |
| 🗺️ **Learning Path** | Phase-by-phase roadmap with free resources |
| 🧠 **Practice & Quiz** | MCQ, short answer, essay — with feedback |
| 🔍 **Resource Finder** | Best free resources when you have no material |

**Pick a mode above → type a topic, upload notes, or just ask a question.**

What are we working on today?`,
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  language: string;
  trackProgress: boolean;
  activeProvider: string;
  apiKey: string;
  geminiKey: string;
  selectedModel: string;
  sarvamKey: string;
  googleTranslateKey: string;
  sessionId: string;
  selectedSources?: SourceFile[];
  initialMessages?: ChatMessage[];
  onSessionUpdate?: (messages: ChatMessage[]) => void;
  onNewSession?: () => void;
  onSaveNote?: (msg: ChatMessage) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatInterface({
  language, trackProgress, activeProvider, apiKey, geminiKey, selectedModel,
  sarvamKey, googleTranslateKey, sessionId, selectedSources, initialMessages, onSessionUpdate, onNewSession, onSaveNote
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [makeWelcome()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentMode, setCurrentMode] = useState<Mode>(Mode.CHAT);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showConvExport, setShowConvExport] = useState(false);
  const [convExportLoading, setConvExportLoading] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const geminiHistory = useRef<Array<{role:"user"|"model";parts:Part[]}>>([]);
  const chatHistory = useRef<Array<{role:string;content:string}>>([]);

  // ── FIX 1: Session switch — reset messages + rebuild AI history from saved msgs ──
  const prevSessionId = useRef<string>(sessionId);
  useEffect(()=>{
    if(sessionId === prevSessionId.current) return; // same session, skip
    prevSessionId.current = sessionId;
    const msgs = initialMessages || [makeWelcome()];
    setMessages(msgs);
    setTopicsCovered([]);
    // Rebuild AI context from restored messages so the AI remembers the conversation
    geminiHistory.current = rebuildGeminiHistory(msgs);
    chatHistory.current = rebuildChatHistory(msgs);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX 2: Provider / model change — clear history only ──
  useEffect(()=>{
    geminiHistory.current = [];
    chatHistory.current = [];
  }, [activeProvider, selectedModel]);

  // ── Scroll to bottom on new messages ──
  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
  }, [messages]);

  // ── Auto-resize textarea ──
  useEffect(()=>{
    if(textareaRef.current){
      textareaRef.current.style.height="auto";
      textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,120)+"px";
    }
  }, [input]);

  // ── Voice recording handler ──
  useEffect(()=>{
    if(!mediaRecorder) return;
    const chunks:Blob[]=[];
    mediaRecorder.ondataavailable=(e)=>chunks.push(e.data);
    mediaRecorder.onstop=()=>{
      setSelectedFile(new File([new Blob(chunks,{type:"audio/webm"})], "voice-note.webm",{type:"audio/webm"}));
      setIsRecording(false);
    };
  }, [mediaRecorder]);

  // ─── AI router ─────────────────────────────────────────────────────────────────

  const callAI = useCallback(async(userText:string, file:File|null, mode:Mode):Promise<string>=>{
    if(!apiKey.trim() && activeProvider !== "ollama") throw new Error("No API key set. Open Settings ⚙ to add your key.");
    const sys = MODE_PROMPTS[mode];

    // Build knowledge context from selected sources using local RAG indexing
    let knowledgeContext = "";
    if (selectedSources && selectedSources.length > 0) {
      if (geminiKey) {
        knowledgeContext = await getRelevantContext(userText, selectedSources, geminiKey, 5);
      } else {
        // Fallback if no Gemini key: pass raw text (truncated if too large)
        const validSources = activeProvider === "sarvam" 
          ? selectedSources.filter(s => s.type.startsWith("text/") || s.name.match(/\.(md|txt|csv)$/))
          : selectedSources;
        if (validSources.length > 0) {
          knowledgeContext = "\n\n--- KNOWLEDGE SOURCES ---\n" + 
            validSources.slice(0, 5).map(s => `[File: ${s.name}]\n${s.content.slice(0, 15000)}`).join("\n\n") + 
            "\n--- END KNOWLEDGE SOURCES ---\n\n";
        }
      }
    }

    if(activeProvider==="gemini"){
      const ai = new GoogleGenAI({apiKey});
      const parts:Part[] = [];
      
      // Add text including knowledge context
      let promptText = userText;
      if (knowledgeContext) {
        promptText = `${knowledgeContext}User Question: ${userText}`;
      }
      if(promptText.trim()) parts.push({text:promptText});

      if(file){
        const mime = file.type;
        if(mime.startsWith("image/")||mime.startsWith("video/")||mime.startsWith("audio/")||mime==="application/pdf"){
          parts.push({inlineData:{data:await fileToBase64(file),mimeType:mime}});
        }else{
          try{ parts.push({text:`\n\n[File: ${file.name}]\n\n${await file.text()}`}); }
          catch{ parts.push({inlineData:{data:await fileToBase64(file),mimeType:mime||"application/octet-stream"}}); }
        }
      }
      if(!parts.length) return "Please type a message or upload a file.";
      const contents = [...geminiHistory.current, {role:"user" as const, parts}];
      const res = await ai.models.generateContent({model:selectedModel, contents, config:{systemInstruction:sys, thinkingConfig:{thinkingBudget:selectedModel.includes("flash")?0:8000}}});
      const text = res.text ?? "No response.";
      geminiHistory.current.push({role:"user",parts},{role:"model",parts:[{text}]});
      if(geminiHistory.current.length>40) geminiHistory.current = geminiHistory.current.slice(-40);
      return text;
    }

    // All other providers
    const contextPrefix = knowledgeContext ? `${knowledgeContext}User Question: ` : "";
    let content = `${contextPrefix}${userText}`;
    if(file){
      try{ content = `${contextPrefix}${userText}\n\n[File: ${file.name}]\n\n${await file.text()}`; }
      catch{ content = `${contextPrefix}${userText}\n\n[File: ${file.name} — binary]`; }
    }
    chatHistory.current.push({role:"user", content});
    if(chatHistory.current.length>40) chatHistory.current = chatHistory.current.slice(-40);

    let result:string;
    if(activeProvider==="openai")     result = await callOpenAICompat("https://api.openai.com/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="groq")  result = await callOpenAICompat("https://api.groq.com/openai/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="mistral") result = await callOpenAICompat("https://api.mistral.ai/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="anthropic") result = await callAnthropic(apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="cohere") result = await callCohere(apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="sarvam") result = await callOpenAICompat("https://api.sarvam.ai/indus/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="nvidia") result = await callOpenAICompat("https://integrate.api.nvidia.com/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="ollama") result = await callOllama(selectedModel,sys,chatHistory.current);
    else throw new Error(`Unknown provider: ${activeProvider}`);

    chatHistory.current.push({role:"assistant", content:result});
    return result;
  }, [activeProvider, apiKey, selectedModel, selectedSources, geminiKey]);

  // ─── FIX 3: handleSend — single atomic update, one save per exchange ───────────

  const handleSend = useCallback(async()=>{
    if(loading||(input.trim()===""&&!selectedFile)) return;
    const userText = input.trim();
    const file = selectedFile;

    const userMsg:ChatMessage = {
      id:genId(), text:userText||`📎 ${file?.name}`, sender:"user",
      mode:currentMode, fileInfo:file?{name:file.name,type:file.type}:undefined,
      timestamp:new Date().toISOString(),
    };

    // Optimistically add user message to UI
    const withUser = (prev: ChatMessage[]) => [...prev, userMsg];
    setMessages(withUser);
    setInput("");
    setSelectedFile(null);
    setLoading(true);

    try{
      let resp = await callAI(userText, file, currentMode);
      if(language!=="English") resp = await translate(resp, language, sarvamKey, googleTranslateKey);
      if(trackProgress && userText) setTopicsCovered(prev=>[...new Set([...prev, userText.slice(0,50)])]);

      const aiMsg:ChatMessage = {
        id:genId(), text:resp, sender:"ai",
        mode:currentMode, model:selectedModel, timestamp:new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMsg]);
      // onSessionUpdate called outside the updater — pure side effect, safe for React 18 Strict Mode
      onSessionUpdate?.([...messages, userMsg, aiMsg]);
    }catch(err:any){
      const errMsg:ChatMessage = {
        id:genId(), text:`⚠️ **Error**: ${err.message}`, sender:"ai",
        mode:currentMode, timestamp:new Date().toISOString(), isError:true,
      };
      setMessages(prev => [...prev, errMsg]);
      onSessionUpdate?.([...messages, userMsg, errMsg]);
    }finally{
      setLoading(false);
    }
  }, [loading, input, selectedFile, currentMode, callAI, language, sarvamKey, googleTranslateKey, trackProgress, onSessionUpdate, messages]);

  // ─── Other handlers ────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async(text:string, id:string)=>{
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(()=>setCopiedId(null), 2000);
  }, []);

  const handleShare = useCallback(async(type:"copy"|"url")=>{
    if(type==="copy"){
      await navigator.clipboard.writeText(shareAsMarkdown(messages,activeProvider,selectedModel));
      setShareToast("✓ Conversation copied as Markdown!");
    }else{
      await navigator.clipboard.writeText(generateShareUrl(messages));
      setShareToast("✓ Share link copied!");
    }
    setTimeout(()=>setShareToast(null), 3000);
  }, [messages, activeProvider, selectedModel]);

  const handleConvExport = useCallback(async(format:"md"|"txt"|"pdf"|"docx")=>{
    setConvExportLoading(format);
    try{ await exportConversation(messages, format, activeProvider, selectedModel); }
    catch(e){ console.error(e); }
    finally{ setConvExportLoading(null); setShowConvExport(false); }
  }, [messages, activeProvider, selectedModel]);

  const handleKeyDown = useCallback((e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const startRecording = useCallback(async()=>{
    try{
      const s = await navigator.mediaDevices.getUserMedia({audio:true});
      const r = new MediaRecorder(s);
      setMediaRecorder(r); r.start(); setIsRecording(true);
    }catch{ alert("Microphone access denied."); }
  }, []);

  const stopRecording = useCallback(()=>{
    if(mediaRecorder){ mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t=>t.stop()); }
  }, [mediaRecorder]);

  // ─── Render ────────────────────────────────────────────────────────────────────

  const cfg = MODE_CONFIG[currentMode];
  const noKey = !apiKey.trim();
  const nonWelcome = messages.filter(m=>m.id!=="welcome");

  return (
    <div className="flex flex-col w-full h-full" style={{background:"var(--bg-base)"}}>

      {/* Share toast */}
      {shareToast&&(
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white text-[12px] font-medium px-4 py-2 rounded-xl shadow-xl pointer-events-none"
          style={{background:"var(--blue)",boxShadow:"0 4px 24px var(--blue-glow)",fontFamily:"var(--font-body)"}}>
          {shareToast}
        </div>
      )}

      {/* ── Mode Tabs ── */}
      <div id="tour-mode-tabs" className="flex-shrink-0 z-10" style={{borderBottom:"1px solid var(--border)",background:"var(--bg-surface)",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
        <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 overflow-x-auto scrollbar-hide">
          {(Object.values(Mode) as Mode[]).map(mode=>{
            const mc = MODE_CONFIG[mode];
            const active = currentMode===mode;
            return(
              <button key={mode} onClick={()=>setCurrentMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 hover:bg-white/5"
                style={{
                  background: active?mc.dimColor:"transparent",
                  border:`1px solid ${active?mc.borderColor:"transparent"}`,
                  color: active?mc.color:"var(--text-muted)",
                  fontFamily:"var(--font-body)",
                }}>
                <span className="opacity-80">{mc.icon}</span>
                <span>{mc.shortLabel}</span>
              </button>
            );
          })}

          {/* Actions */}
          {nonWelcome.length>0&&(
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              <div className="relative">
                <button onClick={()=>setShowConvExport(!showConvExport)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all hover:bg-white/5"
                  style={{color:"var(--text-muted)",border:"1px solid transparent"}}
                  title="Export conversation">
                  <Download size={11}/> Export
                </button>
                {showConvExport&&(
                  <div className="absolute top-full right-0 mt-1.5 w-48 rounded-2xl overflow-hidden z-30 shadow-2xl"
                    style={{background:"var(--bg-card)",border:"1px solid var(--border-md)",boxShadow:"0 12px 32px rgba(0,0,0,0.4)"}}>
                    <div className="px-3 py-2" style={{borderBottom:"1px solid var(--border)"}}>
                      <p style={{color:"var(--text-faint)",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"var(--font-display)",fontWeight:600}}>Full conversation</p>
                    </div>
                    {(["pdf","docx","md","txt"] as const).map(f=>(
                      <button key={f} onClick={()=>handleConvExport(f)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5 group">
                        <span className="text-xs group-hover:text-white transition-colors" style={{color:"var(--text-secondary)"}}>{f==="pdf"?"PDF":f==="docx"?"Word (.docx)":f==="md"?"Markdown":"Plain Text"}</span>
                        {convExportLoading===f?<Loader2 size={10} className="animate-spin" style={{color:"var(--blue)"}}/>:<Download size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" style={{color:"var(--text-muted)"}}/>}
                      </button>
                    ))}
                    <div style={{borderTop:"1px solid var(--border)"}}>
                      <button onClick={()=>handleShare("copy")} className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5 group">
                        <Copy size={10} className="group-hover:text-[var(--blue)] transition-colors" style={{color:"var(--text-muted)"}}/><span className="text-xs group-hover:text-white transition-colors" style={{color:"var(--text-secondary)"}}>Copy as Markdown</span>
                      </button>
                      <button onClick={()=>handleShare("url")} className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5 group">
                        <Share2 size={10} className="group-hover:text-[var(--blue)] transition-colors" style={{color:"var(--text-muted)"}}/><span className="text-xs group-hover:text-white transition-colors" style={{color:"var(--text-secondary)"}}>Copy share link</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={onNewSession}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all hover:bg-white/5"
                style={{color:"var(--text-muted)",border:"1px solid transparent"}}
                title="New session">
                <RotateCcw size={11}/> New
              </button>
            </div>
          )}
        </div>

        {/* Mode hint + progress */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <span style={{color:cfg.color,fontSize:11}}>{cfg.icon}</span>
          <span style={{color:"var(--text-faint)",fontSize:10.5,fontFamily:"var(--font-body)",letterSpacing:"0.01em"}}>{cfg.hint}</span>
          {trackProgress&&topicsCovered.length>0&&(
            <span className="ml-auto text-[10px] px-2.5 py-0.5 rounded-full font-medium"
              style={{color:"var(--blue)",background:"var(--blue-dim)",border:"1px solid var(--blue-border)"}}>
              📊 {topicsCovered.length} topics
            </span>
          )}
        </div>
      </div>

      {/* No API key warning */}
      {noKey&&(
        <div className="mx-4 mt-3 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-300"
          style={{background:"var(--yellow-dim)",border:"1px solid var(--yellow-border)"}}>
          <AlertTriangle size={14} style={{color:"var(--yellow)",flexShrink:0}}/>
          <p style={{color:"var(--yellow)",fontSize:11,fontFamily:"var(--font-body)",lineHeight:1.4}}>
            No API key set. Open <strong>Settings ⚙</strong> in the top-right to add your key and start chatting.
          </p>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6" onClick={()=>setShowConvExport(false)}>
        {messages.map(msg=>{
          const isUser = msg.sender==="user";
          const mc = msg.mode?MODE_CONFIG[msg.mode]:null;
          return(
            <div key={msg.id} className={`flex ${isUser?"justify-end":"justify-start"} gap-3.5 group msg-in`}>
              {!isUser&&(
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{background:"linear-gradient(135deg,#5BBCFF,#7EA1FF)",boxShadow:"0 4px 12px rgba(91,188,255,0.25)"}}>
                  <span style={{fontSize:11,color:"white",fontFamily:"var(--font-display)",fontWeight:700}}>S</span>
                </div>
              )}
              <div className={`max-w-[82%] flex flex-col gap-1.5 ${isUser?"items-end":"items-start"}`}>
                {/* Mode label */}
                {!isUser&&msg.mode&&msg.id!=="welcome"&&mc&&(
                  <div className="flex items-center gap-2 px-1" style={{color:mc.color,fontSize:10}}>
                    {mc.icon}
                    <span style={{fontFamily:"var(--font-display)",fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{mc.shortLabel}</span>
                    {msg.model && (
                      <span className="px-1.5 py-0.5 rounded-md" style={{background:"rgba(255,255,255,0.05)", color:"var(--text-muted)", fontSize:9, fontWeight:500}}>
                        {msg.model.split("/").pop()}
                      </span>
                    )}
                    <span style={{color:"var(--text-faint)",marginLeft:2,fontWeight:400}}>{fmt(msg.timestamp)}</span>
                  </div>
                )}
                {/* File chip */}
                {msg.fileInfo&&(
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-1 transition-all hover:bg-white/5"
                    style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",color:"var(--text-secondary)"}}>
                    <FileText size={12} style={{color:"var(--blue)"}}/>
                    <span className="font-medium truncate max-w-[200px]">{msg.fileInfo.name}</span>
                  </div>
                )}
                {/* Bubble */}
                <div className={`rounded-2xl px-5 py-3.5 text-[13.5px] leading-relaxed transition-all duration-200 ${isUser?"hover:translate-x-[-2px]":"hover:translate-x-[2px]"}`}
                  style={isUser?{
                    background:"linear-gradient(135deg, var(--blue), #4A90E2)", 
                    color:"white",
                    borderBottomRightRadius:4,
                    boxShadow:"0 4px 16px var(--blue-glow)",
                    fontFamily:"var(--font-body)",
                    fontWeight: 450,
                  }:msg.isError?{
                    background:"rgba(255,80,80,0.06)",
                    border:"1px solid rgba(255,80,80,0.15)",
                    color:"#ff8080", borderBottomLeftRadius:4,
                    fontFamily:"var(--font-body)",
                  }:{
                    background:"var(--bg-card)",
                    border:"1px solid var(--border)",
                    borderBottomLeftRadius:4,
                    boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
                    fontFamily:"var(--font-body)",
                  }}>
                  {isUser
                    ? <span className="whitespace-pre-wrap">{msg.text}</span>
                    : <div className="sm-prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>
                  }
                </div>
                {/* Message actions */}
                {!isUser&&msg.id!=="welcome"&&!msg.isError&&(
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-[-4px] group-hover:translate-y-0">
                    <button onClick={()=>handleCopy(msg.text,msg.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all hover:bg-white/5"
                      style={{color:copiedId===msg.id?"var(--blue)":"var(--text-muted)"}}>
                      {copiedId===msg.id?<><Check size={11}/> Copied</>:<><Copy size={11}/> Copy</>}
                    </button>
                    <button onClick={()=>onSaveNote?.(msg)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all hover:bg-white/5"
                      style={{color:"var(--text-muted)"}}>
                      <Bookmark size={11}/> Pin
                    </button>
                    {msg.mode&&msg.mode!==Mode.CHAT&&(
                      <ExportMenu text={msg.text} mode={msg.mode} model={msg.model}/>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading&&(
          <div className="flex justify-start gap-3.5 msg-in">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 glow-pulse"
              style={{background:"linear-gradient(135deg,#5BBCFF,#7EA1FF)"}}>
              <span style={{fontSize:11,color:"white",fontFamily:"var(--font-display)",fontWeight:700}}>S</span>
            </div>
            <div className="rounded-2xl px-5 py-3.5 flex items-center gap-3 transition-all"
              style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderBottomLeftRadius:4,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
              <div className="relative">
                <Loader2 size={14} className="animate-spin" style={{color:"var(--blue)"}}/>
                <div className="absolute inset-0 animate-ping opacity-20" style={{background:"var(--blue)", borderRadius:"50%"}}></div>
              </div>
              <div className="flex flex-col">
                <span style={{color:"var(--text-secondary)",fontSize:13,fontFamily:"var(--font-body)",fontWeight:500}}>Thinking…</span>
                <span style={{color:"var(--text-faint)",fontSize:10,letterSpacing:"0.02em"}}>{selectedModel.split("/").pop()}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4"/>
      </div>

      {/* File preview */}
      {selectedFile&&(
        <div className="mx-4 mb-3 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl flex-shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{background:"var(--bg-elevated)",border:"1px solid var(--blue-border)",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"var(--blue-dim)"}}>
            <FileText size={16} style={{color:"var(--blue)"}}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium truncate" style={{color:"var(--text-primary)"}}>{selectedFile.name}</p>
            <p className="text-[10px]" style={{color:"var(--text-faint)"}}>{(selectedFile.size/1024).toFixed(1)} KB · {selectedFile.type.split("/")[1]?.toUpperCase() || "File"}</p>
          </div>
          <button onClick={()=>setSelectedFile(null)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{color:"var(--text-muted)"}}>
            <X size={15}/>
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div id="tour-input-area" className="px-4 pb-6 pt-2 flex-shrink-0" style={{borderTop:"1px solid var(--border)",background:"var(--bg-base)"}}>
        <div className="relative group">
          <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5 transition-all duration-300 focus-within:ring-1 focus-within:ring-[var(--blue-border)]"
            style={{
              background:"var(--bg-elevated)",
              border:`1px solid ${noKey?"var(--yellow-border)":"var(--border)"}`,
              boxShadow:"0 2px 12px rgba(0,0,0,0.1)"
            }}>
            <button onClick={()=>fileInputRef.current?.click()}
              className="p-2 flex-shrink-0 mb-0.5 rounded-xl hover:bg-white/5 transition-all duration-200"
              style={{color:"var(--text-secondary)"}} title="Upload file">
              <Upload size={16}/>
            </button>
            <input ref={fileInputRef} type="file" className="hidden"
              onChange={(e:ChangeEvent<HTMLInputElement>)=>{if(e.target.files?.[0])setSelectedFile(e.target.files[0]);}}
              accept="image/*,video/*,audio/*,.pdf,.txt,.md,.docx,.csv"/>
            <button onClick={isRecording?stopRecording:startRecording}
              className="p-2 flex-shrink-0 mb-0.5 rounded-xl transition-all duration-200 hover:bg-white/5"
              style={{color:isRecording?"#ff6b6b":"var(--text-secondary)"}}>
              {isRecording?<StopCircle size={16} className="animate-pulse"/>:<Mic size={16} className={isRecording?"":"opacity-60"}/>}
            </button>
            <textarea ref={textareaRef} rows={1}
              className="flex-1 bg-transparent resize-none outline-none leading-relaxed py-2 text-[13.5px] placeholder:opacity-40"
              style={{color:"var(--text-primary)",fontFamily:"var(--font-body)"}}
              placeholder={noKey?"Add your API key in Settings first…":`Ask anything about any topic${language!=="English"?` · ${language}`:""}…`}
              value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
            />
            <button onClick={handleSend} disabled={loading||(input.trim()===""&&!selectedFile)}
              className="p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 disabled:opacity-30"
              style={{
                background:loading||(input.trim()===""&&!selectedFile)?"var(--bg-card)":"var(--blue)",
                color:loading||(input.trim()===""&&!selectedFile)?"var(--text-faint)":"white",
                cursor:loading||(input.trim()===""&&!selectedFile)?"not-allowed":"pointer",
                boxShadow:loading||(input.trim()===""&&!selectedFile)?"none":"0 4px 16px var(--blue-glow)",
                transform:loading?"scale(0.95)":"scale(1)",
              }}>
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} className={input.trim()||selectedFile?"translate-x-0.5 -translate-y-0.5":""}/>}
            </button>
          </div>
          {/* Subtle decoration */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--blue)] to-[var(--periwinkle)] rounded-[18px] opacity-0 group-focus-within:opacity-10 blur transition-opacity duration-500 pointer-events-none"></div>
        </div>
        <p className="text-center mt-3" style={{color:"var(--text-muted)",fontSize:10,fontFamily:"var(--font-body)",letterSpacing:"0.01em"}}>
          <span className="opacity-60">Enter to send</span> · <span className="opacity-60">Shift+Enter for new line</span> · <span className="opacity-40 font-medium">PDF, Image, Audio, CSV</span>
        </p>
      </div>
    </div>
  );
}
