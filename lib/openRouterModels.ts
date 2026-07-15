export const OPENROUTER_AUTO_FREE_MODEL = "openrouter/free";

export const normalizeOpenRouterModel = (value: unknown): string => {
  const model = typeof value === "string" ? value.trim() : "";
  return model && model.length <= 200 && /^[A-Za-z0-9._~:/-]+$/.test(model)
    ? model
    : OPENROUTER_AUTO_FREE_MODEL;
};

export type OpenRouterModelOption = {
  id: string;
  name: string;
  free: boolean;
  automatic?: boolean;
  contextLength?: number;
  promptPricePerMillion?: number;
  completionPricePerMillion?: number;
};

export const AUTO_FREE_OPENROUTER_MODEL: OpenRouterModelOption = {
  id: OPENROUTER_AUTO_FREE_MODEL,
  name: "Auto-select an available free model",
  free: true,
  automatic: true
};
