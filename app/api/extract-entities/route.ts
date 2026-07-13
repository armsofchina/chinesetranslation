import { NextRequest, NextResponse } from "next/server";
import { extractEntitiesWithLlm } from "@/lib/extractEntities";
import { TranslationDomain } from "@/lib/prompts";
import { checkRateLimit, getRequestClientKey } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`entities:${getRequestClientKey(request.headers)}`, {
      limit: 12,
      windowMs: 60_000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many glossary requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const domain = (body?.domain as TranslationDomain) || "general";
    const userKey = body?.userPpqApiKey?.trim();

    if (!text.trim()) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    if (text.length > 100_000) {
      return NextResponse.json({ error: "Source text is too large for glossary extraction." }, { status: 413 });
    }

    const serverKey = process.env.PPQ_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    const apiKey = userKey || serverKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: "No PPQ API key is configured." },
        { status: 400 }
      );
    }

    const model = process.env.PPQ_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "claude-sonnet-4-5";

    const entities = await extractEntitiesWithLlm({ text, apiKey, model, domain });
    return NextResponse.json({ entities });
  } catch {
    return NextResponse.json(
      { error: "Entity extraction failed." },
      { status: 500 }
    );
  }
}
