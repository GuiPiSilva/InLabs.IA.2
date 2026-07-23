import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callXaiJson, testXaiApi } from "@/lib/xai";

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
  quantidadeSlides: z.number().int().min(3).max(10),
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
    const sb = admin();
    const keyId = await requireKey(sb, data.accessKey);

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
- O primeiro slide tem tipo "capa", os intermediários "conteudo" e o último "cta".
- Títulos curtos e impactantes, com no máximo oito palavras.
- Textos com uma a três linhas por slide.
- promptImagem sempre em inglês, detalhado e com ângulo, composição e iluminação diferentes em cada slide.
- Hashtags relevantes ao nicho, entre oito e quinze.
- Idioma dos textos: português brasileiro.
- Não inclua explicações fora do JSON.`;

    const userPrompt = `Tema: ${data.tema}
Objetivo: ${data.objetivo || "engajamento"}
Público-alvo: ${data.publicoAlvo || "geral"}
Tom de comunicação: ${data.tom}
Quantidade de slides: ${data.quantidadeSlides}
Informações adicionais: ${data.informacoesAdicionais || "nenhuma"}
Gere exatamente ${data.quantidadeSlides} slides.`;

    const raw = await callXaiJson([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let parsed: Omit<CarrosselOut, "id">;

    try {
      parsed = JSON.parse(raw) as Omit<CarrosselOut, "id">;
    } catch {
      throw new Error("Resposta da Grok em formato inválido.");
    }

    if (
      !parsed ||
      typeof parsed.titulo !== "string" ||
      typeof parsed.legenda !== "string" ||
      !Array.isArray(parsed.hashtags) ||
      !Array.isArray(parsed.slides) ||
      parsed.slides.length === 0
    ) {
      throw new Error("A resposta da Grok não segue o formato esperado.");
    }

    const slides = parsed.slides.slice(0, data.quantidadeSlides).map((slide, index) => ({
      numero: index + 1,
      titulo: String(slide.titulo ?? ""),
      texto: String(slide.texto ?? ""),
      promptImagem: String(slide.promptImagem ?? ""),
      tipo: String(
        slide.tipo ??
          (index === 0
            ? "capa"
            : index === data.quantidadeSlides - 1
              ? "cta"
              : "conteudo"),
      ),
    }));

    const hashtags = parsed.hashtags
      .map((hashtag) => String(hashtag).replace(/^#/, ""))
      .slice(0, 20);

    const { data: inserted, error: insertError } = await sb
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

    if (insertError || !inserted) {
      throw new Error("Falha ao salvar geração no banco.");
    }

    await sb
      .from("access_keys")
      .update({
        uses: (count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", keyId);

    return {
      id: inserted.id,
      titulo: parsed.titulo,
      legenda: parsed.legenda,
      hashtags,
      slides,
    };
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

export const testXaiConnection = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ ok: boolean; model: string; message: string }> => {
    return testXaiApi();
  });
