import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const SERVER_SESSION_PREFIX = "s1";
const BROWSER_SESSION_PREFIX = "b1";
const DEVELOPMENT_LEGACY_SECRET = "translation-vibe-development-only-secret";

export type OpenRouterSession = {
  apiKey: string;
  userId?: string;
  connectedAt: number;
};

export type SealedOpenRouterSession = {
  value: string;
  browserKey?: string;
};

const getConfiguredSessionKey = (): Buffer | undefined => {
  const secret = [process.env.OPENROUTER_SESSION_SECRET, process.env.APP_SESSION_SECRET]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value.length >= 32));
  return secret
    ? createHash("sha256").update(secret).digest()
    : undefined;
};

const parseBrowserSessionKey = (value?: string): Buffer | undefined => {
  if (!value || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  const key = Buffer.from(value, "base64url");
  return key.length === 32 ? key : undefined;
};

const sealWithKey = (session: OpenRouterSession, key: Buffer, prefix: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return [prefix, iv, cipher.getAuthTag(), ciphertext]
    .map((value) => typeof value === "string" ? value : value.toString("base64url"))
    .join(".");
};

export const sealOpenRouterSession = (session: OpenRouterSession): SealedOpenRouterSession => {
  const configuredKey = getConfiguredSessionKey();
  if (configuredKey) {
    return { value: sealWithKey(session, configuredKey, SERVER_SESSION_PREFIX) };
  }

  const browserKey = randomBytes(32);
  return {
    value: sealWithKey(session, browserKey, BROWSER_SESSION_PREFIX),
    browserKey: browserKey.toString("base64url")
  };
};

export const parseOpenRouterSession = (value?: string, browserKeyValue?: string): OpenRouterSession | undefined => {
  if (!value || value.length > 6_000) return undefined;
  try {
    const parts = value.split(".");
    let ivValue: string;
    let tagValue: string;
    let ciphertextValue: string;
    let key: Buffer | undefined;

    if (parts.length === 4) {
      const [prefix, nextIv, nextTag, nextCiphertext] = parts;
      ivValue = nextIv;
      tagValue = nextTag;
      ciphertextValue = nextCiphertext;
      key = prefix === SERVER_SESSION_PREFIX
        ? getConfiguredSessionKey()
        : prefix === BROWSER_SESSION_PREFIX
          ? parseBrowserSessionKey(browserKeyValue)
          : undefined;
    } else if (parts.length === 3) {
      [ivValue, tagValue, ciphertextValue] = parts;
      key = getConfiguredSessionKey() || (process.env.NODE_ENV !== "production"
        ? createHash("sha256").update(DEVELOPMENT_LEGACY_SECRET).digest()
        : undefined);
    } else {
      return undefined;
    }

    if (!key || !ivValue || !tagValue || !ciphertextValue) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
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
