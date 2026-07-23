import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callXaiJson } from "@/lib/xai";

interface SlideOut {
  title: string;
  body: string;
  imagePrompt: string;
}

const CarrosselInput = z.object({
  theme: z.string().min(1),
  reference: z.string().optional().default(""),
  style: z.string().optional().default(""),
  slides: z.number().int().min(1).max(20),
  extra: z.string().optional().default(""),
  seed: z.string().optional().default(""),
});

export const generateCarrossel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CarrosselInput.parse(data))
  .handler(async ({ data }): Promise<{ slides: SlideOut[] }> => {
    const systemPrompt = `Você é um redator especialista em Instagram.
Retorne SEMPRE JSON válido no formato:
{ "slides": [ { "title": "...", "body": "...", "imagePrompt": "..." }, ... ] }

Regras:
- Títulos curtos e impactantes.
- Corpo em uma ou duas linhas.
- Textos em português brasileiro.
- imagePrompt em inglês, detalhado e adequado para geração de imagem.
- Varie ângulo, composição e iluminação em cada slide.
- Nunca repita a mesma composição visual.
- Não escreva markdown nem explicações fora do JSON.`;

    const userPrompt = `Tema: ${data.theme}
Referência de estilo, somente como direção e sem copiar: ${data.reference}
Estilo visual desejado: ${data.style}
Quantidade de slides: ${data.slides}
Instruções extras: ${data.extra}
Seed criativa: ${data.seed}
Gere exatamente ${data.slides} slides.`;

    const raw = await callXaiJson([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let parsed: { slides?: SlideOut[] };

    try {
      parsed = JSON.parse(raw) as { slides?: SlideOut[] };
    } catch {
      throw new Error("Resposta da Grok em formato inválido.");
    }

    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error("A resposta da Grok não contém slides válidos.");
    }

    return {
      slides: parsed.slides.slice(0, data.slides).map((slide) => ({
        title: String(slide.title ?? ""),
        body: String(slide.body ?? ""),
        imagePrompt: String(slide.imagePrompt ?? ""),
      })),
    };
  });

const CartazInput = z.object({
  title: z.string().min(1),
  date: z.string().optional().default(""),
  time: z.string().optional().default(""),
  place: z.string().optional().default(""),
  kind: z.string().optional().default(""),
  style: z.string().optional().default(""),
  extra: z.string().optional().default(""),
  seed: z.string().optional().default(""),
});

export const generateCartaz = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CartazInput.parse(data))
  .handler(async ({ data }): Promise<SlideOut> => {
    const systemPrompt = `Você cria conteúdo para cartazes de eventos no Instagram.
Retorne somente JSON válido neste formato:
{ "title": "...", "body": "...", "imagePrompt": "..." }

Regras:
- O body deve incluir data, horário e local de forma organizada.
- O imagePrompt deve ser escrito em inglês.
- O imagePrompt deve descrever somente o cenário fotográfico, iluminação, composição e atmosfera.
- Não inclua markdown nem explicações fora do JSON.`;

    const userPrompt = `Evento: ${data.title}
Tipo: ${data.kind}
Data: ${data.date}
Horário: ${data.time}
Local: ${data.place}
Estilo: ${data.style}
Informações adicionais: ${data.extra}
Seed criativa: ${data.seed}`;

    const raw = await callXaiJson([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    try {
      const parsed = JSON.parse(raw) as Partial<SlideOut>;

      return {
        title: String(parsed.title ?? data.title),
        body: String(parsed.body ?? ""),
        imagePrompt: String(parsed.imagePrompt ?? ""),
      };
    } catch {
      throw new Error("Resposta da Grok em formato inválido para o cartaz.");
    }
  });

// ---------------------------------------------------------------------------
// IMAGENS — Cloudflare Workers AI exclusivamente.
// Modelo: @cf/black-forest-labs/flux-1-schnell.
// ---------------------------------------------------------------------------

const CF_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CF_IMAGE_TIMEOUT_MS = 60_000;

const ImageInput = z.object({
  prompt: z.string().min(1),
  seed: z.string().optional().default(""),
  slideTitle: z.string().optional().default(""),
  slideBody: z.string().optional().default(""),
  slideIndex: z.number().optional().default(0),
  slideTotal: z.number().optional().default(0),
  slideKind: z.string().optional().default(""),
  brand: z.string().optional().default(""),
  palette: z.string().optional().default(""),
  style: z.string().optional().default(""),
});

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImageInput.parse(data))
  .handler(async ({ data }): Promise<{ dataUrl: string }> => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      throw new Error(
        "CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN não configuradas no servidor.",
      );
    }

    const fullPrompt = `${data.prompt}.
Professional advertising and editorial photography, full-bleed, edge to edge, created for a real Instagram campaign.
Visual style: ${data.style || "cinematic, rich contrast, realistic textures"}.
Color palette mood: ${data.palette || "cohesive and high-contrast"}.
Content category: ${data.slideKind || "social media advertising"}.

STRICT RULES:
- Pure photography only.
- Absolutely no text, letters, words, numbers, logos or watermarks.
- No card, frame, border, slide badge, pagination, interface element or mockup.
- Fill the entire square frame edge to edge.
- Use a unique composition for slide ${data.slideIndex + 1} of ${Math.max(data.slideTotal, 1)}.

Creative variation seed: ${data.seed}.`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CF_IMAGE_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CF_IMAGE_MODEL}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: fullPrompt,
            steps: 8,
          }),
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        console.error(
          "Cloudflare Workers AI error",
          response.status,
          responseText.slice(0, 500),
        );

        if (response.status === 429) {
          throw new Error(
            "Limite da Cloudflare Workers AI atingido. Tente novamente em instantes.",
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Token da Cloudflare inválido ou sem permissão para gerar imagens.",
          );
        }

        throw new Error(
          `Cloudflare Workers AI retornou um erro (${response.status}).`,
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as {
          result?: { image?: string };
          success?: boolean;
          errors?: Array<{ message?: string }>;
        };

        const base64Image = payload.result?.image;

        if (!base64Image) {
          throw new Error(
            payload.errors?.[0]?.message ||
              "Imagem não retornada pela Cloudflare Workers AI.",
          );
        }

        return {
          dataUrl: `data:image/jpeg;base64,${base64Image}`,
        };
      }

      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString("base64");

      return {
        dataUrl: `data:${contentType || "image/jpeg"};base64,${base64Image}`,
      };
    } catch (error) {
      const err = error as Error;

      if (err.name === "AbortError") {
        throw new Error(
          "Tempo esgotado ao gerar imagem na Cloudflare Workers AI.",
        );
      }

      if (err.message.includes("Cloudflare")) throw err;

      throw new Error(`Falha ao gerar imagem: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  });
