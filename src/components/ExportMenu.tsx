import { useState, useRef, useEffect } from "react";
import { Download, FileText, File, BookOpen, Loader2 } from "lucide-react";
import type { Mode } from "../types";
import { exportMarkdown, exportText, exportPDF, exportDocx } from "../utils/export";

interface Props { text: string; mode: Mode; model?: string; title?: string; }

const FORMATS = [
  { id:"pdf",  label:"PDF",           icon:<File size={11}/>,     desc:"Formatted & printable",  color:"var(--pink)" },
  { id:"docx", label:"Word (.docx)",  icon:<BookOpen size={11}/>, desc:"Microsoft Word",          color:"var(--blue)" },
  { id:"md",   label:"Markdown (.md)",icon:<FileText size={11}/>, desc:"For notes & GitHub",      color:"var(--periwinkle)" },
  { id:"txt",  label:"Plain Text",    icon:<FileText size={11}/>, desc:"Simple & universal",      color:"var(--text-muted)" },
] as const;

export default function ExportMenu({ text, mode, title }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleExport(format: string) {
    setLoading(format);
    try {
      if (format === "md") exportMarkdown(text, mode, title, model);
      else if (format === "txt") exportText(text, mode, model);
      else if (format === "pdf") await exportPDF(text, mode, title, model);
      else if (format === "docx") await exportDocx(text, mode, title, model);
      setDone(format);
      setTimeout(() => { setDone(null); setOpen(false); }, 1500);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all hover:bg-white/5"
        style={{color:"var(--text-muted)",background:"transparent"}}>
        <Download size={11}/> Export
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl overflow-hidden z-20 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{background:"var(--bg-card)",border:"1px solid var(--border-md)",boxShadow:"0 12px 48px rgba(0,0,0,0.5)"}}>
          <div className="px-3 py-2.5" style={{borderBottom:"1px solid var(--border)"}}>
            <p style={{color:"var(--text-faint)",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"var(--font-display)",fontWeight:700}}>Export block as</p>
          </div>
          {FORMATS.map(fmt => (
            <button key={fmt.id} onClick={() => handleExport(fmt.id)} disabled={loading === fmt.id}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/5 group">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" 
                style={{background:done===fmt.id?"var(--blue-dim)":"rgba(255,255,255,0.03)"}}>
                <span style={{color: done===fmt.id?"var(--blue)":fmt.color}}>
                  {loading === fmt.id ? <Loader2 size={12} className="animate-spin"/> : fmt.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold transition-colors group-hover:text-white" style={{color:done===fmt.id?"var(--blue)":"var(--text-secondary)",fontFamily:"var(--font-body)"}}>
                  {done === fmt.id ? "✓ Ready!" : fmt.label}
                </p>
                <p style={{color:"var(--text-faint)",fontSize:9.5,fontFamily:"var(--font-body)"}}>{fmt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
