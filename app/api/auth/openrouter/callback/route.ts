import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, getOpenRouterKeyExchangeUrl, getRequestOrigin } from "@/lib/openRouterOAuth";
import {
  getOpenRouterSessionCookieOptions,
  OPENROUTER_PKCE_COOKIE,
  OPENROUTER_SESSION_COOKIE,
  OpenRouterPkceSession,
  sealOpenRouterValue,
  unsealOpenRouterValue
} from "@/lib/openRouterSession";

export const runtime = "nodejs";

const redirectToApp = (baseUrl: string, result: "connected" | "error") => {
  const url = new URL("/", baseUrl);
  url.searchParams.set("openrouter", result);
  url.searchParams.set("settings", "connections");
  return NextResponse.redirect(url);
};

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(getRequestOrigin(request));
  const code = request.nextUrl.searchParams.get("code");
  const pkceSession = unsealOpenRouterValue<OpenRouterPkceSession>(
    request.cookies.get(OPENROUTER_PKCE_COOKIE)?.value
  );

  if (!code || !pkceSession || Date.now() - pkceSession.createdAt > 10 * 60 * 1000) {
    const response = redirectToApp(baseUrl, "error");
    response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterSessionCookieOptions(0));
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

    const response = redirectToApp(baseUrl, "connected");
    response.cookies.set(
      OPENROUTER_SESSION_COOKIE,
      sealOpenRouterValue({
        apiKey,
        userId: typeof payload?.user_id === "string" ? payload.user_id : undefined,
        connectedAt: Date.now()
      }),
      getOpenRouterSessionCookieOptions(30 * 24 * 60 * 60)
    );
    response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterSessionCookieOptions(0));
    return response;
  } catch {
    const response = redirectToApp(baseUrl, "error");
    response.cookies.set(OPENROUTER_PKCE_COOKIE, "", getOpenRouterSessionCookieOptions(0));
    return response;
  }
}
