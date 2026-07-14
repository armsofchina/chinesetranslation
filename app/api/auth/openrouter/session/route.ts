import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterSession } from "@/lib/providerServer";
import {
  getOpenRouterSessionCookieOptions,
  OPENROUTER_SESSION_COOKIE
} from "@/lib/openRouterSession";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getOpenRouterSession(request);
  return NextResponse.json(
    session
      ? { connected: true, userId: session.userId, connectedAt: session.connectedAt }
      : { connected: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false });
  response.cookies.set(OPENROUTER_SESSION_COOKIE, "", getOpenRouterSessionCookieOptions(0));
  return response;
}
