type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export const checkRateLimit = (
  key: string,
  options: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
};

export const getRequestClientKey = (headers: Headers): string =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local";
