import { NextRequest } from "next/server";
import {
  DEFAULT_MODEL,
  PpqRequestError,
  streamOcrImageWithPpq,
  streamTranslateImageWithPpq,
  streamTranslateWithPpq
} from "@/lib/ppq";
import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import { TranslationDomain } from "@/lib/prompts";
import { checkRateLimit, getRequestClientKey } from "@/lib/rateLimit";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type StreamRequestBody = {
  chunk?: TranslationChunk;
  imageTask?: TranslateImageTask;
  userApiKey?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  model?: string;
  domain?: TranslationDomain;
  previousSummary?: string;
  glossary?: Record<string, string>;
  temperature?: number;
};

export const runtime = "nodejs";

const toUserFriendlyError = (status: number, message: string): string => {
  const normalized = message.toLowerCase();
  if (status === 401 || status === 403 || normalized.includes("invalid api key")) {
    return "Invalid PPQ API key. Check your key and try again.";
  }
  if (status === 429) {
    return "PPQ rate limit reached. Please wait and try again.";
  }
  if (
    status === 402 ||
    normalized.includes("insufficient") ||
    normalized.includes("credit") ||
    normalized.includes("balance")
  ) {
    return "PPQ reports insufficient balance or payment issues for this key.";
  }
  return message || "Translation API failed.";
};

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(`translate:${getRequestClientKey(request.headers)}`, {
    limit: 120,
    windowMs: 60_000
  });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many translation requests. Please wait and try again." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.retryAfterSeconds)
      }
    });
  }

  const body = (await request.json().catch(() => null)) as StreamRequestBody | null;

  const chunk = body?.chunk;
  const imageTask = body?.imageTask;

  if (!chunk && !imageTask) {
    return new Response(JSON.stringify({ error: "No text or image input provided." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (chunk?.originalChinese && chunk.originalChinese.length > 20_000) {
    return new Response(JSON.stringify({ error: "This translation segment is too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (imageTask?.imageDataUrl && imageTask.imageDataUrl.length > 22_000_000) {
    return new Response(JSON.stringify({ error: "This OCR image is too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (body?.glossary && Object.keys(body.glossary).length > 500) {
    return new Response(JSON.stringify({ error: "The glossary is too large for one request." }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }

  const model = body?.model?.trim() || DEFAULT_MODEL;
  const imageModel = process.env.PPQ_VISION_MODEL?.trim() || model;

  const defaultServerKey = process.env.PPQ_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  const selectedApiKey =
    body?.userPpqApiKey?.trim() ||
    body?.userApiKey?.trim() ||
    body?.userOpenRouterApiKey?.trim() ||
    defaultServerKey;

  if (!selectedApiKey) {
    return new Response(
      JSON.stringify({
        error: "No PPQ API key is configured. Add a key in settings or configure PPQ_API_KEY on the server."
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const domain = body?.domain || "general";
  const previousSummary = body?.previousSummary;
  const glossary = body?.glossary;
  const temperature = typeof body?.temperature === "number" ? Math.max(0, Math.min(body.temperature, 1)) : undefined;

  const encoder = new TextEncoder();
  const upstreamController = new AbortController();
  let streamClosed = false;
  const abortUpstream = () => upstreamController.abort();
  if (request.signal.aborted) {
    abortUpstream();
  } else {
    request.signal.addEventListener("abort", abortUpstream, { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (streamClosed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          streamClosed = true;
          abortUpstream();
        }
      };

      try {
        const usedModel = imageTask ? imageModel : model;
        const deltas = imageTask
          ? imageTask.mode === "ocr"
            ? await streamOcrImageWithPpq({
                apiKey: selectedApiKey,
                model: imageModel,
                imageDataUrl: imageTask.imageDataUrl,
                temperature,
                signal: upstreamController.signal
              })
            : await streamTranslateImageWithPpq({
              apiKey: selectedApiKey,
              model: imageModel,
              imageDataUrl: imageTask.imageDataUrl,
              domain,
              previousSummary,
              glossary,
              temperature,
              signal: upstreamController.signal
            })
          : await streamTranslateWithPpq({
              apiKey: selectedApiKey,
              model,
              text: chunk!.originalChinese,
              domain,
              previousSummary,
              glossary,
              temperature,
              signal: upstreamController.signal
            });

        let full = "";
        send("start", { model: usedModel });

        for await (const delta of deltas) {
          full += delta;
          send("delta", { text: delta });
        }

        const normalized = normalizeTranslationFootnotes(full);
        send("done", { text: normalized, model: usedModel });
      } catch (error) {
        if (!upstreamController.signal.aborted) {
          const message =
            error instanceof PpqRequestError
              ? toUserFriendlyError(error.status, error.message)
              : "Translation API failed.";
          send("error", {
            error: message,
            status: error instanceof PpqRequestError ? error.status : 500
          });
        }
      } finally {
        request.signal.removeEventListener("abort", abortUpstream);
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      }
    },
    cancel() {
      streamClosed = true;
      request.signal.removeEventListener("abort", abortUpstream);
      abortUpstream();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
