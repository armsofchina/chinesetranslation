import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_MODEL, OpenRouterRequestError, translateWithOpenRouter } from "@/lib/openrouter";
import { TranslationChunk } from "@/lib/types";

type TranslateRequestBody = {
  chunks: TranslationChunk[];
  userOpenRouterApiKey?: string;
  model?: string;
};

export const runtime = "nodejs";

const toUserFriendlyError = (status: number, message: string): string => {
  const normalized = message.toLowerCase();
  if (status === 401 || normalized.includes("invalid api key")) {
    return "Invalid OpenRouter API key. Check your key and try again.";
  }
  if (status === 429) {
    return "OpenRouter rate limit reached. Please wait and try again.";
  }
  if (status === 402 || normalized.includes("insufficient") || normalized.includes("credit")) {
    return "OpenRouter reports insufficient credits or payment issues for this key.";
  }
  return message || "Translation API failed.";
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const incomingChunks = Array.isArray(body?.chunks) ? body.chunks : [];

    if (incomingChunks.length === 0) {
      return NextResponse.json({ error: "No text chunks provided for translation." }, { status: 400 });
    }

    const model = body.model?.trim() || DEFAULT_MODEL;

    // Default app key is loaded only on the server from process.env.
    const defaultServerKey = process.env.OPENROUTER_API_KEY?.trim();
    // If user provides a key in this request, it overrides the default server key.
    const selectedApiKey = body.userOpenRouterApiKey?.trim() || defaultServerKey;

    if (!selectedApiKey) {
      return NextResponse.json(
        {
          error:
            "No OpenRouter API key is configured. Add a key in settings or configure OPENROUTER_API_KEY on the server."
        },
        { status: 400 }
      );
    }

    const translatedChunks = await Promise.all(
      incomingChunks.map(async (chunk) => {
        const translatedEnglish = await translateWithOpenRouter({
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

    return NextResponse.json({ chunks: translatedChunks, model });
  } catch (error) {
    if (error instanceof OpenRouterRequestError) {
      return NextResponse.json(
        { error: toUserFriendlyError(error.status, error.message) },
        { status: error.status >= 400 ? error.status : 500 }
      );
    }

    return NextResponse.json({ error: "Translation API failed." }, { status: 500 });
  }
}
