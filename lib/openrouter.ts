const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";

const SYSTEM_PROMPT =
  "You are a professional Chinese-to-English translator. Translate Traditional Chinese and Simplified Chinese into clear, natural English. Preserve meaning, tone, names, dates, numbers, headings, bullet points, numbered lists, technical terms, historical terms, military terms, legal terms, archival terms, and paragraph structure. Do not summarize. Do not add information that is not present in the original. Output only the English translation.";

export class OpenRouterRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type TranslateChunkInput = {
  apiKey: string;
  model: string;
  text: string;
};

export const translateWithOpenRouter = async ({ apiKey, model, text }: TranslateChunkInput): Promise<string> => {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.NEXT_PUBLIC_SITE_URL ? { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL } : {}),
      "X-Title": "Chinese PDF/Text Translator"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Translate this Chinese text into clean English:\n\n${text}`
        }
      ],
      temperature: 0.2
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || "Translation request failed.";
    throw new OpenRouterRequestError(message, response.status);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenRouterRequestError("Empty translation result.", 502);
  }

  return content.trim();
};
