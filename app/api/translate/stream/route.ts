import { NextRequest } from "next/server";
import {
  DEFAULT_MODEL,
  PpqRequestError,
  streamTranslateImageWithPpq,
  streamTranslateWithPpq
} from "@/lib/ppq";
import { normalizeTranslationFootnotes } from "@/lib/footnotes";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type StreamRequestBody = {
  chunk?: TranslationChunk;
  imageTask?: TranslateImageTask;
  userApiKey?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  model?: string;
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
  const body = (await request.json().catch(() => null)) as StreamRequestBody | null;

  const chunk = body?.chunk;
  const imageTask = body?.imageTask;

  if (!chunk && !imageTask) {
    return new Response(JSON.stringify({ error: "No text or image input provided." }), {
      status: 400,
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        const usedModel = imageTask ? imageModel : model;
        const deltas = imageTask
          ? await streamTranslateImageWithPpq({
              apiKey: selectedApiKey,
              model: imageModel,
              imageDataUrl: imageTask.imageDataUrl
            })
          : await streamTranslateWithPpq({
              apiKey: selectedApiKey,
              model,
              text: chunk!.originalChinese
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
        const message =
          error instanceof PpqRequestError
            ? toUserFriendlyError(error.status, error.message)
            : "Translation API failed.";
        send("error", { error: message });
      } finally {
        controller.close();
      }
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
