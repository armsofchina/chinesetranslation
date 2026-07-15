import { normalizeAiProvider } from "@/lib/aiProviders";
import { DOMAINS, TranslationDomain } from "@/lib/prompts";
import { TranslateImageTask, TranslationChunk } from "@/lib/types";

export type ValidatedStreamRequest = {
  chunk?: TranslationChunk;
  imageTask?: TranslateImageTask;
  provider: ReturnType<typeof normalizeAiProvider>;
  model?: string;
  userApiKey?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  domain: TranslationDomain;
  previousSummary?: string;
  glossary: Record<string, string>;
  temperature?: number;
};

const DOMAIN_IDS = new Set(DOMAINS.map((domain) => domain.id));
const MODEL_RE = /^[A-Za-z0-9._~:/-]+$/;
const IMAGE_RE = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/;

const optionalBoundedString = (value: unknown, max: number, field: string): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw new Error(`${field} is invalid.`);
  return value.trim();
};

export const validateStreamRequest = (input: unknown): ValidatedStreamRequest => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request body.");
  const body = input as Record<string, unknown>;
  const rawChunk = body.chunk;
  const rawImage = body.imageTask;
  if (Boolean(rawChunk) === Boolean(rawImage)) throw new Error("Provide exactly one text segment or image task.");

  let chunk: TranslationChunk | undefined;
  if (rawChunk && typeof rawChunk === "object" && !Array.isArray(rawChunk)) {
    const value = rawChunk as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 160) throw new Error("Segment id is invalid.");
    if (!Number.isSafeInteger(value.pageNumber) || Number(value.pageNumber) < 1 || Number(value.pageNumber) > 100_000) throw new Error("Segment page is invalid.");
    if (typeof value.originalChinese !== "string" || !value.originalChinese.trim()) throw new Error("Segment text is empty.");
    if (value.originalChinese.length > 20_000) throw new Error("This translation segment is too large.");
    chunk = { id: value.id, pageNumber: Number(value.pageNumber), originalChinese: value.originalChinese, translatedEnglish: "" };
  }

  let imageTask: TranslateImageTask | undefined;
  if (rawImage && typeof rawImage === "object" && !Array.isArray(rawImage)) {
    const value = rawImage as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 160) throw new Error("Image task id is invalid.");
    if (!Number.isSafeInteger(value.pageNumber) || Number(value.pageNumber) < 1 || Number(value.pageNumber) > 100_000) throw new Error("Image page is invalid.");
    if (typeof value.imageDataUrl !== "string" || value.imageDataUrl.length > 22_000_000 || !IMAGE_RE.test(value.imageDataUrl)) throw new Error("OCR image data is invalid or too large.");
    if (value.mode !== "ocr" && value.mode !== "translate" && value.mode !== undefined) throw new Error("Image task mode is invalid.");
    imageTask = { id: value.id, pageNumber: Number(value.pageNumber), imageDataUrl: value.imageDataUrl, mode: value.mode as "ocr" | "translate" | undefined };
  }

  const glossary: Record<string, string> = {};
  if (body.glossary !== undefined) {
    if (!body.glossary || typeof body.glossary !== "object" || Array.isArray(body.glossary)) throw new Error("Glossary is invalid.");
    const entries = Object.entries(body.glossary as Record<string, unknown>);
    if (entries.length > 500) throw new Error("The glossary is too large for one request.");
    for (const [source, target] of entries) {
      if (!source.trim() || source.length > 200 || typeof target !== "string" || !target.trim() || target.length > 500) throw new Error("A glossary entry is invalid.");
      glossary[source.trim()] = target.trim();
    }
  }

  const model = optionalBoundedString(body.model, 200, "Model");
  if (model && !MODEL_RE.test(model)) throw new Error("Model is invalid.");
  const rawDomain = typeof body.domain === "string" ? body.domain : "general";
  if (!DOMAIN_IDS.has(rawDomain as TranslationDomain)) throw new Error("Translation domain is invalid.");
  const temperature = body.temperature === undefined ? undefined : Number(body.temperature);
  if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 1)) throw new Error("Temperature is invalid.");

  return {
    chunk,
    imageTask,
    provider: normalizeAiProvider(body.provider),
    model,
    userApiKey: optionalBoundedString(body.userApiKey, 4096, "API key"),
    userPpqApiKey: optionalBoundedString(body.userPpqApiKey, 4096, "PPQ API key"),
    userOpenRouterApiKey: optionalBoundedString(body.userOpenRouterApiKey, 4096, "OpenRouter API key"),
    domain: rawDomain as TranslationDomain,
    previousSummary: optionalBoundedString(body.previousSummary, 4_000, "Previous context"),
    glossary,
    temperature
  };
};
