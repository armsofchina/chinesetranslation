import "server-only";

import { NextRequest } from "next/server";

export class OpenRouterOAuthConfigurationError extends Error {
  constructor(
    public readonly code: "invalid_site_url",
    message: string
  ) {
    super(message);
    this.name = "OpenRouterOAuthConfigurationError";
  }
}

const parseUrl = (value: string, errorMessage: string): URL => {
  try {
    return new URL(value);
  } catch {
    throw new OpenRouterOAuthConfigurationError("invalid_site_url", errorMessage);
  }
};

export const getRequestOrigin = (request: NextRequest): string => {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
};

export const getAppBaseUrl = (fallbackOrigin: string): string => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const fallbackUrl = parseUrl(fallbackOrigin, "The request origin is not a valid URL.");
  const fallbackIsLocal = fallbackUrl.hostname === "localhost" || fallbackUrl.hostname === "127.0.0.1";
  const parsedConfiguredUrl = configuredUrl
    ? parseUrl(configuredUrl, "NEXT_PUBLIC_SITE_URL must be a valid absolute URL.")
    : undefined;
  const configuredIsLocal = parsedConfiguredUrl?.hostname === "localhost" || parsedConfiguredUrl?.hostname === "127.0.0.1";
  const ignoreLocalProductionPlaceholder = process.env.NODE_ENV === "production" && !fallbackIsLocal && configuredIsLocal;
  const url = process.env.NODE_ENV !== "production" && fallbackIsLocal
    ? fallbackUrl
    : ignoreLocalProductionPlaceholder
      ? fallbackUrl
      : parsedConfiguredUrl || fallbackUrl;
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localDevelopment) {
    throw new OpenRouterOAuthConfigurationError(
      "invalid_site_url",
      "NEXT_PUBLIC_SITE_URL must use HTTPS outside local development."
    );
  }
  return url.origin;
};

export const getOpenRouterAuthorizationUrl = (): string =>
  process.env.OPENROUTER_AUTH_URL?.trim() || "https://openrouter.ai/auth";

export const getOpenRouterKeyExchangeUrl = (): string =>
  process.env.OPENROUTER_AUTH_KEYS_URL?.trim() || "https://openrouter.ai/api/v1/auth/keys";
