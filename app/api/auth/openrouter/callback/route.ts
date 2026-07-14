import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAppBaseUrl, getOpenRouterKeyExchangeUrl, getRequestOrigin } from "@/lib/openRouterOAuth";
import {
  OPENROUTER_API_KEY_STORAGE,
  OPENROUTER_CONNECTION_STORAGE
} from "@/lib/openRouterBrowser";
import {
  getOpenRouterPkceCookieOptions,
  OPENROUTER_PKCE_COOKIE,
  parseOpenRouterPkceSession
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

const createBrowserStorageResponse = (
  baseUrl: string,
  apiKey: string,
  userId?: string
) => {
  const connectedUrl = new URL("/", baseUrl);
  connectedUrl.searchParams.set("openrouter", "connected");
  connectedUrl.searchParams.set("settings", "connections");
  const storageErrorUrl = new URL("/", baseUrl);
  storageErrorUrl.searchParams.set("openrouter", "error");
  storageErrorUrl.searchParams.set("openrouter_error", "storage_failed");
  storageErrorUrl.searchParams.set("settings", "connections");
  const handoff = Buffer.from(JSON.stringify({
    apiKey,
    apiKeyStorageKey: OPENROUTER_API_KEY_STORAGE,
    connectionStorageKey: OPENROUTER_CONNECTION_STORAGE,
    connection: { userId, connectedAt: Date.now() },
    connectedUrl: connectedUrl.toString()
  }), "utf8").toString("base64");
  const nonce = randomBytes(18).toString("base64");
  const storageErrorUrlLiteral = JSON.stringify(storageErrorUrl.toString()).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Connecting OpenRouter</title>
    <style nonce="${nonce}">
      body { align-items: center; background: #f8fafc; color: #0f172a; display: flex; font-family: ui-sans-serif, system-ui, sans-serif; justify-content: center; margin: 0; min-height: 100vh; }
      main { text-align: center; }
      p { color: #64748b; }
    </style>
  </head>
  <body>
    <main><h1>Connecting OpenRouter…</h1><p>Saving your connection in this browser.</p></main>
    <script nonce="${nonce}">
      try {
        const bytes = Uint8Array.from(atob("${handoff}"), (character) => character.charCodeAt(0));
        const handoff = JSON.parse(new TextDecoder().decode(bytes));
        localStorage.setItem(handoff.apiKeyStorageKey, handoff.apiKey);
        localStorage.setItem(handoff.connectionStorageKey, JSON.stringify(handoff.connection));
        window.location.replace(handoff.connectedUrl);
      } catch {
        window.location.replace(${storageErrorUrlLiteral});
      }
    </script>
  </body>
</html>`;
  const response = new NextResponse(html, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    }
  });
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

    return createBrowserStorageResponse(
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
