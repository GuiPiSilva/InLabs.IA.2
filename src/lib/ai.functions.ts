import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const CarrosselInput = z.object({
  theme: z.string().min(1),
  reference: z.string().optional().default(""),
  style: z.string().optional().default(""),
  slides: z.number().int().min(1).max(20),
  extra: z.string().optional().default(""),
  seed: z.string().optional().default(""),
});

interface SlideOut {
  title: string;
  body: string;
  imagePrompt: string;
}

async function callChat(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

  const systemMessage = messages.find((message) => message.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content)
    .join("\n\n");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-3-flash-preview",
      input: `${systemMessage}\n\n${userMessages}\n\nRetorne somente JSON válido, sem markdown.`,
      response_format: {
        type: "text",
        mime_type: "application/json",
      },
    });

    const output = interaction.output_text?.trim();
    if (!output) throw new Error("Resposta vazia da Gemini.");
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/429|quota|rate limit/i.test(message)) {
      throw new Error("Limite da Gemini API atingido. Tente novamente em instantes.");
    }
    if (/401|403|api.?key|permission|unauthorized|forbidden/i.test(message)) {
      throw new Error("Chave da Gemini inválida ou sem permissão.");
    }
    throw new Error(`Falha ao chamar a Gemini: ${message}`);
  }
}

export const generateCarrossel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CarrosselInput.parse(d))
  .handler(async ({ data }): Promise<{ slides: SlideOut[] }> => {
    const sys = `Você é um redator especialista em Instagram. Retorne SEMPRE JSON válido no formato:
{ "slides": [ { "title": "...", "body": "...", "imagePrompt": "..." }, ... ] }
Regras: títulos curtos e impactantes, corpo em 1-2 linhas, imagePrompt em inglês descritivo com variações de ângulo/composição/iluminação únicas para cada slide (nunca repita a mesma composição). Idioma dos textos: português.`;
    const user = `Tema: ${data.theme}
Referência de estilo (só direção, não copiar): ${data.reference}
Estilo visual desejado: ${data.style}
Quantidade de slides: ${data.slides}
Instruções extras: ${data.extra}
Aleatoriedade (seed ${data.seed}): varie tom, exemplos e enquadramentos.`;

    const raw = await callChat([{ role: "system", content: sys }, { role: "user", content: user }]);
    let parsed: { slides: SlideOut[] };
    try { parsed = JSON.parse(raw); } catch { throw new Error("Resposta da IA inválida"); }
    if (!Array.isArray(parsed.slides)) throw new Error("Resposta sem slides");
    return { slides: parsed.slides.slice(0, data.slides) };
  });

const CartazInput = z.object({
  title: z.string(),
  date: z.string().optional().default(""),
  time: z.string().optional().default(""),
  place: z.string().optional().default(""),
  kind: z.string().optional().default(""),
  style: z.string().optional().default(""),
  extra: z.string().optional().default(""),
  seed: z.string().optional().default(""),
});

export const generateCartaz = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CartazInput.parse(d))
  .handler(async ({ data }): Promise<SlideOut> => {
    const sys = `Você cria cartazes de eventos para Instagram. Retorne JSON: { "title": "...", "body": "...", "imagePrompt": "..." }. Body inclui data, hora e local formatados. imagePrompt em inglês, com composição/iluminação/ângulo únicos baseados na seed.`;
    const user = `Evento: ${data.title}
Tipo: ${data.kind}
Data: ${data.date} ${data.time}
Local: ${data.place}
Estilo: ${data.style}
Extras: ${data.extra}
Seed única: ${data.seed}`;
    const raw = await callChat([{ role: "system", content: sys }, { role: "user", content: user }]);
    return JSON.parse(raw) as SlideOut;
  });

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
  .inputValidator((d: unknown) => ImageInput.parse(d))
  .handler(async ({ data }): Promise<{ dataUrl: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const hasText = (data.slideTitle || data.slideBody).trim().length > 0;
    const fullPrompt = hasText
      ? `Create ONE single cinematic poster-style image (1:1, 1080x1080) — NOT a mockup, NOT a slide inside a frame, NOT a Canva/mLabs presentation preview, NOT a photo with a caption card next to it. The final result must look like a real finished advertising poster / editorial photograph where the typography is composited DIRECTLY over the photograph, edge-to-edge, with no white borders, no rounded card, no "slide X of Y" wrapper, no device frame.

RENDER THIS EXACT TEXT ON THE IMAGE (spelled correctly, in PORTUGUESE, no typos, no extra or invented words, no lorem ipsum):
- HEADLINE (very large, bold, dominant typography, can span multiple lines): "${data.slideTitle}"
${data.slideBody ? `- SUPPORTING COPY (smaller, clean sans-serif, secondary): "${data.slideBody}"` : ""}

DESIGN DIRECTION:
- Full-bleed photographic background of the subject, shot like a professional ad campaign: cinematic lighting, shallow depth of field, rich contrast, realistic textures.
- Typography sits ON TOP of the photo like a movie poster or magazine cover.
- Visual style cue: ${data.style || "cinematic editorial poster"}
- Color palette: ${data.palette || "rich, cohesive, high-contrast between headline and background"}
${data.brand ? `- Small brand mark / handle discreetly placed in a corner: "${data.brand}"` : ""}

STRICT RULES:
- The image IS the final poster. No surrounding card, frame, slide badge, border, page mockup or watermark.
- No gibberish letters and no duplicated text.
- Square 1:1, full-bleed to the edges.

Photographic subject / scene: ${data.prompt}
Unique variation seed: ${data.seed}.`
      : `${data.prompt}. Cinematic full-bleed square 1:1 poster image, edge to edge, no frame, no slide mockup. Unique variation seed: ${data.seed}.`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create({
        model: "gemini-3.1-flash-image",
        input: fullPrompt,
        response_format: {
          type: "image",
          aspect_ratio: "1:1",
          image_size: "1K",
        },
      });

      const image = interaction.output_image;
      if (!image?.data) throw new Error("Imagem não retornada pela Gemini.");
      const mimeType = image.mime_type || "image/png";
      return { dataUrl: `data:${mimeType};base64,${image.data}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/429|quota|rate limit/i.test(message)) throw new Error("Limite da Gemini API atingido.");
      if (/401|403|api.?key|permission|unauthorized|forbidden/i.test(message)) {
        throw new Error("Chave da Gemini inválida ou sem permissão para gerar imagens.");
      }
      throw new Error(`Falha ao gerar imagem com a Gemini: ${message}`);
    }
  });
