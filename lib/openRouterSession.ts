import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const OPENROUTER_PKCE_COOKIE = "translation_vibe_openrouter_pkce";
export const OPENROUTER_SESSION_COOKIE = "translation_vibe_openrouter_session";

export type OpenRouterPkceSession = {
  verifier: string;
  createdAt: number;
};

export type OpenRouterSession = {
  apiKey: string;
  userId?: string;
  connectedAt: number;
};

export class OpenRouterSessionConfigurationError extends Error {
  constructor() {
    super("OPENROUTER_SESSION_SECRET must be configured with at least 32 characters in production.");
    this.name = "OpenRouterSessionConfigurationError";
  }
}

const getSessionKey = (): Buffer => {
  const secret = process.env.OPENROUTER_SESSION_SECRET?.trim() || process.env.APP_SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new OpenRouterSessionConfigurationError();
  }
  return createHash("sha256").update(secret || "translation-vibe-development-only-secret").digest();
};

export const assertOpenRouterSessionConfigured = (): void => {
  getSessionKey();
};

export const sealOpenRouterSession = (session: OpenRouterSession): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("base64url")).join(".");
};

export const parseOpenRouterSession = (value?: string): OpenRouterSession | undefined => {
  if (!value || value.length > 6_000) return undefined;
  try {
    const [ivValue, tagValue, ciphertextValue] = value.split(".");
    if (!ivValue || !tagValue || !ciphertextValue) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", getSessionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<OpenRouterSession>;
    if (typeof parsed.apiKey !== "string" || !parsed.apiKey.trim() || typeof parsed.connectedAt !== "number") return undefined;
    return {
      apiKey: parsed.apiKey,
      connectedAt: parsed.connectedAt,
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined
    };
  } catch {
    return undefined;
  }
};

export const serializeOpenRouterPkceSession = (session: OpenRouterPkceSession): string =>
  `${session.createdAt}.${session.verifier}`;

export const parseOpenRouterPkceSession = (value?: string): OpenRouterPkceSession | undefined => {
  if (!value) {
    return undefined;
  }

  const separator = value.indexOf(".");
  const createdAt = Number(value.slice(0, separator));
  const verifier = value.slice(separator + 1);
  if (
    separator < 1 ||
    !Number.isSafeInteger(createdAt) ||
    verifier.length < 43 ||
    verifier.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(verifier)
  ) {
    return undefined;
  }

  return { verifier, createdAt };
};

export const createPkceVerifier = (): string => randomBytes(48).toString("base64url");

export const createPkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export const getOpenRouterPkceCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge
});

export const getOpenRouterSessionCookieOptions = (maxAge = 30 * 24 * 60 * 60) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge
});
