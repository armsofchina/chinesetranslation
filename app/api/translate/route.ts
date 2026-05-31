import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, PpqRequestError, translateImageWithPpq, translateWithPpq } from "@/lib/ppq";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type TranslateRequestBody = {
  chunks?: TranslationChunk[];
  imageTasks?: TranslateImageTask[];
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
  if (status === 402 || normalized.includes("insufficient") || normalized.includes("credit") || normalized.includes("balance")) {
    return "PPQ reports insufficient balance or payment issues for this key.";
  }
  return message || "Translation API failed.";
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const incomingChunks = Array.isArray(body?.chunks) ? body.chunks : [];
    const incomingImageTasks = Array.isArray(body?.imageTasks) ? body.imageTasks : [];

    if (incomingChunks.length === 0 && incomingImageTasks.length === 0) {
      return NextResponse.json({ error: "No text or image inputs provided for translation." }, { status: 400 });
    }

    const model = body.model?.trim() || DEFAULT_MODEL;
    const imageModel = process.env.PPQ_VISION_MODEL?.trim() || model;

    // Default app key is loaded only on the server from process.env.
    const defaultServerKey = process.env.PPQ_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    // If user provides a key in this request, it overrides the default server key.
    const selectedApiKey =
      body.userPpqApiKey?.trim() || body.userApiKey?.trim() || body.userOpenRouterApiKey?.trim() || defaultServerKey;

    if (!selectedApiKey) {
      return NextResponse.json(
        {
          error:
            "No PPQ API key is configured. Add a key in settings or configure PPQ_API_KEY on the server."
        },
        { status: 400 }
      );
    }

    const translatedTextChunks = await Promise.all(
      incomingChunks.map(async (chunk) => {
        const translatedEnglish = await translateWithPpq({
          apiKey: selectedApiKey,
          model,
          text: chunk.originalChinese
        });

        return {
          id: chunk.id,
          pageNumber: chunk.pageNumber,
          originalChinese: chunk.originalChinese,
          translatedEnglish
        } satisfies TranslationChunk;
      })
    );

    const translatedImageChunks = await Promise.all(
      incomingImageTasks.map(async (task) => {
        const translatedEnglish = await translateImageWithPpq({
          apiKey: selectedApiKey,
          model: imageModel,
          imageDataUrl: task.imageDataUrl
        });

        return {
          id: task.id,
          pageNumber: task.pageNumber,
          originalChinese: "[Image-based source text]",
          translatedEnglish
        } satisfies TranslationChunk;
      })
    );

    const translatedChunks = [...translatedTextChunks, ...translatedImageChunks];

    return NextResponse.json({ chunks: translatedChunks, model });
  } catch (error) {
    if (error instanceof PpqRequestError) {
      return NextResponse.json(
        { error: toUserFriendlyError(error.status, error.message) },
        { status: error.status >= 400 ? error.status : 500 }
      );
    }

    return NextResponse.json({ error: "Translation API failed." }, { status: 500 });
  }
}
