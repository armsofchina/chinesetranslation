import "server-only";

import { AiProviderId, AI_PROVIDER_LABELS, normalizeAiProvider } from "@/lib/aiProviders";

export type ProviderRequestCredentials = {
  provider?: AiProviderId;
  userApiKey?: string;
  userPpqApiKey?: string;
  userOpenRouterApiKey?: string;
};

export type ProviderContext = {
  id: AiProviderId;
  label: string;
  apiKey: string;
  endpoint: string;
  model: string;
  visionModel: string;
  headers?: Record<string, string>;
};

const getOpenRouterHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const appName = process.env.OPENROUTER_APP_NAME?.trim() || "Translation Vibe";
  if (siteUrl) {
    headers["HTTP-Referer"] = siteUrl;
  }
  headers["X-OpenRouter-Title"] = appName;
  return headers;
};

export const resolveProviderContext = (
  body: ProviderRequestCredentials & { model?: string }
): ProviderContext | undefined => {
  const id = normalizeAiProvider(body.provider);
  const requestedModel = body.model?.trim();

  if (id === "openrouter") {
    const apiKey =
      body.userOpenRouterApiKey?.trim() ||
      body.userApiKey?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return undefined;
    }
    const allowedModels = process.env.OPENROUTER_ALLOWED_MODELS?.split(",").map((value) => value.trim()).filter(Boolean);
    const requestedModelAllowed = !requestedModel || !allowedModels?.length || allowedModels.includes(requestedModel);
    const model = (requestedModelAllowed ? requestedModel : undefined) || process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
    return {
      id,
      label: AI_PROVIDER_LABELS[id],
      apiKey,
      endpoint:
        process.env.OPENROUTER_CHAT_COMPLETIONS_URL?.trim() ||
        "https://openrouter.ai/api/v1/chat/completions",
      model,
      visionModel: process.env.OPENROUTER_VISION_MODEL?.trim() || "openrouter/free",
      headers: getOpenRouterHeaders()
    };
  }

  const apiKey =
    body.userPpqApiKey?.trim() || body.userApiKey?.trim() || process.env.PPQ_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }
  const model = requestedModel || process.env.PPQ_MODEL?.trim() || "claude-sonnet-4-5";
  return {
    id,
    label: AI_PROVIDER_LABELS[id],
    apiKey,
    endpoint: process.env.PPQ_CHAT_COMPLETIONS_URL?.trim() || "https://api.ppq.ai/chat/completions",
    model,
    visionModel: process.env.PPQ_VISION_MODEL?.trim() || model
  };
};

export const getMissingProviderKeyMessage = (provider: AiProviderId): string =>
  provider === "openrouter"
    ? "Connect OpenRouter in settings or configure OPENROUTER_API_KEY on the server."
    : "Add a PPQ key in settings or configure PPQ_API_KEY on the server.";

export const toProviderFriendlyError = (provider: ProviderContext, status: number, message: string): string => {
  const normalized = message.toLowerCase();
  if (status === 401 || status === 403 || normalized.includes("invalid api key")) {
    return `Invalid ${provider.label} API key. Reconnect or check the key and try again.`;
  }
  if (status === 429) {
    return `${provider.label} rate limit reached. Please wait and try again.`;
  }
  if (
    status === 402 ||
    normalized.includes("insufficient") ||
    normalized.includes("credit") ||
    normalized.includes("balance")
  ) {
    return `${provider.label} reports insufficient balance or payment issues for this key.`;
  }
  return message || `${provider.label} translation failed.`;
};
