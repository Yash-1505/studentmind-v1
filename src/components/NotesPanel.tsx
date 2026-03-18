import { useState } from "react";
import { X, Bookmark, Trash2, Search, ExternalLink, Calendar, MessageSquare } from "lucide-react";
import type { SavedNote } from "../types";

interface Props {
  notes: SavedNote[];
  onDeleteNote: (id: string) => void;
  onClose: () => void;
}

export default function NotesPanel({ notes, onDeleteNote, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = notes
    .filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300" 
      style={{width:320, background:"var(--bg-surface)", borderLeft:"1px solid var(--border)", flexShrink:0}}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"var(--periwinkle-dim)"}}>
            <Bookmark size={14} style={{color:"var(--periwinkle)"}}/>
          </div>
          <div>
            <h2 style={{fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--text-primary)", letterSpacing:"-0.01em"}}>Saved Notes</h2>
            <p style={{fontSize:10, color:"var(--text-faint)", textTransform:"uppercase", letterSpacing:"0.05em"}}>{notes.length} pinned items</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors" style={{color:"var(--text-muted)"}}>
          <X size={16}/>
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-4" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"var(--bg-elevated)", border:"1px solid var(--border)"}}>
          <Search size={12} style={{color:"var(--text-muted)", flexShrink:0}}/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search saved topics…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{color:"var(--text-secondary)", fontFamily:"var(--font-body)"}}/>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center opacity-40">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:"var(--bg-elevated)"}}>
              <Bookmark size={20} style={{color:"var(--text-muted)"}}/>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{color:"var(--text-secondary)"}}>No saved notes</p>
              <p className="text-[11px] mt-1">Pin important AI responses to see them here later.</p>
            </div>
          </div>
        ) : (
          filtered.map(note => (
            <div key={note.id} className="group flex flex-col gap-2 p-4 rounded-2xl transition-all hover:bg-white/[0.02]"
              style={{background:"var(--bg-card)", border:"1px solid var(--border)"}}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{background:"var(--blue-dim)", color:"var(--blue)"}}>
                    {note.mode.split(' ')[0]}
                  </span>
                  <p className="text-[13px] font-bold truncate text-[var(--text-primary)]" style={{fontFamily:"var(--font-display)"}}>{note.title}</p>
                </div>
                <button onClick={() => onDeleteNote(note.id)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400"
                  style={{color:"var(--text-muted)"}}>
                  <Trash2 size={13}/>
                </button>
              </div>

              <div className="text-[11.5px] line-clamp-3 leading-relaxed opacity-70 overflow-hidden" style={{color:"var(--text-secondary)"}}>
                {note.content.replace(/[#*`]/g, '')}
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-faint)]">
                    {note.model.split('/').pop()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-[var(--text-faint)]">
                  <Calendar size={10}/>
                  {new Date(note.savedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
