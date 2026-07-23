const XAI_API_URL = "https://api.x.ai/v1/responses";
const XAI_TIMEOUT_MS = 60_000;

export const XAI_TEXT_MODEL = process.env.XAI_TEXT_MODEL?.trim() || "grok-4.5";

interface XaiResponsePayload {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  } | null;
}

function extractOutputText(payload: XaiResponsePayload): string {
  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

function cleanJson(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

export async function callXaiJson(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("XAI_API_KEY não configurada no servidor.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), XAI_TIMEOUT_MS);

  try {
    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: XAI_TEXT_MODEL,
        input: messages,
        temperature: 0.9,
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    const responseText = await response.text();
    let payload: XaiResponsePayload;

    try {
      payload = JSON.parse(responseText) as XaiResponsePayload;
    } catch {
      throw new Error(`Resposta inválida da xAI: ${responseText.slice(0, 300)}`);
    }

    if (!response.ok) {
      const message = payload.error?.message || responseText || `Erro HTTP ${response.status}`;

      if (response.status === 429) {
        throw new Error("Limite da API da Grok atingido. Tente novamente em instantes.");
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Chave da xAI inválida ou sem permissão.");
      }

      throw new Error(`A API da Grok retornou um erro (${response.status}): ${message}`);
    }

    const output = extractOutputText(payload);
    if (!output) throw new Error("Resposta vazia da Grok.");

    return cleanJson(output);
  } catch (error) {
    const err = error as Error;

    if (err.name === "AbortError") {
      throw new Error("Tempo esgotado ao chamar a Grok. Tente novamente.");
    }

    if (
      err.message.includes("Grok") ||
      err.message.includes("xAI") ||
      err.message.includes("XAI_API_KEY")
    ) {
      throw err;
    }

    throw new Error(`Falha ao chamar a API da Grok: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function testXaiApi(): Promise<{ ok: boolean; model: string; message: string }> {
  const apiKey = process.env.XAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      model: XAI_TEXT_MODEL,
      message: "XAI_API_KEY não configurada no servidor.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: XAI_TEXT_MODEL,
        input: "Responda somente com a palavra OK.",
        max_output_tokens: 10,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, model: XAI_TEXT_MODEL, message: "Chave da xAI inválida ou sem permissão." };
      }

      if (response.status === 429) {
        return { ok: false, model: XAI_TEXT_MODEL, message: "Limite da API da Grok atingido no momento." };
      }

      return {
        ok: false,
        model: XAI_TEXT_MODEL,
        message: `A API da Grok respondeu com erro ${response.status}: ${responseText.slice(0, 180)}`,
      };
    }

    return {
      ok: true,
      model: XAI_TEXT_MODEL,
      message: "Conexão com a Grok realizada com sucesso.",
    };
  } catch (error) {
    const err = error as Error;

    if (err.name === "AbortError") {
      return { ok: false, model: XAI_TEXT_MODEL, message: "Tempo esgotado ao testar a Grok." };
    }

    return { ok: false, model: XAI_TEXT_MODEL, message: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
