import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Editor } from "@/components/Editor";
import { getProject, upsertProject, type Project, type Slide } from "@/lib/storage";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor visual — InLabs.Ai" }] }),
  component: EditorPage,
});

function EditorPage() {
  const { id } = useParams({ from: "/editor/$id" });
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    const current = getProject(id);
    if (!current) {
      toast.error("Projeto não encontrado.");
      nav({ to: "/projetos", replace: true });
      return;
    }
    setProject(current);
  }, [id, nav]);

  const slide = project?.slides[active];
  const editorKey = useMemo(() => `${id}-${active}`, [active, id]);

  if (!project || !slide) return <AppShell><div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Carregando editor...</div></AppShell>;

  function commit(next: Project) {
    setProject(next);
    upsertProject(next);
    setSaved(true);
  }

  function updateSlide(canvas: unknown, thumb: string) {
    const slides = project.slides.slice();
    slides[active] = { ...slides[active], canvas, thumb };
    setSaved(false);
    commit({ ...project, slides });
  }

  function addSlide() {
    const base: Slide = { id: crypto.randomUUID(), width: slide.width, height: slide.height, canvas: { elements: [], background: "#111424" } };
    const next = { ...project, slides: [...project.slides, base] };
    commit(next);
    setActive(next.slides.length - 1);
  }

  function duplicateSlide() {
    const copy: Slide = { ...slide, id: crypto.randomUUID() };
    const slides = [...project.slides];
    slides.splice(active + 1, 0, copy);
    commit({ ...project, slides });
    setActive(active + 1);
  }

  function deleteSlide() {
    if (project.slides.length <= 1) {
      toast.error("O projeto precisa ter pelo menos uma página.");
      return;
    }
    const slides = project.slides.filter((_, index) => index !== active);
    commit({ ...project, slides });
    setActive(Math.max(0, active - 1));
  }

  function exportCurrent() {
    const canvas = document.querySelector<HTMLCanvasElement>(".upper-canvas") || document.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) {
      toast.error("Canvas indisponível.");
      return;
    }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${project.name || "projeto"}-${String(active + 1).padStart(2, "0")}.png`;
    link.click();
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-76px)] min-h-[620px] flex-col bg-[#080b14]">
        <header className="flex min-h-[66px] items-center gap-3 border-b border-border bg-card/90 px-3 sm:px-5">
          <Link to="/projetos" className="rounded-xl p-2 text-muted-foreground hover:bg-white/5 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">{project.type}</div>
            <input value={project.name} onChange={(e) => { setSaved(false); setProject({ ...project, name: e.target.value }); }} onBlur={() => commit(project)} className="w-full truncate bg-transparent text-sm font-semibold outline-none sm:text-base" />
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">{saved ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Salvo automaticamente</> : <><Save className="h-3.5 w-3.5" /> Salvando...</>}</div>
          <button onClick={() => commit(project)} className="secondary-button px-3 py-2 text-xs"><Save className="h-3.5 w-3.5" /> Salvar</button>
          <button onClick={exportCurrent} className="primary-button px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" /> Exportar</button>
        </header>

        <div className="flex min-h-0 flex-1">
          {project.type === "carrossel" && (
            <aside className="hidden w-40 shrink-0 flex-col border-r border-border bg-[#0b0e19] md:flex">
              <div className="flex items-center justify-between border-b border-border px-3 py-3"><span className="text-xs font-semibold">Páginas</span><button onClick={addSlide} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-white"><Plus className="h-4 w-4" /></button></div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {project.slides.map((item, index) => (
                  <button key={item.id} onClick={() => setActive(index)} className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 bg-secondary ${active === index ? "border-primary shadow-[0_0_0_3px_rgba(139,92,246,.12)]" : "border-transparent hover:border-border"}`}>
                    {item.thumb ? <img src={item.thumb} alt={`Página ${index + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>}
                    <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">{String(index + 1).padStart(2, "0")}</span>
                  </button>
                ))}
                <button onClick={addSlide} className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border p-3"><button onClick={duplicateSlide} title="Duplicar página" className="secondary-button px-2 py-2"><Copy className="h-4 w-4" /></button><button onClick={deleteSlide} title="Excluir página" className="inline-flex items-center justify-center rounded-xl border border-destructive/25 bg-destructive/8 p-2 text-destructive hover:bg-destructive/15"><Trash2 className="h-4 w-4" /></button></div>
            </aside>
          )}

          <div className="min-w-0 flex-1"><Editor key={editorKey} width={slide.width} height={slide.height} initial={slide.canvas as never} onChange={updateSlide} /></div>
        </div>

        {project.type === "carrossel" && (
          <div className="flex gap-2 overflow-x-auto border-t border-border bg-card p-2 md:hidden">
            {project.slides.map((item, index) => <button key={item.id} onClick={() => setActive(index)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-secondary ${active === index ? "border-primary" : "border-transparent"}`}>{item.thumb ? <img src={item.thumb} alt={`Página ${index + 1}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs text-muted-foreground">{index + 1}</span>}</button>)}
            <button onClick={addSlide} className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-border"><Plus className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
