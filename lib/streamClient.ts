import { TranslationDomain } from "@/lib/prompts";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type StreamHandlers = {
  onStart?: (model: string) => void;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
};

type StreamResult = {
  text: string;
  model: string;
};

type StreamPayloadBase = {
  userPpqApiKey?: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
};

type StreamPayload =
  | ({ chunk: TranslationChunk } & StreamPayloadBase)
  | ({ imageTask: TranslateImageTask } & StreamPayloadBase);

export class TranslationStreamError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

/**
 * Calls the streaming translation endpoint and invokes `onDelta` for every
 * incremental piece of translated text. Resolves with the final normalized
 * text and the model that was used.
 */
export const streamTranslation = async (
  payload: StreamPayload,
  handlers: StreamHandlers
): Promise<StreamResult> => {
  const response = await fetch("/api/translate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: handlers.signal
  });

  if (!response.ok || !response.body) {
    const errorPayload = await response.json().catch(() => null);
    throw new TranslationStreamError(errorPayload?.error || "Translation request failed.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  let model = "";
  let errorMessage = "";
  let errorStatus = 0;

  const processEvent = (rawEvent: string) => {
    const lines = rawEvent.split("\n");
    let eventName = "message";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataStr += line.slice("data:".length).trim();
      }
    }

    if (!dataStr) {
      return;
    }

    let data: any;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }

    if (eventName === "start") {
      model = data.model || model;
      handlers.onStart?.(model);
    } else if (eventName === "delta") {
      if (typeof data.text === "string") {
        handlers.onDelta(data.text);
      }
    } else if (eventName === "done") {
      finalText = typeof data.text === "string" ? data.text : finalText;
      model = data.model || model;
    } else if (eventName === "error") {
      errorMessage = data.error || "Translation API failed.";
      errorStatus = typeof data.status === "number" ? data.status : 0;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      if (event.trim()) {
        processEvent(event);
      }
    }
  }

  if (buffer.trim()) {
    processEvent(buffer);
  }

  if (errorMessage) {
    throw new TranslationStreamError(errorMessage, errorStatus);
  }

  return { text: finalText, model };
};
