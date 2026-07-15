import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import {
  buildTranslationMessages,
  buildVisionOcrMessages,
  buildVisionTranslationMessages,
  TranslationDomain
} from "@/lib/prompts";

export class ProviderRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ProviderInput = {
  endpoint: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

type TranslateChunkInput = ProviderInput & {
  text: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
};

type TranslateImageInput = ProviderInput & {
  imageDataUrl: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
};

const getHeaders = (apiKey: string, headers?: Record<string, string>): Record<string, string> => ({
  ...headers,
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json"
});

const extractContentText = (content: unknown): string => {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const text = (item as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
};

const extractDeltaText = (delta: unknown): string => {
  if (!delta || typeof delta !== "object") {
    return "";
  }
  const content = (delta as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const text = (item as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
};

const getProviderError = async (response: Response, fallback: string): Promise<ProviderRequestError> => {
  const payload = await response.json().catch(() => null);
  const message = payload?.error?.message || payload?.message || fallback;
  return new ProviderRequestError(message, response.ok ? 502 : response.status);
};

const requestProviderStream = async (
  provider: ProviderInput,
  requestBody: Record<string, unknown>
): Promise<Response> => {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: getHeaders(provider.apiKey, provider.headers),
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal: provider.signal
  });
  if (!response.ok || !response.body) {
    throw await getProviderError(response, "Translation request failed.");
  }
  return response;
};

async function* streamProviderDeltas(response: Response): AsyncGenerator<string, void, unknown> {
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
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice("data:".length).trim();
        if (data === "[DONE]") {
          return;
        }
        try {
          const payload = JSON.parse(data);
          const delta = extractDeltaText(payload?.choices?.[0]?.delta);
          if (delta) {
            yield delta;
          }
        } catch {
          continue;
        }
      }
    }
    const finalLine = buffer.trim();
    if (finalLine.startsWith("data:")) {
      const data = finalLine.slice("data:".length).trim();
      if (data && data !== "[DONE]") {
        try {
          const payload = JSON.parse(data);
          const delta = extractDeltaText(payload?.choices?.[0]?.delta);
          if (delta) yield delta;
        } catch {
          // Ignore an incomplete final provider event.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const streamTranslate = async ({
  endpoint,
  apiKey,
  model,
  headers,
  signal,
  text,
  domain = "general",
  previousSummary,
  glossary,
  temperature = 0.2
}: TranslateChunkInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const response = await requestProviderStream(
    { endpoint, apiKey, model, headers, signal },
    {
      model,
      messages: buildTranslationMessages({ text, domain, previousSummary, glossary }),
      temperature
    }
  );
  return streamProviderDeltas(response);
};

export const streamTranslateImage = async ({
  endpoint,
  apiKey,
  model,
  headers,
  signal,
  imageDataUrl,
  domain = "general",
  previousSummary,
  glossary,
  temperature = 0.1
}: TranslateImageInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const messages = buildVisionTranslationMessages({
    text: "",
    domain,
    previousSummary,
    glossary,
    imageDataUrl
  });
  const response = await requestProviderStream(
    { endpoint, apiKey, model, headers, signal },
    { model, messages, temperature }
  );
  return streamProviderDeltas(response);
};

export const streamOcrImage = async ({
  endpoint,
  apiKey,
  model,
  headers,
  signal,
  imageDataUrl,
  temperature = 0
}: TranslateImageInput): Promise<AsyncGenerator<string, void, unknown>> => {
  const response = await requestProviderStream(
    { endpoint, apiKey, model, headers, signal },
    { model, messages: buildVisionOcrMessages(imageDataUrl), temperature }
  );
  return streamProviderDeltas(response);
};

const requestProviderCompletion = async (
  provider: ProviderInput,
  requestBody: Record<string, unknown>,
  fallbackError: string
): Promise<string> => {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: getHeaders(provider.apiKey, provider.headers),
    body: JSON.stringify(requestBody),
    signal: provider.signal
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || fallbackError;
    throw new ProviderRequestError(message, response.status);
  }
  const content = extractContentText(payload?.choices?.[0]?.message?.content);
  if (!content) {
    throw new ProviderRequestError("Empty translation result.", 502);
  }
  return normalizeTranslationFootnotes(content);
};

export const translateText = async ({
  endpoint,
  apiKey,
  model,
  headers,
  signal,
  text,
  domain = "general",
  previousSummary,
  glossary
}: TranslateChunkInput): Promise<string> =>
  requestProviderCompletion(
    { endpoint, apiKey, model, headers, signal },
    {
      model,
      messages: buildTranslationMessages({ text, domain, previousSummary, glossary }),
      temperature: 0.2
    },
    "Translation request failed."
  );

export const translateImage = async ({
  endpoint,
  apiKey,
  model,
  headers,
  signal,
  imageDataUrl,
  domain = "general",
  previousSummary,
  glossary
}: TranslateImageInput): Promise<string> =>
  requestProviderCompletion(
    { endpoint, apiKey, model, headers, signal },
    {
      model,
      messages: buildVisionTranslationMessages({
        text: "",
        domain,
        previousSummary,
        glossary,
        imageDataUrl
      }),
      temperature: 0.1
    },
    "Image translation request failed."
  );
