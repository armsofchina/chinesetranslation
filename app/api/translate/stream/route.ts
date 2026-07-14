import { NextRequest } from "next/server";
import {
  ProviderRequestError,
  streamOcrImage,
  streamTranslate,
  streamTranslateImage
} from "@/lib/openAiCompatible";
import { AiProviderId, normalizeAiProvider } from "@/lib/aiProviders";
import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import { TranslationDomain } from "@/lib/prompts";
import {
  getMissingProviderKeyMessage,
  resolveProviderContext,
  toProviderFriendlyError
} from "@/lib/providerServer";
import { checkRateLimit, getRequestClientKey } from "@/lib/rateLimit";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type StreamRequestBody = {
  chunk?: TranslationChunk;
  imageTask?: TranslateImageTask;
  provider?: AiProviderId;
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

  const providerId = normalizeAiProvider(body?.provider);
  const provider = resolveProviderContext(request, body || {});
  if (!provider) {
    return new Response(
      JSON.stringify({
        error: getMissingProviderKeyMessage(providerId)
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
        const usedModel = imageTask ? provider.visionModel : provider.model;
        const deltas = imageTask
          ? imageTask.mode === "ocr"
            ? await streamOcrImage({
                endpoint: provider.endpoint,
                apiKey: provider.apiKey,
                model: provider.visionModel,
                headers: provider.headers,
                imageDataUrl: imageTask.imageDataUrl,
                temperature,
                signal: upstreamController.signal
              })
            : await streamTranslateImage({
              endpoint: provider.endpoint,
              apiKey: provider.apiKey,
              model: provider.visionModel,
              headers: provider.headers,
              imageDataUrl: imageTask.imageDataUrl,
              domain,
              previousSummary,
              glossary,
              temperature,
              signal: upstreamController.signal
            })
          : await streamTranslate({
              endpoint: provider.endpoint,
              apiKey: provider.apiKey,
              model: provider.model,
              headers: provider.headers,
              text: chunk!.originalChinese,
              domain,
              previousSummary,
              glossary,
              temperature,
              signal: upstreamController.signal
            });

        let full = "";
        send("start", { model: usedModel, provider: provider.id });

        for await (const delta of deltas) {
          full += delta;
          send("delta", { text: delta });
        }

        const normalized = normalizeTranslationFootnotes(full);
        send("done", { text: normalized, model: usedModel, provider: provider.id });
      } catch (error) {
        if (!upstreamController.signal.aborted) {
          const message =
            error instanceof ProviderRequestError
              ? toProviderFriendlyError(provider, error.status, error.message)
              : `${provider.label} translation failed.`;
          send("error", {
            error: message,
            status: error instanceof ProviderRequestError ? error.status : 500
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
