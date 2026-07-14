export const OPENROUTER_API_KEY_STORAGE = "translator-openrouter-oauth-key";
export const OPENROUTER_CONNECTION_STORAGE = "translator-openrouter-oauth-connection";

export type OpenRouterBrowserConnection = {
  userId?: string;
  connectedAt: number;
};

export const parseOpenRouterBrowserConnection = (
  value: string | null
): OpenRouterBrowserConnection | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OpenRouterBrowserConnection>;
    if (typeof parsed.connectedAt !== "number") {
      return undefined;
    }
    return {
      connectedAt: parsed.connectedAt,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined
    };
  } catch {
    return undefined;
  }
};
