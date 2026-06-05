/**
 * Smart retry logic for translation API calls.
 *
 * Handles:
 * - Rate-limit (429) with exponential backoff
 * - Empty/invalid outputs (502) with one retry at slightly higher temperature
 * - Non-English hallucination detection and retry
 * - Generic transient errors (5xx, network) with limited retries
 */

export class TranslationRetryError extends Error {
  status: number;
  retries: number;

  constructor(message: string, status: number, retries: number) {
    super(message);
    this.status = status;
    this.retries = retries;
  }
}

export type RetryableCall<T> = (attempt: number, temperature: number) => Promise<T>;

const MIN_ENGLISH_RATIO = 0.3;
const MIN_ASCII_FOR_CHECK = 20;

/**
 * Rough heuristic: check that the result contains a reasonable amount
 * of ASCII Latin characters. If the model hallucinated in Chinese,
 * this ratio will be very low.
 */
export const isReasonablyEnglish = (text: string): boolean => {
  if (!text || text.length < 3) {
    return false;
  }
  // Short outputs (headings, numbers) don't need this check.
  if (text.length < MIN_ASCII_FOR_CHECK) {
    return true;
  }
  const asciiCount = Array.from(text).filter((c) => {
    const code = c.charCodeAt(0);
    return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
  }).length;
  return asciiCount / text.length >= MIN_ENGLISH_RATIO;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps a translation call with smart retry logic.
 * @param call - The async function to call. Receives (attemptNumber, temperature).
 * @param options - Retry configuration.
 */
export const withSmartRetry = async <T extends { text: string }>(
  call: RetryableCall<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    temperatureBump?: number;
  } = {}
): Promise<T> => {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1500;
  const maxDelayMs = options.maxDelayMs ?? 10000;
  const temperatureBump = options.temperatureBump ?? 0.1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const temperature = 0.2 + attempt * temperatureBump;

    try {
      const result = await call(attempt, temperature);

      // Validate: non-empty.
      if (!result.text || result.text.trim().length === 0) {
        if (attempt < maxRetries) {
          lastError = new Error("Empty translation result.");
          await sleep(Math.min(baseDelayMs * (attempt + 1), maxDelayMs));
          continue;
        }
        throw new TranslationRetryError("Empty translation result after retries.", 502, attempt);
      }

      // Validate: reasonably English (not hallucinated in Chinese).
      if (!isReasonablyEnglish(result.text)) {
        if (attempt < maxRetries) {
          lastError = new Error("Translation appears to be non-English. Retrying...");
          await sleep(Math.min(baseDelayMs * (attempt + 1), maxDelayMs));
          continue;
        }
        // If we exhausted retries, still return the result — the heuristic may
        // be wrong for heavily numeric/symbolic text.
        return result;
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Determine if this is a retryable HTTP error.
      let status = 0;
      if (error && typeof error === "object" && "status" in error) {
        status = (error as { status: number }).status;
      }

      const isRetryable = status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;

      if (!isRetryable && attempt === 0) {
        // Non-retryable error on first attempt — fail fast.
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter.
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);
        await sleep(delay);
      }
    }
  }

  throw lastError || new TranslationRetryError("Translation failed after retries.", 500, maxRetries);
};
