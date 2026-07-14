import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import {
  buildTranslationMessages,
  buildVisionOcrMessages,
  buildVisionTranslationMessages,
  TranslationDomain
} from "@/lib/prompts";

const PPQ_URL = process.env.PPQ_CHAT_COMPLETIONS_URL || "https://api.ppq.ai/chat/completions";

export const DEFAULT_MODEL = process.env.PPQ_MODEL || process.env.OPENROUTER_MODEL || "claude-sonnet-4-5";

export class PpqRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type TranslateChunkInput = {
  apiKey: string;
  model: string;
  text: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
  signal?: AbortSignal;
};

type TranslateImageInput = {
  apiKey: string;
  model: string;
  imageDataUrl: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
  signal?: AbortSignal;
};

const extractContentText = (content: unknown): string => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const text = (item as { text?: string }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
    return joined.trim();
  }

  return "";
};

const SSE_DATA_PREFIX = "data:";

const extractDeltaText = (delta: unknown): string => {
  if (!delta || typeof delta !== "object") {
    return "";
  }
  const content = (delta as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const text = (item as { text?: string }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
  }
  return "";
};

const requestPpqStream = async (
  apiKey: string,
  requestBody: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> => {
  const response = await fetch(PPQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message || payload?.message || "Translation request failed.";
    throw new PpqRequestError(message, response.ok ? 502 : response.status);
  }

  return response;
};

/**
 * Streams an OpenAI-compatible SSE response, yielding incremental text deltas
 * as the model produces them.
 */
async function* streamPpqDeltas(response: Response): AsyncGenerator<string, void, unknown> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last (possibly partial) line in the buffer.
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith(SSE_DATA_PREFIX)) {
          continue;
        }

        const data = line.slice(SSE_DATA_PREFIX.length).trim();
        if (data === "[DONE]") {
          return;
        }

        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = extractDeltaText(json?.choices?.[0]?.delta);
        if (delta) {
          yield delta;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const streamTranslateWithPpq = async ({
  apiKey,
  model,
  text,
  domain = "general",
  previousSummary,
  glossary,
  temperature = 0.2,
  signal
}: TranslateChunkInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const messages = buildTranslationMessages({ text, domain, previousSummary, glossary });

  const response = await requestPpqStream(apiKey, {
    model,
    messages,
    temperature
  }, signal);

  return streamPpqDeltas(response);
};

export const streamTranslateImageWithPpq = async ({
  apiKey,
  model,
  imageDataUrl,
  domain = "general",
  previousSummary,
  glossary,
  temperature = 0.1,
  signal
}: TranslateImageInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const messages = buildVisionTranslationMessages({
    text: "",
    domain,
    previousSummary,
    glossary,
    imageDataUrl
  } as any);

  const response = await requestPpqStream(apiKey, {
    model,
    messages,
    temperature
  }, signal);

  return streamPpqDeltas(response);
};

export const streamOcrImageWithPpq = async ({
  apiKey,
  model,
  imageDataUrl,
  temperature = 0,
  signal
}: TranslateImageInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const response = await requestPpqStream(apiKey, {
    model,
    messages: buildVisionOcrMessages(imageDataUrl),
    temperature
  }, signal);

  return streamPpqDeltas(response);
};

export const translateWithPpq = async ({ apiKey, model, text, domain = "general", previousSummary, glossary }: TranslateChunkInput): Promise<string> => {
  const messages = buildTranslationMessages({ text, domain, previousSummary, glossary });

  const response = await fetch(PPQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Translation request failed.";
    throw new PpqRequestError(message, response.status);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = extractContentText(rawContent);
  if (!content) {
    throw new PpqRequestError("Empty translation result.", 502);
  }

  return normalizeTranslationFootnotes(content);
};

export const translateImageWithPpq = async ({ apiKey, model, imageDataUrl, domain = "general", previousSummary, glossary }: TranslateImageInput): Promise<string> => {
  const messages = buildVisionTranslationMessages({
    text: "",
    domain,
    previousSummary,
    glossary,
    imageDataUrl
  } as any);

  const response = await fetch(PPQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Image translation request failed.";
    throw new PpqRequestError(message, response.status);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = extractContentText(rawContent);
  if (!content) {
    throw new PpqRequestError("Empty image translation result.", 502);
  }

  return normalizeTranslationFootnotes(content);
};
