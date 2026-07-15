type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
let operations = 0;

const pruneBuckets = (now: number) => {
  operations += 1;
  if (operations % 100 !== 0 && buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > 10_000) {
    [...buckets.keys()].slice(0, buckets.size - 10_000).forEach((key) => buckets.delete(key));
  }
};

export const checkRateLimit = (
  key: string,
  options: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  pruneBuckets(now);
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
  headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
  headers.get("cf-connecting-ip")?.trim() ||
  headers.get("x-real-ip")?.trim() ||
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "local";
