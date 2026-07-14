import "server-only";

import { createHash, randomBytes } from "crypto";

export const OPENROUTER_PKCE_COOKIE = "translation_vibe_openrouter_pkce";

export type OpenRouterPkceSession = {
  verifier: string;
  createdAt: number;
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
