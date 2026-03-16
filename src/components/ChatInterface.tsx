import { GoogleGenAI, Part } from "@google/genai";
import { useState, useEffect, useRef, ChangeEvent, useCallback } from "react";
import {
  Send, Upload, Mic, StopCircle, X, FileText,
  BookOpen, Map, Brain, Search, MessageSquare,
  Loader2, AlertTriangle, Copy, Check, Share2,
  RotateCcw, Download
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import ExportMenu from "./ExportMenu";
import { Mode, type ChatMessage } from "../types";
import { exportConversation, shareAsMarkdown, generateShareUrl } from "../utils/export";

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
  selectedModel: string;
  sarvamKey: string;
  googleTranslateKey: string;
  sessionId: string;
  initialMessages?: ChatMessage[];
  onSessionUpdate?: (messages: ChatMessage[]) => void;
  onNewSession?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatInterface({
  language, trackProgress, activeProvider, apiKey, selectedModel,
  sarvamKey, googleTranslateKey, sessionId, initialMessages, onSessionUpdate, onNewSession
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
    if(!apiKey.trim()) throw new Error("No API key set. Open Settings ⚙ to add your key.");
    const sys = MODE_PROMPTS[mode];

    if(activeProvider==="gemini"){
      const ai = new GoogleGenAI({apiKey});
      const parts:Part[] = [];
      if(userText.trim()) parts.push({text:userText});
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
    let content = userText;
    if(file){
      try{ content = `${userText}\n\n[File: ${file.name}]\n\n${await file.text()}`; }
      catch{ content = `${userText}\n\n[File: ${file.name} — binary]`; }
    }
    chatHistory.current.push({role:"user", content});
    if(chatHistory.current.length>40) chatHistory.current = chatHistory.current.slice(-40);

    let result:string;
    if(activeProvider==="openai")     result = await callOpenAICompat("https://api.openai.com/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="groq")  result = await callOpenAICompat("https://api.groq.com/openai/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="mistral") result = await callOpenAICompat("https://api.mistral.ai/v1",apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="anthropic") result = await callAnthropic(apiKey,selectedModel,sys,chatHistory.current);
    else if(activeProvider==="cohere") result = await callCohere(apiKey,selectedModel,sys,chatHistory.current);
    else throw new Error(`Unknown provider: ${activeProvider}`);

    chatHistory.current.push({role:"assistant", content:result});
    return result;
  }, [activeProvider, apiKey, selectedModel]);

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
        mode:currentMode, timestamp:new Date().toISOString(),
      };

      // FIX: single setMessages call combining both messages, then one save
      setMessages(prev=>{
        const next = [...prev, aiMsg];
        // Call onSessionUpdate once with final state — not via useEffect
        onSessionUpdate?.(next);
        return next;
      });
    }catch(err:any){
      const errMsg:ChatMessage = {
        id:genId(), text:`⚠️ **Error**: ${err.message}`, sender:"ai",
        mode:currentMode, timestamp:new Date().toISOString(), isError:true,
      };
      setMessages(prev=>{
        const next = [...prev, errMsg];
        onSessionUpdate?.(next);
        return next;
      });
    }finally{
      setLoading(false);
    }
  }, [loading, input, selectedFile, currentMode, callAI, language, sarvamKey, googleTranslateKey, trackProgress, onSessionUpdate]);

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
      <div className="flex-shrink-0" style={{borderBottom:"1px solid var(--border)",background:"var(--bg-surface)"}}>
        <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
          {(Object.values(Mode) as Mode[]).map(mode=>{
            const mc = MODE_CONFIG[mode];
            const active = currentMode===mode;
            return(
              <button key={mode} onClick={()=>setCurrentMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{
                  background: active?mc.dimColor:"transparent",
                  border:`1px solid ${active?mc.borderColor:"transparent"}`,
                  color: active?mc.color:"var(--text-muted)",
                  fontFamily:"var(--font-body)",
                }}>
                <span>{mc.icon}</span>
                <span>{mc.shortLabel}</span>
              </button>
            );
          })}

          {/* Actions */}
          {nonWelcome.length>0&&(
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              <div className="relative">
                <button onClick={()=>setShowConvExport(!showConvExport)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all"
                  style={{color:"var(--text-muted)",border:"1px solid transparent"}}
                  title="Export conversation">
                  <Download size={11}/> Export
                </button>
                {showConvExport&&(
                  <div className="absolute top-full right-0 mt-1.5 w-48 rounded-2xl overflow-hidden z-30 shadow-2xl"
                    style={{background:"var(--bg-card)",border:"1px solid var(--border-md)"}}>
                    <div className="px-3 py-2" style={{borderBottom:"1px solid var(--border)"}}>
                      <p style={{color:"var(--text-faint)",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"var(--font-display)"}}>Full conversation</p>
                    </div>
                    {(["pdf","docx","md","txt"] as const).map(f=>(
                      <button key={f} onClick={()=>handleConvExport(f)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                        <span className="text-xs" style={{color:"var(--text-secondary)"}}>{f==="pdf"?"PDF":f==="docx"?"Word (.docx)":f==="md"?"Markdown":"Plain Text"}</span>
                        {convExportLoading===f&&<Loader2 size={10} className="animate-spin" style={{color:"var(--blue)"}}/>}
                      </button>
                    ))}
                    <div style={{borderTop:"1px solid var(--border)"}}>
                      <button onClick={()=>handleShare("copy")} className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                        <Copy size={10} style={{color:"var(--text-muted)"}}/><span className="text-xs" style={{color:"var(--text-secondary)"}}>Copy as Markdown</span>
                      </button>
                      <button onClick={()=>handleShare("url")} className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                        <Share2 size={10} style={{color:"var(--text-muted)"}}/><span className="text-xs" style={{color:"var(--text-secondary)"}}>Copy share link</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={onNewSession}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] transition-all"
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
          <span style={{color:"var(--text-faint)",fontSize:11,fontFamily:"var(--font-body)"}}>{cfg.hint}</span>
          {trackProgress&&topicsCovered.length>0&&(
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
              style={{color:"var(--blue)",background:"var(--blue-dim)",border:"1px solid var(--blue-border)"}}>
              📊 {topicsCovered.length} topics
            </span>
          )}
        </div>
      </div>

      {/* No API key warning */}
      {noKey&&(
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
          style={{background:"var(--yellow-dim)",border:"1px solid var(--yellow-border)"}}>
          <AlertTriangle size={13} style={{color:"var(--yellow)",flexShrink:0}}/>
          <p style={{color:"var(--yellow)",fontSize:11,fontFamily:"var(--font-body)"}}>
            No API key set. Open <strong>Settings ⚙</strong> in the top-right to add your key.
          </p>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" onClick={()=>setShowConvExport(false)}>
        {messages.map(msg=>{
          const isUser = msg.sender==="user";
          const mc = msg.mode?MODE_CONFIG[msg.mode]:null;
          return(
            <div key={msg.id} className={`flex ${isUser?"justify-end":"justify-start"} gap-3 msg-in`}>
              {!isUser&&(
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{background:"linear-gradient(135deg,#5BBCFF,#7EA1FF)",boxShadow:"0 0 12px rgba(91,188,255,0.2)"}}>
                  <span style={{fontSize:10,color:"white",fontFamily:"var(--font-display)",fontWeight:700}}>S</span>
                </div>
              )}
              <div className={`max-w-[78%] flex flex-col gap-1 ${isUser?"items-end":"items-start"}`}>
                {/* Mode label */}
                {!isUser&&msg.mode&&msg.id!=="welcome"&&mc&&(
                  <div className="flex items-center gap-1.5" style={{color:mc.color,fontSize:10}}>
                    {mc.icon}
                    <span style={{fontFamily:"var(--font-display)",fontWeight:600,letterSpacing:"0.02em"}}>{mc.shortLabel}</span>
                    <span style={{color:"var(--text-faint)",marginLeft:2}}>{fmt(msg.timestamp)}</span>
                  </div>
                )}
                {/* File chip */}
                {msg.fileInfo&&(
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mb-0.5"
                    style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>
                    <FileText size={11}/><span>{msg.fileInfo.name}</span>
                  </div>
                )}
                {/* Bubble */}
                <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={isUser?{
                    background:"var(--blue)", color:"white",
                    borderBottomRightRadius:4,
                    boxShadow:"0 2px 16px var(--blue-glow)",
                    fontFamily:"var(--font-body)",
                  }:msg.isError?{
                    background:"rgba(255,80,80,0.08)",
                    border:"1px solid rgba(255,80,80,0.2)",
                    color:"#ff8080", borderBottomLeftRadius:4,
                    fontFamily:"var(--font-body)",
                  }:{
                    background:"var(--bg-card)",
                    border:"1px solid var(--border)",
                    borderBottomLeftRadius:4,
                    fontFamily:"var(--font-body)",
                  }}>
                  {isUser
                    ? <span className="whitespace-pre-wrap">{msg.text}</span>
                    : <div className="sm-prose"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                  }
                </div>
                {/* Message actions */}
                {!isUser&&msg.id!=="welcome"&&!msg.isError&&(
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <button onClick={()=>handleCopy(msg.text,msg.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] transition-all"
                      style={{color:copiedId===msg.id?"var(--blue)":"var(--text-faint)"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-elevated)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      {copiedId===msg.id?<><Check size={10}/> Copied</>:<><Copy size={10}/> Copy</>}
                    </button>
                    {msg.mode&&msg.mode!==Mode.CHAT&&(
                      <ExportMenu text={msg.text} mode={msg.mode}/>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading&&(
          <div className="flex justify-start gap-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 glow-pulse"
              style={{background:"linear-gradient(135deg,#5BBCFF,#7EA1FF)"}}>
              <span style={{fontSize:10,color:"white",fontFamily:"var(--font-display)",fontWeight:700}}>S</span>
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
              style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderBottomLeftRadius:4}}>
              <Loader2 size={13} className="animate-spin" style={{color:"var(--blue)"}}/>
              <span style={{color:"var(--text-muted)",fontSize:12,fontFamily:"var(--font-body)"}}>Thinking…</span>
              <span style={{color:"var(--text-faint)",fontSize:10}}>{selectedModel}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* File preview */}
      {selectedFile&&(
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
          style={{background:"var(--bg-elevated)",border:"1px solid var(--border)"}}>
          <FileText size={13} style={{color:"var(--text-muted)",flexShrink:0}}/>
          <span className="text-xs truncate flex-1" style={{color:"var(--text-secondary)"}}>{selectedFile.name}</span>
          <span className="text-[10px]" style={{color:"var(--text-faint)"}}>{(selectedFile.size/1024).toFixed(1)} KB</span>
          <button onClick={()=>setSelectedFile(null)} className="ml-1 opacity-40 hover:opacity-90 transition-opacity" style={{color:"var(--text-primary)"}}>
            <X size={13}/>
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0" style={{borderTop:"1px solid var(--border)"}}>
        <div className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all"
          style={{background:"var(--bg-elevated)",border:`1px solid ${noKey?"var(--yellow-border)":"var(--border)"}`}}
          onFocus={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--blue-border)";}}
          onBlur={e=>{(e.currentTarget as HTMLElement).style.borderColor=noKey?"var(--yellow-border)":"var(--border)";}}>
          <button onClick={()=>fileInputRef.current?.click()}
            className="p-1.5 flex-shrink-0 mb-0.5 opacity-30 hover:opacity-80 transition-opacity"
            style={{color:"var(--text-primary)"}} title="Upload file">
            <Upload size={15}/>
          </button>
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={(e:ChangeEvent<HTMLInputElement>)=>{if(e.target.files?.[0])setSelectedFile(e.target.files[0]);}}
            accept="image/*,video/*,audio/*,.pdf,.txt,.md,.docx,.csv"/>
          <button onClick={isRecording?stopRecording:startRecording}
            className="p-1.5 flex-shrink-0 mb-0.5 transition-all"
            style={{color:isRecording?"#ff6b6b":"var(--text-primary)",opacity:isRecording?1:0.3}}>
            {isRecording?<StopCircle size={15} className="animate-pulse"/>:<Mic size={15}/>}
          </button>
          <textarea ref={textareaRef} rows={1}
            className="flex-1 bg-transparent resize-none outline-none leading-relaxed py-1.5 text-sm"
            style={{color:"var(--text-primary)",fontFamily:"var(--font-body)"}}
            placeholder={noKey?"Add your API key in Settings first…":`Ask about anything${language!=="English"?` · responding in ${language}`:""}…`}
            value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
          />
          <button onClick={handleSend} disabled={loading||(input.trim()===""&&!selectedFile)}
            className="p-2 rounded-xl flex-shrink-0 transition-all"
            style={{
              background:loading||(input.trim()===""&&!selectedFile)?"var(--bg-card)":"var(--blue)",
              color:loading||(input.trim()===""&&!selectedFile)?"var(--text-faint)":"white",
              cursor:loading||(input.trim()===""&&!selectedFile)?"not-allowed":"pointer",
              boxShadow:loading||(input.trim()===""&&!selectedFile)?"none":"0 2px 12px var(--blue-glow)",
            }}>
            <Send size={14}/>
          </button>
        </div>
        <p className="text-center mt-2" style={{color:"var(--text-faint)",fontSize:10,fontFamily:"var(--font-body)"}}>
          Enter to send · Shift+Enter for new line · PDF, images, audio, text & markdown supported
        </p>
      </div>
    </div>
  );
}
