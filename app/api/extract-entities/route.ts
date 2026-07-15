import { NextRequest, NextResponse } from "next/server";
import { AiProviderId, normalizeAiProvider } from "@/lib/aiProviders";
import { extractEntitiesWithLlm } from "@/lib/extractEntities";
import { TranslationDomain } from "@/lib/prompts";
import { getMissingProviderKeyMessage, resolveProviderContext } from "@/lib/providerServer";
import { checkRateLimit, getRequestClientKey } from "@/lib/rateLimit";
import { OPENROUTER_SESSION_COOKIE, parseOpenRouterSession } from "@/lib/openRouterSession";

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
    const providerId = normalizeAiProvider(body?.provider as AiProviderId | undefined);

    if (!text.trim()) {
      return NextResponse.json({ error: "No text provided." }, { status: 400 });
    }

    if (text.length > 100_000) {
      return NextResponse.json({ error: "Source text is too large for glossary extraction." }, { status: 413 });
    }

    if (providerId === "openrouter" && !body.userOpenRouterApiKey) {
      body.userOpenRouterApiKey = parseOpenRouterSession(request.cookies.get(OPENROUTER_SESSION_COOKIE)?.value)?.apiKey;
    }
    const provider = resolveProviderContext(body || {});
    if (!provider) {
      return NextResponse.json(
        { error: getMissingProviderKeyMessage(providerId) },
        { status: 400 }
      );
    }

    const entities = await extractEntitiesWithLlm({
      text,
      apiKey: provider.apiKey,
      model: provider.model,
      domain,
      endpoint: provider.endpoint,
      headers: provider.headers
    });
    return NextResponse.json({ entities });
  } catch {
    return NextResponse.json(
      { error: "Entity extraction failed." },
      { status: 500 }
    );
  }
}
