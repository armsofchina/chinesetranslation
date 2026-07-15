import { NextRequest } from "next/server";
import {
  ProviderRequestError,
  streamOcrImage,
  streamTranslate,
  streamTranslateImage
} from "@/lib/openAiCompatible";
import { normalizeAiProvider } from "@/lib/aiProviders";
import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import {
  getMissingProviderKeyMessage,
  resolveProviderContext,
  toProviderFriendlyError
} from "@/lib/providerServer";
import { checkRateLimit, getRequestClientKey } from "@/lib/rateLimit";
import { buildSegmentQaReport } from "@/lib/segmentQa";
import { validateStreamRequest } from "@/lib/translateRequest";
import { OPENROUTER_SESSION_COOKIE, parseOpenRouterSession } from "@/lib/openRouterSession";

export const runtime = "nodejs";

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 22_500_000) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }
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

  let body: ReturnType<typeof validateStreamRequest>;
  try {
    body = validateStreamRequest(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 400 });
  }
  const { chunk, imageTask } = body;
  if (body.provider === "openrouter" && !body.userOpenRouterApiKey) {
    body.userOpenRouterApiKey = parseOpenRouterSession(request.cookies.get(OPENROUTER_SESSION_COOKIE)?.value)?.apiKey;
  }

  const providerId = normalizeAiProvider(body.provider);
  const provider = resolveProviderContext(body);
  if (!provider) {
    return new Response(
      JSON.stringify({
        error: getMissingProviderKeyMessage(providerId)
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { domain, previousSummary, glossary, temperature } = body;

  const encoder = new TextEncoder();
  const upstreamController = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    upstreamController.abort();
  }, 120_000);
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
        const qa = chunk ? buildSegmentQaReport(chunk, normalized, glossary) : undefined;
        send("done", {
          text: normalized,
          model: usedModel,
          provider: provider.id,
          segment: chunk ? { id: chunk.id, pageNumber: chunk.pageNumber, qa } : undefined
        });
      } catch (error) {
        if (!request.signal.aborted) {
          const message =
            timedOut
              ? `${provider.label} did not respond within two minutes.`
              : error instanceof ProviderRequestError
              ? toProviderFriendlyError(provider, error.status, error.message)
              : `${provider.label} translation failed.`;
          send("error", {
            error: message,
            status: error instanceof ProviderRequestError ? error.status : 500
          });
        }
      } finally {
        clearTimeout(timeout);
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
