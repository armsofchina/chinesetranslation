import { NextResponse } from "next/server";
import {
  AUTO_FREE_OPENROUTER_MODEL,
  OpenRouterModelOption
} from "@/lib/openRouterModels";

export const revalidate = 900;
export const dynamic = "force-dynamic";

type OpenRouterCatalogModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  architecture?: {
    input_modalities?: unknown;
    output_modalities?: unknown;
  };
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  };
};

const parsePricePerMillion = (value: unknown): number | undefined => {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price * 1_000_000 : undefined;
};

const modelPriority = (model: OpenRouterModelOption): number => {
  if (model.automatic) {
    return 0;
  }
  if (model.free && model.id.startsWith("deepseek/")) {
    return 1;
  }
  if (model.free && model.id.startsWith("moonshotai/")) {
    return 2;
  }
  return model.free ? 3 : 4;
};

const parseCatalogModel = (model: OpenRouterCatalogModel): OpenRouterModelOption | undefined => {
  const id = typeof model.id === "string" ? model.id.trim() : "";
  const name = typeof model.name === "string" ? model.name.trim() : "";
  const inputModalities = Array.isArray(model.architecture?.input_modalities)
    ? model.architecture.input_modalities
    : [];
  const outputModalities = Array.isArray(model.architecture?.output_modalities)
    ? model.architecture.output_modalities
    : [];
  if (
    !id ||
    id.length > 200 ||
    !/^[A-Za-z0-9._~:/-]+$/.test(id) ||
    !inputModalities.includes("text") ||
    !outputModalities.includes("text")
  ) {
    return undefined;
  }

  const promptPricePerMillion = parsePricePerMillion(model.pricing?.prompt);
  const completionPricePerMillion = parsePricePerMillion(model.pricing?.completion);
  const free = id.endsWith(":free");
  const contextLength = typeof model.context_length === "number" && Number.isFinite(model.context_length)
    ? model.context_length
    : undefined;
  return {
    id,
    name: name.slice(0, 160) || id,
    free,
    contextLength,
    promptPricePerMillion,
    completionPricePerMillion
  };
};

export async function GET() {
  try {
    const response = await fetch(
      process.env.OPENROUTER_MODELS_URL?.trim() || "https://openrouter.ai/api/v1/models",
      {
        headers: { Accept: "application/json" },
        next: { revalidate }
      }
    );
    if (!response.ok) {
      throw new Error(`OpenRouter model catalog returned ${response.status}.`);
    }
    const payload = (await response.json()) as { data?: OpenRouterCatalogModel[] };
    const parsedModels = Array.isArray(payload.data)
      ? payload.data.map(parseCatalogModel).filter((model): model is OpenRouterModelOption => Boolean(model))
      : [];
    const uniqueModels = Array.from(
      new Map(parsedModels.map((model) => [model.id, model])).values()
    ).filter((model) => model.id !== AUTO_FREE_OPENROUTER_MODEL.id);
    const models = [AUTO_FREE_OPENROUTER_MODEL, ...uniqueModels].sort((left, right) => {
      const priorityDifference = modelPriority(left) - modelPriority(right);
      return priorityDifference || left.name.localeCompare(right.name);
    });

    return NextResponse.json(
      { models, catalogAvailable: true },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error(
      "Unable to load the OpenRouter model catalog:",
      error instanceof Error ? error.message : "Unknown catalog error."
    );
    return NextResponse.json(
      { models: [AUTO_FREE_OPENROUTER_MODEL], catalogAvailable: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
