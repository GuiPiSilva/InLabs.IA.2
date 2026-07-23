import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

async function callChat(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

  const systemMessage = messages.find((message) => message.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content)
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${systemMessage}\nRetorne somente JSON válido, sem markdown.` }],
          },
          contents: [{ role: "user", parts: [{ text: userMessages }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9,
          },
        }),
      },
    );

    const body = (await response.json()) as GeminiGenerateResponse;
    if (!response.ok) {
      throw new Error(body.error?.message || `Erro HTTP ${response.status}`);
    }

    const output = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!output) throw new Error("Resposta vazia da Gemini.");
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/aborted|abort/i.test(message)) {
      throw new Error("A Gemini demorou demais para responder. Tente novamente.");
    }
    if (/429|quota|rate limit/i.test(message)) {
      throw new Error("Limite da Gemini API atingido. Tente novamente em instantes.");
    }
    if (/401|403|api.?key|permission|unauthorized|forbidden/i.test(message)) {
      throw new Error("Chave da Gemini inválida ou sem permissão.");
    }
    throw new Error(`Falha ao chamar a Gemini: ${message}`);
  } finally {
    clearTimeout(timeout);
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

    const raw = await callChat([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);

    let parsed: { slides: SlideOut[] };
    try {
      parsed = JSON.parse(raw) as { slides: SlideOut[] };
    } catch {
      throw new Error("Resposta da IA inválida");
    }

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

    const raw = await callChat([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);

    try {
      return JSON.parse(raw) as SlideOut;
    } catch {
      throw new Error("Resposta da IA inválida");
    }
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

interface GeminiImageBlock {
  type?: string;
  data?: string;
  mime_type?: string;
}

interface GeminiImageInteractionResponse {
  output_image?: GeminiImageBlock;
  steps?: Array<{
    type?: string;
    content?: GeminiImageBlock[];
  }>;
  error?: { message?: string };
}

function findGeneratedImage(result: GeminiImageInteractionResponse): GeminiImageBlock | undefined {
  if (result.output_image?.data) return result.output_image;
  for (const step of result.steps ?? []) {
    for (const block of step.content ?? []) {
      if (block.type === "image" && block.data) return block;
    }
  }
  return undefined;
}

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ImageInput.parse(d))
  .handler(async ({ data }): Promise<{ dataUrl: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada no servidor.");

    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
    const hasText = (data.slideTitle || data.slideBody).trim().length > 0;
    const aspectRatio = data.slideKind === "cartaz" ? "4:5" : "1:1";
    const fullPrompt = hasText
      ? `Create one finished Instagram design, full bleed, edge to edge, not a mockup and not inside a device frame.

Required Portuguese headline: "${data.slideTitle}".
${data.slideBody ? `Required Portuguese supporting copy: "${data.slideBody}".` : ""}

Use highly readable typography, correct Portuguese spelling, strong hierarchy, professional cinematic lighting and balanced negative space. Do not add any extra words, watermark, border or unrelated logo.
Visual style: ${data.style || "premium cinematic editorial social media design"}.
Color palette: ${data.palette || "cohesive high-contrast purple, blue and neutral palette"}.
${data.brand ? `Add a small discreet brand name in a corner: "${data.brand}".` : ""}
Scene and visual direction: ${data.prompt}.
Creative variation reference: ${data.seed}.`
      : `${data.prompt}. Create a professional cinematic Instagram image, full bleed, edge to edge, no border, no mockup, no watermark, balanced composition and space for future text. Creative variation reference: ${data.seed}.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150_000);

    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: fullPrompt,
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: aspectRatio,
            image_size: "1K",
          },
        }),
      });

      const rawText = await response.text();
      let result: GeminiImageInteractionResponse = {};
      try {
        result = JSON.parse(rawText) as GeminiImageInteractionResponse;
      } catch {
        // The raw body is included in the sanitized error below.
      }

      if (!response.ok) {
        throw new Error(result.error?.message || rawText.slice(0, 500) || `Erro HTTP ${response.status}`);
      }

      const image = findGeneratedImage(result);
      if (!image?.data) throw new Error("A Gemini não retornou uma imagem.");
      return { dataUrl: `data:${image.mime_type || "image/png"};base64,${image.data}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/aborted|abort/i.test(message)) throw new Error("A Gemini demorou demais para gerar a imagem.");
      if (/401|403|api.?key|permission|unauthorized|forbidden/i.test(message)) throw new Error("Chave da Gemini inválida ou sem permissão para gerar imagens.");
      if (/429|quota|rate limit/i.test(message)) throw new Error("Limite da Gemini para imagens atingido. Tente novamente em instantes.");
      throw new Error(`Falha ao gerar imagem com a Gemini: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  });
