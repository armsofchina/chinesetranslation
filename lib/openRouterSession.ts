import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const OPENROUTER_PKCE_COOKIE = "translation_vibe_openrouter_pkce";
export const OPENROUTER_SESSION_COOKIE = "translation_vibe_openrouter_session";

export type OpenRouterSession = {
  apiKey: string;
  userId?: string;
  connectedAt: number;
};

export type OpenRouterPkceSession = {
  verifier: string;
  createdAt: number;
};

const getSecret = (): Buffer => {
  const configuredSecret = process.env.OPENROUTER_SESSION_SECRET?.trim();
  if (!configuredSecret && process.env.NODE_ENV === "production") {
    throw new Error("OPENROUTER_SESSION_SECRET is required in production.");
  }
  return createHash("sha256")
    .update(configuredSecret || "translation-vibe-local-development-secret")
    .digest();
};

export const sealOpenRouterValue = (value: unknown): string => {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecret(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [initializationVector, authenticationTag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
};

export const unsealOpenRouterValue = <T>(sealedValue?: string): T | undefined => {
  if (!sealedValue) {
    return undefined;
  }

  try {
    const [initializationVectorValue, authenticationTagValue, encryptedValue] = sealedValue.split(".");
    if (!initializationVectorValue || !authenticationTagValue || !encryptedValue) {
      return undefined;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSecret(),
      Buffer.from(initializationVectorValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(authenticationTagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(decrypted) as T;
  } catch {
    return undefined;
  }
};

export const createPkceVerifier = (): string => randomBytes(48).toString("base64url");

export const createPkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export const getOpenRouterSessionCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge
});
