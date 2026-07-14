export type AiProviderId = "ppq" | "openrouter";

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  ppq: "PPQ",
  openrouter: "OpenRouter"
};

export const normalizeAiProvider = (value: unknown): AiProviderId =>
  value === "openrouter" ? "openrouter" : "ppq";
