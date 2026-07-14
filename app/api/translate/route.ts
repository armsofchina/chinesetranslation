import { NextRequest, NextResponse } from "next/server";
import { AiProviderId, normalizeAiProvider } from "@/lib/aiProviders";
import { ProviderRequestError, translateImage, translateText } from "@/lib/openAiCompatible";
import {
  getMissingProviderKeyMessage,
  resolveProviderContext,
  toProviderFriendlyError
} from "@/lib/providerServer";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

type TranslateRequestBody = {
  chunks?: TranslationChunk[];
  imageTasks?: TranslateImageTask[];
  provider?: AiProviderId;
  userApiKey?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  model?: string;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let providerContext: ReturnType<typeof resolveProviderContext>;
  try {
    const body = (await request.json()) as TranslateRequestBody;
    const incomingChunks = Array.isArray(body?.chunks) ? body.chunks : [];
    const incomingImageTasks = Array.isArray(body?.imageTasks) ? body.imageTasks : [];

    if (incomingChunks.length === 0 && incomingImageTasks.length === 0) {
      return NextResponse.json({ error: "No text or image inputs provided for translation." }, { status: 400 });
    }

    providerContext = resolveProviderContext(request, body);
    if (!providerContext) {
      return NextResponse.json(
        {
          error: getMissingProviderKeyMessage(normalizeAiProvider(body.provider))
        },
        { status: 400 }
      );
    }

    const translatedTextChunks = await Promise.all(
      incomingChunks.map(async (chunk) => {
        const translatedEnglish = await translateText({
          endpoint: providerContext!.endpoint,
          apiKey: providerContext!.apiKey,
          model: providerContext!.model,
          headers: providerContext!.headers,
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
        const translatedEnglish = await translateImage({
          endpoint: providerContext!.endpoint,
          apiKey: providerContext!.apiKey,
          model: providerContext!.visionModel,
          headers: providerContext!.headers,
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

    return NextResponse.json({
      chunks: translatedChunks,
      model: incomingChunks.length > 0 ? providerContext.model : providerContext.visionModel,
      provider: providerContext.id
    });
  } catch (error) {
    if (error instanceof ProviderRequestError && providerContext) {
      return NextResponse.json(
        { error: toProviderFriendlyError(providerContext, error.status, error.message) },
        { status: error.status >= 400 ? error.status : 500 }
      );
    }

    return NextResponse.json({ error: "Translation API failed." }, { status: 500 });
  }
}
