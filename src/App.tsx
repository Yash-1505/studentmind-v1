import { useState, useEffect, useCallback } from "react";
import ChatInterface, { makeWelcome } from "./components/ChatInterface";
import HistoryPanel from "./components/HistoryPanel";
import SourcesPanel from "./components/SourcesPanel";
import NotesPanel from "./components/NotesPanel";
import { Settings, X, GraduationCap, ChevronDown, ChevronUp, Eye, EyeOff, History, FileText, Bookmark, PlayCircle } from "lucide-react";
import { Mode, type AIProvider, type Session, type AppSettings, type ChatMessage, type SourceFile, type SavedNote } from "./types";
import { saveSettings, loadSettings, saveSessions, loadSessions, saveCurrentSessionId, loadCurrentSessionId, deleteSession, saveSources, loadSources, saveNotes, loadNotes } from "./utils/storage";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const AI_PROVIDERS: AIProvider[] = [
  {
    id:"gemini", name:"Google Gemini", logo:"G", color:"text-[#5BBCFF]", bgColor:"bg-[rgba(91,188,255,0.08)]", borderColor:"border-[rgba(91,188,255,0.22)]",
    keyPlaceholder:"AIza...", keyHint:"Free tier available", keyLink:"https://aistudio.google.com", keyLinkLabel:"aistudio.google.com → Get API Key",
    models:[
      {id:"gemini-2.5-flash",label:"Gemini 2.5 Flash",description:"Fast & efficient", contextWindow: 4000000, fast:true},
      {id:"gemini-2.5-pro",label:"Gemini 2.5 Pro",description:"Most capable", contextWindow: 8000000, smart:true}
    ],
  },
  {
    id:"openai", name:"OpenAI", logo:"⬡", color:"text-[#a8f0c6]", bgColor:"bg-[rgba(168,240,198,0.08)]", borderColor:"border-[rgba(168,240,198,0.2)]",
    keyPlaceholder:"sk-proj-...", keyHint:"Paid usage required", keyLink:"https://platform.openai.com/api-keys", keyLinkLabel:"platform.openai.com → API Keys",
    models:[
      {id:"gpt-4o-mini",label:"GPT-4o Mini",description:"Fast & affordable", contextWindow: 512000, fast:true},
      {id:"gpt-4o",label:"GPT-4o",description:"Most capable", contextWindow: 512000, smart:true},
      {id:"gpt-4-turbo",label:"GPT-4 Turbo",description:"High performance", contextWindow: 512000}
    ],
  },
  {
    id:"groq", name:"Groq", logo:"▲", color:"text-[#FFFAB7]", bgColor:"bg-[rgba(255,250,183,0.07)]", borderColor:"border-[rgba(255,250,183,0.2)]",
    keyPlaceholder:"gsk_...", keyHint:"Free tier — extremely fast", keyLink:"https://console.groq.com/keys", keyLinkLabel:"console.groq.com → API Keys",
    models:[
      {id:"llama-3.3-70b-versatile",label:"Llama 3.3 70B",description:"Best open model", contextWindow: 512000, smart:true},
      {id:"llama-3.1-8b-instant",label:"Llama 3.1 8B",description:"Fastest response", contextWindow: 512000, fast:true},
      {id:"mixtral-8x7b-32768",label:"Mixtral 8x7B",description:"Balanced", contextWindow: 128000},
      {id:"gemma2-9b-it",label:"Gemma 2 9B",description:"Google open model", contextWindow: 32000}
    ],
  },
  {
    id:"mistral", name:"Mistral AI", logo:"M", color:"text-[#FFD1E3]", bgColor:"bg-[rgba(255,209,227,0.07)]", borderColor:"border-[rgba(255,209,227,0.2)]",
    keyPlaceholder:"...", keyHint:"Strong multilingual support", keyLink:"https://console.mistral.ai/api-keys", keyLinkLabel:"console.mistral.ai → API Keys",
    models:[
      {id:"mistral-small-latest",label:"Mistral Small",description:"Fast & cheap", contextWindow: 128000, fast:true},
      {id:"mistral-medium-latest",label:"Mistral Medium",description:"Balanced", contextWindow: 128000},
      {id:"mistral-large-latest",label:"Mistral Large",description:"Most capable", contextWindow: 512000, smart:true}
    ],
  },
  {
    id:"anthropic", name:"Anthropic Claude", logo:"◇", color:"text-[#7EA1FF]", bgColor:"bg-[rgba(126,161,255,0.08)]", borderColor:"border-[rgba(126,161,255,0.22)]",
    keyPlaceholder:"sk-ant-...", keyHint:"Paid usage required", keyLink:"https://console.anthropic.com/keys", keyLinkLabel:"console.anthropic.com → API Keys",
    corsNote:"Direct browser calls blocked by Anthropic CORS — needs a backend proxy",
    models:[
      {id:"claude-3-5-haiku-20241022",label:"Claude 3.5 Haiku",description:"Fast & affordable", contextWindow: 800000, fast:true},
      {id:"claude-3-5-sonnet-20241022",label:"Claude 3.5 Sonnet",description:"Best complex tasks", contextWindow: 800000, smart:true},
      {id:"claude-3-opus-20240229",label:"Claude 3 Opus",description:"Most intelligent", contextWindow: 800000}
    ],
  },
  {
    id:"cohere", name:"Cohere", logo:"Co", color:"text-[#FFD1E3]", bgColor:"bg-[rgba(255,209,227,0.07)]", borderColor:"border-[rgba(255,209,227,0.2)]",
    keyPlaceholder:"...", keyHint:"Free trial available", keyLink:"https://dashboard.cohere.com/api-keys", keyLinkLabel:"dashboard.cohere.com → API Keys",
    models:[
      {id:"command-r-plus-08-2024",label:"Command R+",description:"Best for study & RAG", contextWindow: 512000, smart:true},
      {id:"command-r-08-2024",label:"Command R",description:"Fast & efficient", contextWindow: 512000, fast:true}
    ],
  },
  {
    id:"sarvam", name:"Sarvam AI", logo:"S", color:"text-[#FFAB7B]", bgColor:"bg-[rgba(255,171,123,0.08)]", borderColor:"border-[rgba(255,171,123,0.22)]",
    keyPlaceholder:"...", keyHint:"Free usage for Indus model", keyLink:"https://indus.sarvam.ai", keyLinkLabel:"indus.sarvam.ai → Get API Key",
    models:[
      {id:"sarvam-2b-v0.5",label:"Indus 2B v0.5",description:"Optimized for Indian languages", contextWindow: 32000, fast:true}
    ],
  },
  {
    id:"nvidia", name:"NVIDIA NIM", logo:"N", color:"text-[#76B900]", bgColor:"bg-[rgba(118,185,0,0.08)]", borderColor:"border-[rgba(118,185,0,0.22)]",
    keyPlaceholder:"nvapi-...", keyHint:"Free credits — 1000 req/month on most models", keyLink:"https://build.nvidia.com", keyLinkLabel:"build.nvidia.com → Get API Key",
    models:[
      // ── Nemotron 3 family (NVIDIA's latest open models, 2025) ──────────────────
      {id:"nvidia/nemotron-3-super-120b-a12b",label:"Nemotron Super 120B",description:"Hybrid MoE · 1M ctx · best reasoning & agentic", contextWindow:1000000, smart:true},
      // ── Llama 3.3 / 3.1 ──────────────────────────────────────────────────────
      {id:"meta/llama-3.3-70b-instruct",label:"Llama 3.3 70B",description:"Best open chat & instruction following", contextWindow:128000, smart:true},
      {id:"meta/llama-3.1-8b-instruct",label:"Llama 3.1 8B",description:"Fast & lightweight", contextWindow:128000, fast:true},
      {id:"meta/llama-3.1-405b-instruct",label:"Llama 3.1 405B",description:"Largest open model · highest accuracy", contextWindow:128000},
      // ── Qwen 3.5 (newest, free endpoint) ─────────────────────────────────────
      {id:"qwen/qwen3.5-122b-a10b",label:"Qwen 3.5 122B MoE",description:"Free · coding, reasoning & multimodal chat", contextWindow:131072, smart:true},
      // ── MiniMax (free endpoint) ───────────────────────────────────────────────
      {id:"minimaxai/minimax-m2.1",label:"MiniMax M2.1",description:"Free · multilingual · coding & office AI", contextWindow:1000000, fast:true},
      // ── Mistral ──────────────────────────────────────────────────────────────
      {id:"mistralai/mistral-small-4-119b-2603",label:"Mistral Small 4 119B",description:"Hybrid MoE · reasoning, coding & multimodal", contextWindow:256000},
      {id:"mistralai/mistral-nemo-12b-instruct",label:"Mistral Nemo 12B",description:"Efficient & smart", contextWindow:128000, fast:true},
      // ── Microsoft Phi ─────────────────────────────────────────────────────────
      {id:"microsoft/phi-4-mini-instruct",label:"Phi-4 Mini",description:"Fast edge model · strong reasoning per param", contextWindow:128000, fast:true},
      // ── DeepSeek R1 ──────────────────────────────────────────────────────────
      {id:"deepseek-ai/deepseek-r1",label:"DeepSeek R1",description:"Chain-of-thought reasoning · STEM & math", contextWindow:128000, smart:true},
    ],
  },
  {
    id:"ollama", name:"Ollama (Local)", logo:"O", color:"text-[#white]", bgColor:"bg-[rgba(255,255,255,0.05)]", borderColor:"border-[rgba(255,255,255,0.15)]",
    keyPlaceholder:"Not required", keyHint:"Requires Ollama running on localhost:11434", keyLink:"https://ollama.com", keyLinkLabel:"ollama.com → Download",
    corsNote: "Requires OLLAMA_ORIGINS=\"*\" environment variable to allow browser access",
    models:[
      {id:"llama3.2",label:"Llama 3.2",description:"Fast & local", contextWindow: 128000, fast:true},
      {id:"mistral",label:"Mistral",description:"Balanced local model", contextWindow: 32000},
      {id:"phi3",label:"Phi-3",description:"Microsoft tiny model", contextWindow: 128000, fast:true},
      {id:"deepseek-coder",label:"DeepSeek Coder",description:"Local coding expert", contextWindow: 128000, smart:true}
    ],
  },
];

function PasswordInput({value,onChange,placeholder,hasValue}:{value:string;onChange:(v:string)=>void;placeholder:string;hasValue?:boolean}) {
  const [show,setShow]=useState(false);
  return(
    <div className="relative">
      <input type={show?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm rounded-xl px-4 py-2.5 pr-10 outline-none transition-all"
        style={{background:"var(--bg-base)",border:`1px solid ${hasValue?"rgba(91,188,255,0.3)":"var(--border)"}`,color:"var(--text-primary)",fontFamily:"var(--font-body)"}}
      />
      <button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity opacity-30 hover:opacity-70" style={{color:"var(--text-primary)"}}>
        {show?<EyeOff size={13}/>:<Eye size={13}/>}
      </button>
    </div>
  );
}

const DEFAULT_SETTINGS: AppSettings = {
  activeProvider:"gemini",
  selectedModels:{
    gemini:"gemini-2.5-flash",
    openai:"gpt-4o-mini",
    groq:"llama-3.3-70b-versatile",
    mistral:"mistral-small-latest",
    anthropic:"claude-3-5-haiku-20241022",
    cohere:"command-r-08-2024",
    sarvam:"sarvam-2b-v0.5",
    nvidia:"meta/llama-3.3-70b-instruct",
    ollama:"llama3.2"
  },
  apiKeys:{},language:"English",trackProgress:false,sarvamKey:"",googleTranslateKey:"",
};

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true); // Default show history
  const [showSources, setShowSources] = useState(true); // Default show sources
  const [showNotes, setShowNotes] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string|null>("gemini");

  const saved = loadSettings();
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS, ...saved });
  const [sessions, setSessions] = useState<Session[]>(loadSessions());
  const [sources, setSources] = useState<SourceFile[]>(loadSources());
  const [notes, setNotes] = useState<SavedNote[]>(loadNotes());
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(()=>{
    const id = loadCurrentSessionId(); const all = loadSessions();
    return (id && all.find(s=>s.id===id)) ? id : genSessionId();
  });
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>(()=>{
    const all = loadSessions(); const id = loadCurrentSessionId();
    if(id){ const s=all.find(s=>s.id===id); if(s) return s.messages; }
    return [makeWelcome()];
  });

  useEffect(()=>{ saveSettings(settings); },[settings]);
  useEffect(()=>{ saveSessions(sessions); },[sessions]);
  useEffect(()=>{ saveCurrentSessionId(currentSessionId); },[currentSessionId]);
  useEffect(()=>{ saveSources(sources); },[sources]);
  useEffect(()=>{ saveNotes(notes); },[notes]);

  const startTour = () => {
    const d = driver({
      showProgress: true,
      popoverClass: 'tour-theme',
      steps: [
        { element: '#tour-header-logo', popover: { title: 'Welcome to StudentMind', description: 'Your AI-powered learning companion. Let\'s quickly go over the layout.', side: "bottom", align: 'start' }},
        { element: '#tour-mode-tabs', popover: { title: 'Learning Modes', description: 'Switch easily between Chat, Summary, Quizzes, and more based on how you want to learn.', side: "bottom", align: 'start' }},
        { element: '#tour-sources-btn', popover: { title: 'Knowledge Sources', description: 'Upload your own PDFs or notes here. We use local RAG indexing so only the most relevant content is sent to the AI.', side: "bottom", align: 'start' }},
        { element: '#tour-settings-btn', popover: { title: 'Models & Keys', description: 'Add your AI API keys and choose between Google Gemini, Groq, local Ollama, etc.', side: "left", align: 'start' }},
        { element: '#tour-input-area', popover: { title: 'Ask Anything', description: 'Type your message, upload a quick file, or even record a voice note to get started.', side: "top", align: 'center' }},
      ]
    });
    d.drive();
    localStorage.setItem("tourCompleted", "true");
  };

  useEffect(() => {
    if (!localStorage.getItem("tourCompleted")) {
      setTimeout(startTour, 1000);
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key:K, value:AppSettings[K]) =>
    setSettings(prev=>({...prev,[key]:value}));

  const handleSessionUpdate = useCallback((messages: ChatMessage[]) => {
    setCurrentMessages(messages);
    setSessions(prev => {
      const existing = prev.find(s=>s.id===currentSessionId);
      const title = messages.find(m=>m.sender==="user")?.text?.slice(0,60) || "New Session";
      const updated: Session = { id:currentSessionId, title, messages, provider:settings.activeProvider,
        model:settings.selectedModels[settings.activeProvider],
        sourceIds: selectedSourceIds,
        createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString() };
      return [...prev.filter(s=>s.id!==currentSessionId), updated];
    });
  }, [currentSessionId, settings.activeProvider, settings.selectedModels, selectedSourceIds]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(genSessionId()); 
    setCurrentMessages([makeWelcome()]); 
    setSelectedSourceIds([]); // Clear sources for new session
    setShowHistory(true);
  }, []);

  const handleSelectSession = useCallback((session: Session) => {
    setCurrentSessionId(session.id); 
    setCurrentMessages(session.messages); 
    setSelectedSourceIds(session.sourceIds || []); // Restore per-session sources
    setShowHistory(true);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => deleteSession(prev, id));
    if(id === currentSessionId) handleNewSession();
  }, [currentSessionId, handleNewSession]);

  const handleAddSource = async (file: File) => {
    const isText = file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt") || file.name.endsWith(".csv");
    let content = "";
    if (isText) {
      content = await file.text();
    } else {
      const reader = new FileReader();
      content = await new Promise((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
    }

    const newSource: SourceFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      content,
      addedAt: new Date().toISOString(),
    };
    setSources(prev => {
      const next = [newSource, ...prev];
      return next.slice(0, 100); // Increased max sources to 100
    });
  };

  const handleDeleteSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    setSelectedSourceIds(prev => prev.filter(sid => sid !== id));
  };

  const handleSaveNote = (msg: ChatMessage) => {
    const newNote: SavedNote = {
      id: `note-${Date.now()}`,
      title: msg.text.split('\n')[0].replace(/[#*`]/g, '').slice(0, 50) || "Saved Note",
      content: msg.text,
      mode: msg.mode || Mode.CHAT,
      model: msg.model || "unknown",
      savedAt: new Date().toISOString()
    };
    setNotes(prev => [newNote, ...prev]);
    setShowNotes(true);
  };

  const provider = AI_PROVIDERS.find(p=>p.id===settings.activeProvider)!;
  const currentModel = settings.selectedModels[settings.activeProvider];
  const currentModelData = provider.models.find(m => m.id === currentModel);
  const contextLimit = currentModelData?.contextWindow || 0;
  const selectedSources = sources.filter(s => selectedSourceIds.includes(s.id));

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{background:"var(--bg-base)",fontFamily:"var(--font-body)"}}>

      {/* Header */}
      <header style={{borderBottom:"1px solid var(--border)",background:"rgba(7,7,14,0.9)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",position:"sticky",top:0,zIndex:40}}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={()=>setShowHistory(!showHistory)} title="Chat history" className="p-2 rounded-xl transition-all" style={{border:`1px solid ${showHistory?"rgba(91,188,255,0.3)":"var(--border)"}`,background:showHistory?"var(--blue-dim)":"transparent",color:showHistory?"var(--blue)":"var(--text-muted)"}}>
              <History size={15}/>
            </button>
            <div id="tour-header-logo" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#5BBCFF 0%,#7EA1FF 100%)",boxShadow:"0 0 18px rgba(91,188,255,0.28)"}}>
                <GraduationCap size={15} className="text-white"/>
              </div>
              <div>
                <h1 style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:15,color:"var(--text-primary)",letterSpacing:"-0.025em",lineHeight:1.2}}>StudentMind</h1>
                <p style={{fontSize:9,color:"var(--text-faint)",letterSpacing:"0.08em",textTransform:"uppercase"}}>AI Learning Companion</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button id="tour-sources-btn" onClick={()=>setShowSources(!showSources)} title="Knowledge Sources" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all" 
              style={{
                border:`1px solid ${showSources?"rgba(91,188,255,0.3)":"var(--border)"}`,
                background:showSources?"var(--blue-dim)":"var(--bg-elevated)",
                color:showSources?"var(--blue)":"var(--text-secondary)"
              }}>
              <FileText size={15}/>
              <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wider">Sources</span>
              {selectedSourceIds.length > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white bg-[var(--blue)]">
                  {selectedSourceIds.length}
                </span>
              )}
            </button>
            <div className="w-[1px] h-4 mx-1" style={{background:"var(--border)"}}/>
            <button onClick={()=>setShowNotes(!showNotes)} title="Saved Notes" 
              className="p-2 rounded-xl transition-all" 
              style={{
                border:`1px solid ${showNotes?"rgba(126,161,255,0.3)":"var(--border)"}`,
                background:showNotes?"var(--periwinkle-dim)":"var(--bg-elevated)",
                color:showNotes?"var(--periwinkle)":"var(--text-secondary)"
              }}>
              <Bookmark size={15}/>
            </button>
            <div className="w-[1px] h-4 mx-1" style={{background:"var(--border)"}}/>
            <div id="tour-settings-btn" className="flex items-center gap-1">
              <button onClick={()=>setShowSettings(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all" style={{border:"1px solid var(--border)",background:"var(--bg-elevated)"}}>
                <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:11}} className={provider.color}>{provider.logo}</span>
                <span className="hidden sm:inline text-xs" style={{color:"var(--text-secondary)"}}>{provider.name}</span>
                <span className="text-[10px]" style={{color:"var(--text-faint)"}}>{provider.models.find(m=>m.id===currentModel)?.label}</span>
              </button>
              <button onClick={()=>setShowSettings(true)} className="p-2 rounded-xl transition-all" style={{border:"1px solid var(--border)",color:"var(--text-muted)"}}>
                <Settings size={15}/>
              </button>
            </div>
            <button onClick={startTour} className="p-2 rounded-xl transition-all hidden md:flex" style={{color:"var(--text-muted)"}} title="Replay Tour">
              <PlayCircle size={15}/>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {showHistory&&(
          <HistoryPanel sessions={sessions} currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession}
            onNewSession={handleNewSession} onClose={()=>setShowHistory(false)}/>
        )}
        <main className="flex-1 overflow-hidden">
          <ChatInterface key={currentSessionId} language={settings.language} trackProgress={settings.trackProgress}
            activeProvider={settings.activeProvider}
            apiKey={settings.apiKeys[settings.activeProvider]||(settings.activeProvider==="gemini"?(process.env.GEMINI_API_KEY||""):"")}
            geminiKey={settings.apiKeys["gemini"]||process.env.GEMINI_API_KEY||""}
            selectedModel={currentModel} sarvamKey={settings.sarvamKey}
            googleTranslateKey={settings.googleTranslateKey} initialMessages={currentMessages}
            sessionId={currentSessionId} selectedSources={selectedSources}
            onSessionUpdate={handleSessionUpdate} onNewSession={handleNewSession}
            onSaveNote={handleSaveNote}/>
        </main>
        {showSources && (
          <SourcesPanel 
            sources={sources}
            selectedSourceIds={selectedSourceIds}
            contextLimit={contextLimit}
            onSelectSource={(id) => setSelectedSourceIds(prev => [...prev, id])}
            onDeselectSource={(id) => setSelectedSourceIds(prev => prev.filter(sid => sid !== id))}
            onAddSource={handleAddSource}
            onDeleteSource={handleDeleteSource}
            onClose={() => setShowSources(false)}
          />
        )}
        {showNotes && (
          <NotesPanel 
            notes={notes}
            onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
            onClose={() => setShowNotes(false)}
          />
        )}
      </div>

      {/* Settings Drawer */}
      {showSettings&&(
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)"}} onClick={()=>setShowSettings(false)}/>
          <div className="w-[400px] flex flex-col h-full" style={{background:"var(--bg-surface)",borderLeft:"1px solid var(--border)"}}>
            <div className="flex items-center justify-between px-6 py-5" style={{borderBottom:"1px solid var(--border)"}}>
              <h2 style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)",letterSpacing:"-0.02em"}}>Settings</h2>
              <button onClick={()=>setShowSettings(false)} className="opacity-50 hover:opacity-100 transition-opacity" style={{color:"var(--text-primary)"}}><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* AI Providers */}
              <section>
                <p className="mb-3" style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:10,color:"var(--text-muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                  AI Provider & Model
                </p>
                <div className="space-y-2">
                  {AI_PROVIDERS.map(p=>{
                    const isActive=settings.activeProvider===p.id;
                    const isExpanded=expandedProvider===p.id;
                    const key=settings.apiKeys[p.id]||"";
                    const model=settings.selectedModels[p.id];
                    return(
                      <div key={p.id} className="rounded-2xl overflow-hidden transition-all" style={{border:`1px solid ${isActive?"rgba(91,188,255,0.22)":"var(--border)"}`,background:isActive?"rgba(91,188,255,0.05)":"var(--bg-elevated)"}}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button onClick={()=>updateSetting("activeProvider",p.id)} className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all" style={{borderColor:isActive?"var(--blue)":"var(--border-md)",background:isActive?"var(--blue-dim)":"transparent"}}>
                            {isActive&&<div className="w-1.5 h-1.5 rounded-full" style={{background:"var(--blue)"}}/>}
                          </button>
                          <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={()=>{updateSetting("activeProvider",p.id);setExpandedProvider(isExpanded?null:p.id);}}>
                            <span className={`text-sm font-bold w-5 text-center ${p.color}`} style={{fontFamily:"var(--font-display)"}}>{p.logo}</span>
                            <span className="text-sm font-medium" style={{color:"var(--text-primary)"}}>{p.name}</span>
                            {key&&<span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{color:"var(--blue)",background:"var(--blue-dim)",border:"1px solid var(--blue-border)"}}>✓ key</span>}
                            {p.corsNote&&<span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{color:"var(--yellow)",background:"var(--yellow-dim)"}}>⚠ proxy</span>}
                          </div>
                          <button onClick={()=>setExpandedProvider(isExpanded?null:p.id)} className="opacity-40 hover:opacity-80 transition-opacity" style={{color:"var(--text-primary)"}}>
                            {isExpanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                          </button>
                        </div>
                        {isExpanded&&(
                          <div className="px-4 pb-4 pt-3 space-y-3" style={{borderTop:"1px solid var(--border)"}}>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px]" style={{color:"var(--text-muted)"}}>API Key</span>
                                <a href={p.keyLink} target="_blank" rel="noreferrer" className={`text-[10px] underline ${p.color}`}>{p.keyLinkLabel}</a>
                              </div>
                              <PasswordInput value={key} onChange={v=>updateSetting("apiKeys",{...settings.apiKeys,[p.id]:v})} placeholder={p.keyPlaceholder} hasValue={!!key}/>
                              <p className="text-[10px] mt-1" style={{color:"var(--text-faint)"}}>{p.keyHint}</p>
                              {p.corsNote&&<p className="text-[10px] mt-1" style={{color:"var(--yellow)"}}>{p.corsNote}</p>}
                            </div>
                            <div>
                              <span className="text-[11px] block mb-1.5" style={{color:"var(--text-muted)"}}>Model</span>
                              <div className="space-y-1">
                                {p.models.map(m=>(
                                  <button key={m.id} onClick={()=>updateSetting("selectedModels",{...settings.selectedModels,[p.id]:m.id})}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all"
                                    style={{border:`1px solid ${model===m.id?"rgba(91,188,255,0.25)":"var(--border)"}`,background:model===m.id?"var(--blue-dim)":"var(--bg-card)",color:model===m.id?"var(--blue)":"var(--text-secondary)"}}>
                                    <span className="text-xs font-medium">{m.label}</span>
                                    <div className="flex items-center gap-1">
                                      <span style={{color:"var(--text-faint)",fontSize:10}}>{m.description}</span>
                                      {m.fast&&<span className="text-[9px] px-1.5 py-0.5 rounded" style={{color:"var(--blue)",background:"var(--blue-dim)"}}>fast</span>}
                                      {m.smart&&<span className="text-[9px] px-1.5 py-0.5 rounded" style={{color:"var(--periwinkle)",background:"var(--periwinkle-dim)"}}>smart</span>}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <div style={{borderTop:"1px solid var(--border)"}}/>

              {/* Language */}
              <section>
                <p className="mb-3" style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:10,color:"var(--text-muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Response Language</p>
                <select value={settings.language} onChange={e=>updateSetting("language",e.target.value)}
                  className="w-full text-sm rounded-xl px-4 py-2.5 outline-none"
                  style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",color:"var(--text-primary)",fontFamily:"var(--font-body)"}}>
                  {["English","Hindi","Tamil","Telugu","Kannada","Bengali","Marathi","Malayalam","Gujarati","Punjabi","French","Spanish","German","Arabic","Japanese","Chinese"].map(l=>(
                    <option key={l} value={l} style={{background:"var(--bg-elevated)"}}>{l}</option>
                  ))}
                </select>
                {settings.language!=="English"&&<p className="text-[10px] mt-2" style={{color:"var(--text-faint)"}}>Indian languages → Sarvam API · Others → Google Translate</p>}
              </section>

              {/* Progress Tracking */}
              <section>
                <p className="mb-3" style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:10,color:"var(--text-muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Session Progress</p>
                <div onClick={()=>updateSetting("trackProgress",!settings.trackProgress)}
                  className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all"
                  style={{border:`1px solid ${settings.trackProgress?"rgba(91,188,255,0.22)":"var(--border)"}`,background:settings.trackProgress?"var(--blue-dim)":"var(--bg-elevated)"}}>
                  <div>
                    <p className="text-sm font-medium" style={{color:"var(--text-primary)"}}>{settings.trackProgress?"Enabled":"Disabled"}</p>
                    <p className="text-[11px] mt-0.5" style={{color:"var(--text-muted)"}}>Track topics, scores & weak areas</p>
                  </div>
                  <div className="w-11 h-6 rounded-full flex items-center px-1 transition-all" style={{background:settings.trackProgress?"var(--blue)":"rgba(255,255,255,0.1)"}}>
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm transition-all" style={{transform:settings.trackProgress?"translateX(20px)":"translateX(0)"}}/>
                  </div>
                </div>
              </section>

              {/* Translation Keys */}
              <section>
                <p className="mb-3" style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:10,color:"var(--text-muted)",letterSpacing:"0.1em",textTransform:"uppercase"}}>Translation API Keys</p>
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] block mb-1.5" style={{color:"var(--text-muted)"}}>Sarvam <span style={{color:"var(--text-faint)"}}>(Indian languages)</span></span>
                    <PasswordInput value={settings.sarvamKey} onChange={v=>updateSetting("sarvamKey",v)} placeholder="sk-sarvam-..." hasValue={!!settings.sarvamKey}/>
                  </div>
                  <div>
                    <span className="text-[11px] block mb-1.5" style={{color:"var(--text-muted)"}}>Google Translate <span style={{color:"var(--text-faint)"}}>(other languages)</span></span>
                    <PasswordInput value={settings.googleTranslateKey} onChange={v=>updateSetting("googleTranslateKey",v)} placeholder="AIza..." hasValue={!!settings.googleTranslateKey}/>
                  </div>
                </div>
              </section>

              <div className="p-4 rounded-2xl" style={{background:"var(--blue-dim)",border:"1px solid var(--blue-border)"}}>
                <p className="text-[11px] leading-relaxed" style={{color:"var(--text-muted)"}}>
                  🔒 All keys are stored locally in your browser — nothing is sent to any server except directly to your chosen AI provider.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function genSessionId() { return `session-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
