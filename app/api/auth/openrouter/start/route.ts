import { NextRequest, NextResponse } from "next/server";
import {
  getAppBaseUrl,
  getOpenRouterAuthorizationUrl,
  getRequestOrigin,
  OpenRouterOAuthConfigurationError
} from "@/lib/openRouterOAuth";
import {
  createPkceChallenge,
  createPkceVerifier,
  getOpenRouterPkceCookieOptions,
  OPENROUTER_PKCE_COOKIE,
  serializeOpenRouterPkceSession,
  assertOpenRouterSessionConfigured,
  OpenRouterSessionConfigurationError
} from "@/lib/openRouterSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getConfigurationErrorCode = (error: unknown) => {
  if (error instanceof OpenRouterOAuthConfigurationError) {
    return error.code;
  }
  if (error instanceof OpenRouterSessionConfigurationError) {
    return "session_configuration";
  }
  return "configuration_error";
};

const redirectToConfigurationError = (request: NextRequest, error: unknown) => {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("openrouter", "error");
  url.searchParams.set("openrouter_error", getConfigurationErrorCode(error));
  url.searchParams.set("settings", "connections");
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
};

export async function GET(request: NextRequest) {
  try {
    assertOpenRouterSessionConfigured();
    const verifier = createPkceVerifier();
    const challenge = createPkceChallenge(verifier);
    const baseUrl = getAppBaseUrl(getRequestOrigin(request));
    const callbackUrl = `${baseUrl}/api/auth/openrouter/callback`;
    const authorizationUrl = new URL(getOpenRouterAuthorizationUrl());
    authorizationUrl.searchParams.set("callback_url", callbackUrl);
    authorizationUrl.searchParams.set("code_challenge", challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.cookies.set(
      OPENROUTER_PKCE_COOKIE,
      serializeOpenRouterPkceSession({ verifier, createdAt: Date.now() }),
      getOpenRouterPkceCookieOptions(10 * 60)
    );
    return response;
  } catch (error) {
    console.error(
      "OpenRouter OAuth could not start:",
      error instanceof Error ? error.message : "Unknown configuration error."
    );
    return redirectToConfigurationError(request, error);
  }
}
