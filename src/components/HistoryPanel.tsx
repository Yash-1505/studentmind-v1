import { useState } from "react";
import { X, MessageSquare, Trash2, Clock, Plus, Search } from "lucide-react";
import type { Session } from "../types";

interface Props {
  sessions: Session[];
  currentSessionId: string;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onClose: () => void;
}

export default function HistoryPanel({ sessions, currentSessionId, onSelectSession, onDeleteSession, onNewSession, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = sessions
    .filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function getProviderColor(provider: string): string {
    const colors: Record<string, string> = {
      gemini:"var(--blue)", openai:"#a8f0c6", groq:"var(--yellow)",
      mistral:"var(--pink)", anthropic:"var(--periwinkle)", cohere:"var(--pink)",
    };
    return colors[provider] || "var(--text-muted)";
  }

  function getMessageCount(session: Session): number {
    return session.messages.filter(m => m.sender === "user").length;
  }

  return (
    <div className="flex flex-col h-full" style={{width:290,background:"var(--bg-surface)",borderRight:"1px solid var(--border)",flexShrink:0}}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-2">
          <Clock size={13} style={{color:"var(--text-muted)"}}/>
          <h2 style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)",letterSpacing:"-0.01em"}}>History</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{color:"var(--text-muted)",background:"var(--bg-card)"}}>{sessions.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onNewSession}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all"
            style={{background:"var(--blue-dim)",border:"1px solid var(--blue-border)",color:"var(--blue)",fontFamily:"var(--font-body)"}}>
            <Plus size={11}/> New
          </button>
          <button onClick={onClose} className="p-1.5 opacity-40 hover:opacity-90 transition-opacity" style={{color:"var(--text-primary)"}}>
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"var(--bg-elevated)",border:"1px solid var(--border)"}}>
          <Search size={11} style={{color:"var(--text-muted)",flexShrink:0}}/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sessions…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{color:"var(--text-secondary)",fontFamily:"var(--font-body)"}}/>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{background:"var(--bg-elevated)"}}>
              <MessageSquare size={16} style={{color:"var(--text-faint)"}}/>
            </div>
            <p style={{color:"var(--text-faint)",fontSize:12,fontFamily:"var(--font-body)"}}>
              {search ? "No sessions match your search" : "No sessions yet — start chatting!"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {filtered.map(session => {
              const isActive = session.id === currentSessionId;
              const isDeleting = confirmDelete === session.id;
              return (
                <div key={session.id} className="group relative rounded-xl transition-all duration-150"
                  style={{background:isActive?"var(--bg-elevated)":"transparent",border:`1px solid ${isActive?"var(--border-md)":"transparent"}`}}>
                  {isDeleting ? (
                    <div className="flex items-center gap-2 px-3 py-3">
                      <p style={{color:"var(--text-secondary)",fontSize:11,flex:1,fontFamily:"var(--font-body)"}}>Delete this session?</p>
                      <button onClick={()=>{onDeleteSession(session.id);setConfirmDelete(null);}}
                        style={{color:"#ff7070",fontSize:10,fontFamily:"var(--font-body)",fontWeight:600}}>
                        Delete
                      </button>
                      <button onClick={()=>setConfirmDelete(null)}
                        style={{color:"var(--text-muted)",fontSize:10,fontFamily:"var(--font-body)"}}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>onSelectSession(session)} className="w-full text-left px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-snug line-clamp-2 flex-1"
                          style={{color:isActive?"var(--text-primary)":"var(--text-secondary)",fontFamily:"var(--font-body)"}}>
                          {session.title}
                        </p>
                        <button onClick={e=>{e.stopPropagation();setConfirmDelete(session.id);}}
                          className="opacity-0 group-hover:opacity-100 p-1 transition-all flex-shrink-0 mt-0.5"
                          style={{color:"var(--text-faint)"}}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span style={{fontSize:10,fontWeight:600,color:getProviderColor(session.provider),fontFamily:"var(--font-display)"}}>
                          {session.provider}
                        </span>
                        <span style={{color:"var(--text-faint)"}}>·</span>
                        <span style={{color:"var(--text-faint)",fontSize:10,fontFamily:"var(--font-body)"}}>
                          {getMessageCount(session)} msg{getMessageCount(session)!==1?"s":""}
                        </span>
                        <span style={{color:"var(--text-faint)"}}>·</span>
                        <span style={{color:"var(--text-faint)",fontSize:10,fontFamily:"var(--font-body)"}}>
                          {relativeTime(session.updatedAt)}
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="px-4 py-3 text-center" style={{borderTop:"1px solid var(--border)"}}>
          <p style={{color:"var(--text-faint)",fontSize:10,fontFamily:"var(--font-body)"}}>
            {sessions.length}/30 sessions · stored locally
          </p>
        </div>
      )}
    </div>
  );
}
