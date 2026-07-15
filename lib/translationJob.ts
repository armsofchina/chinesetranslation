import { AiProviderId } from "@/lib/aiProviders";
import { TranslationDomain } from "@/lib/prompts";
import { ExtractedPdfPage, TranslationChunk } from "@/lib/types";

export type TranslationJobSnapshot = Readonly<{
  id: string;
  createdAt: number;
  sourceRevision: number;
  provider: AiProviderId;
  model?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  domain: TranslationDomain;
  glossary: Readonly<Record<string, string>>;
  chunks: ReadonlyArray<Readonly<TranslationChunk>>;
  pages: ReadonlyArray<Readonly<ExtractedPdfPage>>;
  imageDataUrl?: string;
}>;

const copyAndFreezeChunk = (chunk: TranslationChunk): Readonly<TranslationChunk> =>
  Object.freeze({ ...chunk });

export const createTranslationJob = (input: {
  sourceRevision: number;
  provider: AiProviderId;
  model?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
  domain: TranslationDomain;
  glossary: Record<string, string>;
  chunks: TranslationChunk[];
  pages?: ExtractedPdfPage[];
  imageDataUrl?: string;
}): TranslationJobSnapshot => {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return Object.freeze({
    id,
    createdAt: Date.now(),
    sourceRevision: input.sourceRevision,
    provider: input.provider,
    model: input.model,
    userPpqApiKey: input.userPpqApiKey,
    userOpenRouterApiKey: input.userOpenRouterApiKey,
    domain: input.domain,
    glossary: Object.freeze({ ...input.glossary }),
    chunks: Object.freeze(input.chunks.map(copyAndFreezeChunk)),
    pages: Object.freeze((input.pages || []).map((page) => Object.freeze({ ...page }))),
    imageDataUrl: input.imageDataUrl
  });
};

export const assertCurrentTranslationJob = (
  activeJobId: string | undefined,
  expectedJobId: string,
  signal?: AbortSignal
): void => {
  if (signal?.aborted || activeJobId !== expectedJobId) {
    throw new DOMException("The translation job is no longer active.", "AbortError");
  }
};
