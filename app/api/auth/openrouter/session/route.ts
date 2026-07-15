import { NextRequest, NextResponse } from "next/server";
import {
  getOpenRouterSessionCookieOptions,
  OPENROUTER_SESSION_COOKIE,
  parseOpenRouterSession
} from "@/lib/openRouterSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseOpenRouterSession(request.cookies.get(OPENROUTER_SESSION_COOKIE)?.value);
  return NextResponse.json(
    { connected: Boolean(session), userId: session?.userId },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(OPENROUTER_SESSION_COOKIE, "", getOpenRouterSessionCookieOptions(0));
  return response;
}
