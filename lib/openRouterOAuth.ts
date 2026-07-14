import "server-only";

import { NextRequest } from "next/server";

export const getRequestOrigin = (request: NextRequest): string => {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
};

export const getAppBaseUrl = (fallbackOrigin: string): string => {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const fallbackUrl = new URL(fallbackOrigin);
  const fallbackIsLocal = fallbackUrl.hostname === "localhost" || fallbackUrl.hostname === "127.0.0.1";
  const url = new URL(process.env.NODE_ENV !== "production" && fallbackIsLocal ? fallbackOrigin : configuredUrl || fallbackOrigin);
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !localDevelopment) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside local development.");
  }
  return url.origin;
};

export const getOpenRouterAuthorizationUrl = (): string =>
  process.env.OPENROUTER_AUTH_URL?.trim() || "https://openrouter.ai/auth";

export const getOpenRouterKeyExchangeUrl = (): string =>
  process.env.OPENROUTER_AUTH_KEYS_URL?.trim() || "https://openrouter.ai/api/v1/auth/keys";
