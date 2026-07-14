import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, getOpenRouterAuthorizationUrl, getRequestOrigin } from "@/lib/openRouterOAuth";
import {
  createPkceChallenge,
  createPkceVerifier,
  getOpenRouterSessionCookieOptions,
  OPENROUTER_PKCE_COOKIE,
  sealOpenRouterValue
} from "@/lib/openRouterSession";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const verifier = createPkceVerifier();
    const challenge = createPkceChallenge(verifier);
    const baseUrl = getAppBaseUrl(getRequestOrigin(request));
    const callbackUrl = `${baseUrl}/api/auth/openrouter/callback`;
    const authorizationUrl = new URL(getOpenRouterAuthorizationUrl());
    authorizationUrl.searchParams.set("callback_url", callbackUrl);
    authorizationUrl.searchParams.set("code_challenge", challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(
      OPENROUTER_PKCE_COOKIE,
      sealOpenRouterValue({ verifier, createdAt: Date.now() }),
      getOpenRouterSessionCookieOptions(10 * 60)
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "OpenRouter connection is not configured correctly." },
      { status: 500 }
    );
  }
}
