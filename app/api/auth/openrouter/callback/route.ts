import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, getOpenRouterKeyExchangeUrl, getRequestOrigin } from "@/lib/openRouterOAuth";
import {
  getOpenRouterPkceCookieOptions,
  getOpenRouterSessionCookieOptions,
  OPENROUTER_PKCE_COOKIE,
  OPENROUTER_SESSION_COOKIE,
  parseOpenRouterPkceSession,
  sealOpenRouterSession
} from "@/lib/openRouterSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redirectToApp = (baseUrl: string, result: "connected" | "error", errorCode?: string) => {
  const url = new URL("/", baseUrl);
  url.searchParams.set("openrouter", result);
  if (errorCode) {
    url.searchParams.set("openrouter_error", errorCode);
  }
  url.searchParams.set("settings", "connections");
  return NextResponse.redirect(url);
};

const redirectToRequestOrigin = (request: NextRequest, errorCode: string) => {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("openrouter", "error");
  url.searchParams.set("openrouter_error", errorCode);
  url.searchParams.set("settings", "connections");
  return NextResponse.redirect(url);
};

const createSessionResponse = (
  baseUrl: string,
  apiKey: string,
  userId?: string
) => {
  const connectedUrl = new URL("/", baseUrl);
  connectedUrl.searchParams.set("openrouter", "connected");
  connectedUrl.searchParams.set("settings", "connections");
  const response = NextResponse.redirect(connectedUrl);
  response.cookies.set(OPENROUTER_SESSION_COOKIE, sealOpenRouterSession({ apiKey, userId, connectedAt: Date.now() }), getOpenRouterSessionCookieOptions());
  response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterPkceCookieOptions(0));
  return response;
};

export async function GET(request: NextRequest) {
  let baseUrl: string;
  try {
    baseUrl = getAppBaseUrl(getRequestOrigin(request));
  } catch (error) {
    console.error(
      "OpenRouter OAuth callback is misconfigured:",
      error instanceof Error ? error.message : "Unknown configuration error."
    );
    return redirectToRequestOrigin(request, "invalid_site_url");
  }
  const code = request.nextUrl.searchParams.get("code");
  const pkceSession = parseOpenRouterPkceSession(
    request.cookies.get(OPENROUTER_PKCE_COOKIE)?.value
  );

  if (!code || !pkceSession || Date.now() - pkceSession.createdAt > 10 * 60 * 1000) {
    const response = redirectToApp(baseUrl, "error", "session_expired");
    response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterPkceCookieOptions(0));
    return response;
  }

  try {
    const exchangeResponse = await fetch(getOpenRouterKeyExchangeUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: pkceSession.verifier,
        code_challenge_method: "S256"
      }),
      cache: "no-store"
    });
    const payload = await exchangeResponse.json().catch(() => null);
    const apiKey = typeof payload?.key === "string" ? payload.key.trim() : "";
    if (!exchangeResponse.ok || !apiKey) {
      throw new Error("OpenRouter key exchange failed.");
    }

    return createSessionResponse(
      baseUrl,
      apiKey,
      typeof payload?.user_id === "string" ? payload.user_id : undefined
    );
  } catch (error) {
    console.error(
      "OpenRouter OAuth key exchange failed:",
      error instanceof Error ? error.message : "Unknown key exchange error."
    );
    const response = redirectToApp(baseUrl, "error", "key_exchange_failed");
    response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterPkceCookieOptions(0));
    return response;
  }
}
