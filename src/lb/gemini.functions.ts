import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const Input = z.object({
  accessKey: z.string().trim().min(4).max(64),
  tema: z.string().trim().min(3).max(500),
  objetivo: z.string().trim().max(300).optional().default(""),
  publicoAlvo: z.string().trim().max(300).optional().default(""),
  tom: z.string().trim().max(100).optional().default("profissional"),
  quantidadeSlides: z.number().int().min(3).max(20),
  informacoesAdicionais: z.string().trim().max(1000).optional().default(""),
});

interface SlideOut {
  numero: number;
  titulo: string;
  texto: string;
  promptImagem: string;
  tipo: string;
}
export interface CarrosselOut {
  id: string;
  titulo: string;
  legenda: string;
  hashtags: string[];
  slides: SlideOut[];
}

const MAX_PER_DAY = 30;
const TIMEOUT_MS = 45_000;

async function requireKey(sb: ReturnType<typeof admin>, key: string) {
  const { data: row } = await sb.from("access_keys")
    .select("id, active").eq("key", key).maybeSingle();
  if (!row || !row.active) throw new Error("Chave de acesso inválida ou desativada. Peça uma nova ao admin.");
  return row.id as string;
}

export const generateInstagramContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<CarrosselOut> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const sb = admin();
    const keyId = await requireKey(sb, data.accessKey);

    // Rate limit por chave
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await sb
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("access_key_id", keyId)
      .gte("created_at", sinceIso);
    if (countErr) throw new Error("Falha ao verificar limite de uso.");
    if ((count ?? 0) >= MAX_PER_DAY) {
      throw new Error(`Limite diário atingido (${MAX_PER_DAY} gerações) para esta chave.`);
    }

    const systemPrompt = `Você é um redator especialista em conteúdo para Instagram brasileiro.
Retorne SEMPRE JSON válido, sem markdown, no formato EXATO:
{
  "titulo": "Título principal do carrossel",
  "legenda": "Legenda completa para Instagram, com quebras de linha e CTA no final",
  "hashtags": ["hashtag1", "hashtag2"],
  "slides": [
    { "numero": 1, "titulo": "Título do slide", "texto": "Texto do slide", "promptImagem": "Descrição detalhada da imagem em inglês", "tipo": "capa" }
  ]
}
Regras:
- O primeiro slide tem tipo "capa", os intermediários "conteudo", o último "cta".
- Títulos curtos e impactantes (máx 8 palavras).
- Textos com 1-3 linhas cada.
- promptImagem sempre em inglês, descritivo, variando ângulo/composição/iluminação por slide.
- Hashtags relevantes ao nicho, entre 8 e 15.
- Idioma dos textos: português brasileiro.`;

    const userPrompt = `Tema: ${data.tema}
Objetivo: ${data.objetivo || "engajamento"}
Público-alvo: ${data.publicoAlvo || "geral"}
Tom de comunicação: ${data.tom}
Quantidade de slides: ${data.quantidadeSlides}
Informações adicionais: ${data.informacoesAdicionais || "nenhuma"}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash")}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
          }),
        },
      );
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") throw new Error("Tempo esgotado ao gerar. Tente novamente.");
      throw new Error("Falha ao chamar a Gemini API.");
    } finally { clearTimeout(t); }

    if (!response.ok) {
      const body = await response.text();
      console.error("Gemini error", response.status, body.slice(0, 500));
      if (response.status === 429) throw new Error("Limite da Gemini API atingido. Tente novamente em instantes.");
      if (response.status === 401 || response.status === 403) throw new Error("Chave da Gemini inválida ou sem permissão.");
      throw new Error("A Gemini retornou um erro. Tente novamente.");
    }

    const json = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!raw) throw new Error("Resposta vazia da Gemini.");
    let parsed: Omit<CarrosselOut, "id">;
    try { parsed = JSON.parse(raw) as Omit<CarrosselOut, "id">; }
    catch { throw new Error("Resposta da Gemini em formato inválido."); }

    if (
      !parsed || typeof parsed.titulo !== "string" || typeof parsed.legenda !== "string" ||
      !Array.isArray(parsed.hashtags) || !Array.isArray(parsed.slides) || parsed.slides.length === 0
    ) throw new Error("Resposta da Gemini não segue o formato esperado.");

    const slides = parsed.slides.slice(0, data.quantidadeSlides).map((s, i) => ({
      numero: i + 1,
      titulo: String(s.titulo ?? ""),
      texto: String(s.texto ?? ""),
      promptImagem: String(s.promptImagem ?? ""),
      tipo: String(s.tipo ?? (i === 0 ? "capa" : i === parsed.slides.length - 1 ? "cta" : "conteudo")),
    }));
    const hashtags = parsed.hashtags.map(h => String(h).replace(/^#/, "")).slice(0, 20);

    const { data: inserted, error: insErr } = await sb
      .from("generations")
      .insert({
        access_key_id: keyId,
        tema: data.tema,
        objetivo: data.objetivo,
        publico_alvo: data.publicoAlvo,
        tom: data.tom,
        quantidade_slides: data.quantidadeSlides,
        informacoes_adicionais: data.informacoesAdicionais,
        titulo: parsed.titulo,
        legenda: parsed.legenda,
        hashtags,
        slides,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error("Falha ao salvar geração no banco.");

    await sb.from("access_keys")
      .update({ uses: (count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", keyId);

    return { id: inserted.id, titulo: parsed.titulo, legenda: parsed.legenda, hashtags, slides };
  });

const UpdateSlideInput = z.object({
  accessKey: z.string().trim().min(4).max(64),
  generationId: z.string().uuid(),
  slideNumero: z.number().int().min(1),
  titulo: z.string().max(300),
  texto: z.string().max(2000),
});

export const updateSlide = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateSlideInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sb = admin();
    await requireKey(sb, data.accessKey);
    const { data: row, error } = await sb
      .from("generations").select("slides").eq("id", data.generationId).single();
    if (error || !row) throw new Error("Geração não encontrada.");
    const slides = (row.slides as unknown as SlideOut[]).map(s =>
      s.numero === data.slideNumero ? { ...s, titulo: data.titulo, texto: data.texto } : s,
    );
    const { error: upErr } = await sb
      .from("generations").update({ slides: slides as unknown as never }).eq("id", data.generationId);
    if (upErr) throw new Error("Falha ao salvar edições.");
    return { ok: true };
  });

export const testGeminiConnection = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ ok: boolean; model: string; message: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
    if (!apiKey) return { ok: false, model, message: "GEMINI_API_KEY não configurada no servidor." };
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash")}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Responda apenas: OK" }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 10 },
          }),
        },
      );
      if (!r.ok) {
        const body = await r.text();
        if (r.status === 401 || r.status === 403) return { ok: false, model, message: "Chave da Gemini inválida ou sem permissão." };
        if (r.status === 429) return { ok: false, model, message: "Limite da Gemini atingido no momento." };
        return { ok: false, model, message: `Erro Gemini ${r.status}: ${body.slice(0, 160)}` };
      }
      const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      return { ok: true, model, message: `Conexão OK. Resposta: "${txt || "(vazia)"}"` };
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") return { ok: false, model, message: "Tempo esgotado ao contatar a Gemini." };
      return { ok: false, model, message: "Falha de rede ao contatar a Gemini." };
    } finally { clearTimeout(t); }
  });
