import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { generateInstagramContent, updateSlide, testXaiConnection, type CarrosselOut } from "@/lib/gemini.functions";
import { generateImage } from "@/lib/ai.functions";
import { composePost } from "@/lib/composePost";
import { getAccessKey, clearAccessKey } from "@/lib/session";
import { Loader2, Sparkles, Wand2, Copy, Check, LogOut, ArrowLeft, Save, Plug, CheckCircle2, XCircle, ImageIcon, Download, Upload, X } from "lucide-react";

export const Route = createFileRoute("/carrossel")({
  head: () => ({ meta: [
    { title: "Gerar Carrossel — InLabs.Ia Studios" },
    { name: "description", content: "Gere carrosséis de Instagram com IA (Grok) a partir de tema, objetivo, público e tom." },
    { property: "og:title", content: "Gerar Carrossel — InLabs.Ia Studios" },
    { property: "og:description", content: "Carrosséis personalizados com Grok da xAI." },
  ]}),
  component: NovoCarrossel,
});

function NovoCarrossel() {
  const nav = useNavigate();
  const gen = useServerFn(generateInstagramContent);
  const save = useServerFn(updateSlide);
  const test = useServerFn(testXaiConnection);
  const [accessKey, setKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const k = getAccessKey();
    if (!k) { nav({ to: "/acesso" }); return; }
    setKey(k);
  }, [nav]);

  const [form, setForm] = useState({
    tema: "",
    objetivo: "",
    publicoAlvo: "",
    tom: "profissional",
    quantidadeSlides: 5,
    informacoesAdicionais: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CarrosselOut | null>(null);

  const genImgTop = useServerFn(generateImage);
  const [autoImgs, setAutoImgs] = useState<Record<number, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !accessKey) return;
    if (form.tema.trim().length < 3) { toast.error("O tema deve ter pelo menos 3 caracteres."); return; }
    setBusy(true);
    setAutoImgs({});
    try {
      const out = await gen({ data: { ...form, accessKey } });
      setResult(out);
      toast.success("Textos prontos! Gerando imagens...");
      await Promise.all(out.slides.map(async (s) => {
        try {
          const seed = `${out.id}-${s.numero}`;
          const r = await genImgTop({ data: {
            prompt: s.promptImagem,
            seed,
            style: `${form.tom}, tema: ${form.tema}`,
          }});
          const composed = await composePost({ background: r.dataUrl, title: s.titulo, body: s.texto });
          setAutoImgs(prev => ({ ...prev, [s.numero]: composed }));
        } catch (err) {
          console.error(`Falha imagem slide ${s.numero}`, err);
          toast.error(`Falha na imagem do slide ${s.numero}`);
        }
      }));
      toast.success("Carrossel completo!");
    } catch (err) {
      toast.error((err as Error).message || "Erro inesperado.");
    } finally { setBusy(false); }
  }

  function logout() {
    clearAccessKey();
    nav({ to: "/acesso" });
  }

  async function runTest() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await test();
      setTestResult({ ok: r.ok, message: r.message });
      if (r.ok) toast.success("Grok conectada"); else toast.error(r.message);
    } catch (e) {
      const msg = (e as Error).message || "Falha ao testar.";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally { setTesting(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground">
            <ArrowLeft className="w-4 h-4"/> Voltar
          </Link>
          <div className="text-sm font-display font-bold">InLabs.Ia Studios</div>
          <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <LogOut className="w-3 h-3"/> Sair
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
          <Sparkles className="w-3 h-3"/> Novo carrossel Grok
        </div>
        <h1 className="text-3xl font-display font-bold mb-6">Descreva sua ideia</h1>

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <Field label="Tema do post">
            <textarea required value={form.tema} onChange={e=>setForm({...form, tema: e.target.value})} rows={3}
              placeholder="Ex: 5 hábitos para produtividade de manhã"
              className="w-full bg-input rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-primary"/>
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Objetivo">
              <input value={form.objetivo} onChange={e=>setForm({...form, objetivo: e.target.value})}
                placeholder="Ex: gerar leads, educar, engajar"
                className="w-full bg-input rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-primary"/>
            </Field>
            <Field label="Público-alvo">
              <input value={form.publicoAlvo} onChange={e=>setForm({...form, publicoAlvo: e.target.value})}
                placeholder="Ex: empreendedores 25-40"
                className="w-full bg-input rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-primary"/>
            </Field>
            <Field label="Tom de comunicação">
              <select value={form.tom} onChange={e=>setForm({...form, tom: e.target.value})}
                className="w-full bg-input rounded-lg p-2.5 text-sm">
                {["profissional","descontraído","inspiracional","educativo","direto","divertido","autoritário"].map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label={`Slides: ${form.quantidadeSlides}`}>
              <input type="range" min={3} max={10} value={form.quantidadeSlides}
                onChange={e=>setForm({...form, quantidadeSlides: +e.target.value})} className="w-full"/>
            </Field>
          </div>
          <Field label="Informações adicionais (opcional)">
            <textarea value={form.informacoesAdicionais} onChange={e=>setForm({...form, informacoesAdicionais: e.target.value})} rows={2}
              maxLength={1000}
              placeholder="Ex: mencionar o e-book gratuito, evitar jargões"
              className="w-full bg-input rounded-lg p-3 text-sm outline-none"/>
          </Field>


          <div className="space-y-2">
            <button type="button" onClick={runTest} disabled={testing}
              className="w-full bg-input hover:bg-input/70 border border-border rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {testing ? <><Loader2 className="w-4 h-4 animate-spin"/> Testando conexão Grok...</> : <><Plug className="w-4 h-4"/> Testar conexão Grok</>}
            </button>
            {testResult && (
              <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 border ${testResult.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-[1px]"/> : <XCircle className="w-4 h-4 shrink-0 mt-[1px]"/>}
                <span className="break-words">{testResult.message}</span>
              </div>
            )}
          </div>

          <button type="submit" disabled={busy}
            className="w-full gradient-brand text-primary-foreground font-medium rounded-lg py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin"/> Gerando com Grok...</> : <><Wand2 className="w-4 h-4"/> Gerar carrossel</>}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">Movido a Grok da xAI • Limite de 30 gerações por dia por chave.</p>
        </form>

        {result && accessKey && <ResultView data={result} save={save} accessKey={accessKey} autoImgs={autoImgs}/>}
      </div>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ResultView({ data, save, accessKey, autoImgs }: {
  data: CarrosselOut;
  save: ReturnType<typeof useServerFn<typeof updateSlide>>;
  accessKey: string;
  autoImgs: Record<number, string>;
}) {
  return (
    <div className="mt-8 space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-display font-bold">{data.titulo}</h2>
          <CopyBtn text={data.titulo}/>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Legenda</span>
            <CopyBtn text={data.legenda}/>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{data.legenda}</p>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Hashtags</span>
            <CopyBtn text={data.hashtags.map(h=>`#${h}`).join(" ")}/>
          </div>
          <p className="mt-1 text-sm">{data.hashtags.map(h=>`#${h}`).join(" ")}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {data.slides.map(s => (
          <SlideCard key={s.numero} generationId={data.id} slide={s} save={save} accessKey={accessKey} autoImg={autoImgs[s.numero]}/>
        ))}
      </div>
    </div>
  );
}

function SlideCard({ generationId, slide, save, accessKey, autoImg }: {
  generationId: string;
  slide: CarrosselOut["slides"][number];
  save: ReturnType<typeof useServerFn<typeof updateSlide>>;
  accessKey: string;
  autoImg?: string;
}) {
  const genImg = useServerFn(generateImage);
  const [titulo, setTitulo] = useState(slide.titulo);
  const [texto, setTexto] = useState(slide.texto);
  const [saving, setSaving] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [userImg, setUserImg] = useState<string | null>(null);
  const displayedImg = userImg ?? imgUrl ?? autoImg ?? null;

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx 8MB)"); return; }
    const r = new FileReader();
    r.onload = () => { setUserImg(r.result as string); toast.success(`Imagem do slide ${slide.numero} substituída`); };
    r.readAsDataURL(f);
  }

  async function persist() {
    setSaving(true);
    try {
      await save({ data: { generationId, slideNumero: slide.numero, titulo, texto, accessKey } });
      toast.success(`Slide ${slide.numero} salvo`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function gerarImagem() {
    if (imgBusy) return;
    setImgBusy(true);
    try {
      const seed = `${generationId}-${slide.numero}-${Date.now()}`;
      const r = await genImg({ data: {
        prompt: slide.promptImagem,
        seed,
      }});
      const composed = await composePost({ background: r.dataUrl, title: titulo, body: texto });
      setImgUrl(composed);
      toast.success(`Imagem do slide ${slide.numero} gerada`);
    } catch (e) { toast.error((e as Error).message || "Falha ao gerar imagem"); }
    finally { setImgBusy(false); }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Slide {slide.numero} • {slide.tipo}</div>
        <button onClick={persist} disabled={saving}
          className="text-xs bg-input hover:bg-input/70 rounded-md px-2 py-1 flex items-center gap-1 disabled:opacity-60">
          {saving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>} Salvar
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Título</span>
            <CopyBtn text={titulo}/>
          </div>
          <input value={titulo} onChange={e=>setTitulo(e.target.value)}
            className="w-full bg-input rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Texto</span>
            <CopyBtn text={texto}/>
          </div>
          <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={3}
            className="w-full bg-input rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-primary"/>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="uppercase tracking-wide">Prompt imagem: </span>{slide.promptImagem}
        </div>

        {displayedImg ? (
          <div className="rounded-lg overflow-hidden border border-border">
            <img src={displayedImg} alt={`Slide ${slide.numero}`} className="w-full h-auto"/>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border aspect-square flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2"/> Gerando imagem...
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={gerarImagem} disabled={imgBusy}
            className="flex-1 min-w-[140px] bg-input hover:bg-input/70 border border-border rounded-lg py-2 text-xs flex items-center justify-center gap-1 disabled:opacity-60">
            {imgBusy ? <><Loader2 className="w-3 h-3 animate-spin"/> Gerando imagem...</> : <><ImageIcon className="w-3 h-3"/> {displayedImg ? "Gerar nova" : "Gerar imagem"}</>}
          </button>
          <label className="flex-1 min-w-[140px] cursor-pointer bg-input hover:bg-input/70 border border-border rounded-lg py-2 text-xs flex items-center justify-center gap-1">
            <Upload className="w-3 h-3"/> Usar minha imagem
            <input type="file" accept="image/*" onChange={onUpload} className="hidden"/>
          </label>
          {userImg && (
            <button type="button" onClick={() => setUserImg(null)}
              className="bg-input hover:bg-input/70 border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-1">
              <X className="w-3 h-3"/> Remover
            </button>
          )}
          {displayedImg && (
            <a href={displayedImg} download={`slide-${slide.numero}.png`}
              className="bg-input hover:bg-input/70 border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-1">
              <Download className="w-3 h-3"/> Baixar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => {
      await navigator.clipboard.writeText(text);
      setOk(true); setTimeout(()=>setOk(false), 1200);
    }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
      {ok ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>} {ok ? "copiado" : "copiar"}
    </button>
  );
}
