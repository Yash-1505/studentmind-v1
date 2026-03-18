import { useState, useRef } from "react";
import { X, FileText, Trash2, Plus, Search, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { SourceFile } from "../types";

interface Props {
  sources: SourceFile[];
  selectedSourceIds: string[];
  contextLimit: number;
  onSelectSource: (id: string) => void;
  onDeselectSource: (id: string) => void;
  onAddSource: (file: File) => void;
  onDeleteSource: (id: string) => void;
  onClose: () => void;
}

export default function SourcesPanel({
  sources,
  selectedSourceIds,
  contextLimit,
  onSelectSource,
  onDeselectSource,
  onAddSource,
  onDeleteSource,
  onClose
}: Props) {
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = sources
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddSource(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectedSources = sources.filter(s => selectedSourceIds.includes(s.id));
  const totalSelectedSize = selectedSources.reduce((acc, s) => acc + s.size, 0);
  const isOverLimit = totalSelectedSize > contextLimit;
  const usagePercent = Math.min((totalSelectedSize / contextLimit) * 100, 100);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300" 
      style={{width:320, background:"var(--bg-surface)", borderLeft:"1px solid var(--border)", flexShrink:0}}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:"var(--blue-dim)"}}>
            <FileText size={14} style={{color:"var(--blue)"}}/>
          </div>
          <div>
            <h2 style={{fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--text-primary)", letterSpacing:"-0.01em"}}>Sources</h2>
            <p style={{fontSize:10, color:"var(--text-faint)", textTransform:"uppercase", letterSpacing:"0.05em"}}>{sources.length}/100 Files Available</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors" style={{color:"var(--text-muted)"}}>
          <X size={16}/>
        </button>
      </div>

      {/* Add Source & Search */}
      <div className="px-5 py-4 space-y-3" style={{borderBottom:"1px solid var(--border)"}}>
        <button onClick={() => fileInputRef.current?.click()}
          disabled={sources.length >= 100}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-semibold transition-all hover:scale-[0.98] active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          style={{background: sources.length >= 100 ? "var(--bg-elevated)" : "var(--blue)", color: sources.length >= 100 ? "var(--text-muted)" : "white", boxShadow: sources.length >= 100 ? "none" : "0 4px 12px var(--blue-glow)"}}>
          <Plus size={14}/> {sources.length >= 100 ? "Storage Full" : "Add New Source"}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} 
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.docx,.csv"/>
        
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"var(--bg-elevated)", border:"1px solid var(--border)"}}>
          <Search size={12} style={{color:"var(--text-muted)", flexShrink:0}}/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{color:"var(--text-secondary)", fontFamily:"var(--font-body)"}}/>
        </div>
      </div>

      {/* Selected Info & Context Usage */}
      {selectedSourceIds.length > 0 && (
        <div className="px-5 py-3 space-y-2" style={{background:"var(--bg-elevated)", borderBottom:"1px solid var(--border)"}}>
          <div className="flex items-center justify-between">
            <span style={{color: isOverLimit ? "#ff6b6b" : "var(--blue)", fontSize:11, fontWeight:600}}>
              {isOverLimit ? "Context Limit Exceeded" : `${selectedSourceIds.length} Selected`}
            </span>
            <button onClick={() => selectedSourceIds.forEach(id => onDeselectSource(id))} 
              className="text-[10px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity" 
              style={{color:"var(--blue)"}}>Clear All</button>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]" style={{color:"var(--text-faint)"}}>
              <span>Context Usage</span>
              <span style={{color: isOverLimit ? "#ff6b6b" : "var(--text-muted)"}}>{formatSize(totalSelectedSize)} / {formatSize(contextLimit)}</span>
            </div>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{background:"var(--bg-card)"}}>
              <div className="h-full transition-all duration-500" 
                style={{
                  width: `${usagePercent}%`, 
                  background: isOverLimit ? "linear-gradient(90deg, #ff6b6b, #ff4d4d)" : "linear-gradient(90deg, var(--blue), var(--periwinkle))"
                }}/>
            </div>
          </div>

          {isOverLimit && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20 mt-2">
              <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0"/>
              <div className="space-y-1">
                <p style={{fontSize:10, color:"#ff8080", lineHeight:1.4}}>
                  Selected files are quite large!
                </p>
                <p style={{fontSize:9, color:"var(--text-faint)", lineHeight:1.4}}>
                  Don't worry — we'll automatically extract and send only the most relevant sections (Local Indexing active).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center opacity-40">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:"var(--bg-elevated)"}}>
              <FileText size={20} style={{color:"var(--text-muted)"}}/>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{color:"var(--text-secondary)"}}>No sources yet</p>
              <p className="text-[11px] mt-1">Upload files to use them as context for your tasks.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(file => {
              const isSelected = selectedSourceIds.includes(file.id);
              return (
                <div key={file.id} 
                  onClick={() => isSelected ? onDeselectSource(file.id) : onSelectSource(file.id)}
                  className="group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200"
                  style={{
                    background: isSelected ? "rgba(91,188,255,0.08)" : "transparent",
                    border: `1px solid ${isSelected ? "var(--blue-border)" : "transparent"}`
                  }}>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" 
                      style={{background: isSelected ? "var(--blue-dim)" : "var(--bg-elevated)"}}>
                      <FileText size={18} style={{color: isSelected ? "var(--blue)" : "var(--text-muted)"}}/>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 bg-white rounded-full text-[var(--blue)]">
                        <CheckCircle2 size={12} fill="currentColor" className="text-white bg-[var(--blue)] rounded-full"/>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold truncate transition-colors" 
                      style={{color: isSelected ? "var(--text-primary)" : "var(--text-secondary)"}}>{file.name}</p>
                    <p className="text-[10px] mt-0.5" style={{color:"var(--text-faint)"}}>
                      {formatSize(file.size)} • {file.type.split("/")[1]?.toUpperCase() || "FILE"}
                    </p>
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); onDeleteSource(file.id); }}
                    className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-400"
                    style={{color:"var(--text-muted)"}}>
                    <Trash2 size={14}/>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-4" style={{borderTop:"1px solid var(--border)", background:"rgba(255,255,255,0.02)"}}>
        <div className="flex items-start gap-2.5">
          <AlertCircle size={12} style={{color:"var(--text-muted)", marginTop:2}}/>
          <p style={{fontSize:10, color:"var(--text-muted)", lineHeight:1.5}}>
            Context is minimized automatically using local semantic search indexing. Max 100 files allowed.
          </p>
        </div>
      </div>
    </div>
  );
}
