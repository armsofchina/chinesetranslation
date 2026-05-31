import { normalizeTranslationFootnotes } from "@/lib/footnotes";

const PPQ_URL = process.env.PPQ_CHAT_COMPLETIONS_URL || "https://api.ppq.ai/chat/completions";

export const DEFAULT_MODEL = process.env.PPQ_MODEL || process.env.OPENROUTER_MODEL || "claude-sonnet-4-5";

const SYSTEM_PROMPT =
  "You are a professional Chinese-to-English translator. Translate Traditional Chinese and Simplified Chinese into clear, natural English. Preserve meaning, tone, names, dates, numbers, headings, bullet points, numbered lists, technical terms, historical terms, military terms, legal terms, archival terms, and paragraph structure. Do not summarize. Do not add information that is not present in the original. Output only the English translation.";
const VISION_SYSTEM_PROMPT =
  "You are a professional Chinese-to-English translator with OCR capabilities. Read Chinese text from the provided image and translate it into clear, natural English. Preserve meaning, tone, names, dates, numbers, headings, lists, and paragraph structure. For tables, output clean markdown tables when possible. For chart labels or plotted data visible in the image, preserve values and labels accurately in readable text. Do not summarize. Do not add information that is not present in the image. Output only the English translation.";

export class PpqRequestError extends Error {
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

const extractContentText = (content: unknown): string => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const text = (item as { text?: string }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
    return joined.trim();
  }

  return "";
};

export const translateWithPpq = async ({ apiKey, model, text }: TranslateChunkInput): Promise<string> => {
  const response = await fetch(PPQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
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
    const message = payload?.error?.message || payload?.message || "Translation request failed.";
    throw new PpqRequestError(message, response.status);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = extractContentText(rawContent);
  if (!content) {
    throw new PpqRequestError("Empty translation result.", 502);
  }

  return normalizeTranslationFootnotes(content);
};

type TranslateImageInput = {
  apiKey: string;
  model: string;
  imageDataUrl: string;
};

export const translateImageWithPpq = async ({ apiKey, model, imageDataUrl }: TranslateImageInput): Promise<string> => {
  const response = await fetch(PPQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: VISION_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Translate all readable Chinese text in this image into clean English."
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      temperature: 0.1
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Image translation request failed.";
    throw new PpqRequestError(message, response.status);
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = extractContentText(rawContent);
  if (!content) {
    throw new PpqRequestError("Empty image translation result.", 502);
  }

  return normalizeTranslationFootnotes(content);
};
