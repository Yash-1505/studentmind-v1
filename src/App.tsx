import { useState, useEffect, useCallback } from "react";
import ChatInterface, { makeWelcome } from "./components/ChatInterface";
import HistoryPanel from "./components/HistoryPanel";
import { Settings, X, GraduationCap, ChevronDown, ChevronUp, Eye, EyeOff, History } from "lucide-react";
import { Mode, type AIProvider, type Session, type AppSettings, type ChatMessage } from "./types";
import { saveSettings, loadSettings, saveSessions, loadSessions, saveCurrentSessionId, loadCurrentSessionId, deleteSession } from "./utils/storage";

const AI_PROVIDERS: AIProvider[] = [
  {
    id:"gemini", name:"Google Gemini", logo:"G", color:"text-[#5BBCFF]", bgColor:"bg-[rgba(91,188,255,0.08)]", borderColor:"border-[rgba(91,188,255,0.22)]",
    keyPlaceholder:"AIza...", keyHint:"Free tier available", keyLink:"https://aistudio.google.com", keyLinkLabel:"aistudio.google.com → Get API Key",
    models:[{id:"gemini-2.5-flash",label:"Gemini 2.5 Flash",description:"Fast & efficient",fast:true},{id:"gemini-2.5-pro",label:"Gemini 2.5 Pro",description:"Most capable",smart:true}],
  },
  {
    id:"openai", name:"OpenAI", logo:"⬡", color:"text-[#a8f0c6]", bgColor:"bg-[rgba(168,240,198,0.08)]", borderColor:"border-[rgba(168,240,198,0.2)]",
    keyPlaceholder:"sk-proj-...", keyHint:"Paid usage required", keyLink:"https://platform.openai.com/api-keys", keyLinkLabel:"platform.openai.com → API Keys",
    models:[{id:"gpt-4o-mini",label:"GPT-4o Mini",description:"Fast & affordable",fast:true},{id:"gpt-4o",label:"GPT-4o",description:"Most capable",smart:true},{id:"gpt-4-turbo",label:"GPT-4 Turbo",description:"High performance"}],
  },
  {
    id:"groq", name:"Groq", logo:"▲", color:"text-[#FFFAB7]", bgColor:"bg-[rgba(255,250,183,0.07)]", borderColor:"border-[rgba(255,250,183,0.2)]",
    keyPlaceholder:"gsk_...", keyHint:"Free tier — extremely fast", keyLink:"https://console.groq.com/keys", keyLinkLabel:"console.groq.com → API Keys",
    models:[{id:"llama-3.3-70b-versatile",label:"Llama 3.3 70B",description:"Best open model",smart:true},{id:"llama-3.1-8b-instant",label:"Llama 3.1 8B",description:"Fastest response",fast:true},{id:"mixtral-8x7b-32768",label:"Mixtral 8x7B",description:"Balanced"},{id:"gemma2-9b-it",label:"Gemma 2 9B",description:"Google open model"}],
  },
  {
    id:"mistral", name:"Mistral AI", logo:"M", color:"text-[#FFD1E3]", bgColor:"bg-[rgba(255,209,227,0.07)]", borderColor:"border-[rgba(255,209,227,0.2)]",
    keyPlaceholder:"...", keyHint:"Strong multilingual support", keyLink:"https://console.mistral.ai/api-keys", keyLinkLabel:"console.mistral.ai → API Keys",
    models:[{id:"mistral-small-latest",label:"Mistral Small",description:"Fast & cheap",fast:true},{id:"mistral-medium-latest",label:"Mistral Medium",description:"Balanced"},{id:"mistral-large-latest",label:"Mistral Large",description:"Most capable",smart:true}],
  },
  {
    id:"anthropic", name:"Anthropic Claude", logo:"◇", color:"text-[#7EA1FF]", bgColor:"bg-[rgba(126,161,255,0.08)]", borderColor:"border-[rgba(126,161,255,0.22)]",
    keyPlaceholder:"sk-ant-...", keyHint:"Paid usage required", keyLink:"https://console.anthropic.com/keys", keyLinkLabel:"console.anthropic.com → API Keys",
    corsNote:"Direct browser calls blocked by Anthropic CORS — needs a backend proxy",
    models:[{id:"claude-3-5-haiku-20241022",label:"Claude 3.5 Haiku",description:"Fast & affordable",fast:true},{id:"claude-3-5-sonnet-20241022",label:"Claude 3.5 Sonnet",description:"Best complex tasks",smart:true},{id:"claude-3-opus-20240229",label:"Claude 3 Opus",description:"Most intelligent"}],
  },
  {
    id:"cohere", name:"Cohere", logo:"Co", color:"text-[#FFD1E3]", bgColor:"bg-[rgba(255,209,227,0.07)]", borderColor:"border-[rgba(255,209,227,0.2)]",
    keyPlaceholder:"...", keyHint:"Free trial available", keyLink:"https://dashboard.cohere.com/api-keys", keyLinkLabel:"dashboard.cohere.com → API Keys",
    models:[{id:"command-r-plus-08-2024",label:"Command R+",description:"Best for study & RAG",smart:true},{id:"command-r-08-2024",label:"Command R",description:"Fast & efficient",fast:true}],
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
  selectedModels:{gemini:"gemini-2.5-flash",openai:"gpt-4o-mini",groq:"llama-3.3-70b-versatile",mistral:"mistral-small-latest",anthropic:"claude-3-5-haiku-20241022",cohere:"command-r-08-2024"},
  apiKeys:{},language:"English",trackProgress:false,sarvamKey:"",googleTranslateKey:"",
};

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string|null>("gemini");

  const saved = loadSettings();
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS, ...saved });
  const [sessions, setSessions] = useState<Session[]>(loadSessions());
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

  const updateSetting = <K extends keyof AppSettings>(key:K, value:AppSettings[K]) =>
    setSettings(prev=>({...prev,[key]:value}));

  const handleSessionUpdate = useCallback((messages: ChatMessage[]) => {
    setCurrentMessages(messages);
    setSessions(prev => {
      const existing = prev.find(s=>s.id===currentSessionId);
      const title = messages.find(m=>m.sender==="user")?.text?.slice(0,60) || "New Session";
      const updated: Session = { id:currentSessionId, title, messages, provider:settings.activeProvider,
        model:settings.selectedModels[settings.activeProvider],
        createdAt:existing?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString() };
      return [...prev.filter(s=>s.id!==currentSessionId), updated];
    });
  }, [currentSessionId, settings.activeProvider, settings.selectedModels]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(genSessionId()); setCurrentMessages([makeWelcome()]); setShowHistory(false);
  }, []);

  const handleSelectSession = useCallback((session: Session) => {
    setCurrentSessionId(session.id); setCurrentMessages(session.messages); setShowHistory(false);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => deleteSession(prev, id));
    if(id === currentSessionId) handleNewSession();
  }, [currentSessionId, handleNewSession]);

  const provider = AI_PROVIDERS.find(p=>p.id===settings.activeProvider)!;
  const currentModel = settings.selectedModels[settings.activeProvider];

  return (
    <div className="min-h-screen flex flex-col" style={{background:"var(--bg-base)",fontFamily:"var(--font-body)"}}>

      {/* Header */}
      <header style={{borderBottom:"1px solid var(--border)",background:"rgba(7,7,14,0.9)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",position:"sticky",top:0,zIndex:40}}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={()=>setShowHistory(!showHistory)} title="Chat history" className="p-2 rounded-xl transition-all" style={{border:`1px solid ${showHistory?"rgba(91,188,255,0.3)":"var(--border)"}`,background:showHistory?"var(--blue-dim)":"transparent",color:showHistory?"var(--blue)":"var(--text-muted)"}}>
              <History size={15}/>
            </button>
            <div className="flex items-center gap-2.5">
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
            <button onClick={()=>setShowSettings(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all" style={{border:"1px solid var(--border)",background:"var(--bg-elevated)"}}>
              <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:11}} className={provider.color}>{provider.logo}</span>
              <span className="hidden sm:inline text-xs" style={{color:"var(--text-secondary)"}}>{provider.name}</span>
              <span className="text-[10px]" style={{color:"var(--text-faint)"}}>{provider.models.find(m=>m.id===currentModel)?.label}</span>
            </button>
            <button onClick={()=>setShowSettings(true)} className="p-2 rounded-xl transition-all" style={{border:"1px solid var(--border)",color:"var(--text-muted)"}}>
              <Settings size={15}/>
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
          <ChatInterface language={settings.language} trackProgress={settings.trackProgress}
            activeProvider={settings.activeProvider}
            apiKey={settings.apiKeys[settings.activeProvider]||(settings.activeProvider==="gemini"?(process.env.GEMINI_API_KEY||""):"")}
            selectedModel={currentModel} sarvamKey={settings.sarvamKey}
            googleTranslateKey={settings.googleTranslateKey} initialMessages={currentMessages}
            onSessionUpdate={handleSessionUpdate} onNewSession={handleNewSession}/>
        </main>
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
