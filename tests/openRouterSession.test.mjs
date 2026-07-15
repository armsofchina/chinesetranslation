import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOpenRouterSession,
  sealOpenRouterSession
} from "../lib/openRouterSessionCrypto.ts";

const withSessionSecrets = (openRouterSecret, appSecret, operation) => {
  const priorOpenRouterSecret = process.env.OPENROUTER_SESSION_SECRET;
  const priorAppSecret = process.env.APP_SESSION_SECRET;
  if (openRouterSecret === undefined) delete process.env.OPENROUTER_SESSION_SECRET;
  else process.env.OPENROUTER_SESSION_SECRET = openRouterSecret;
  if (appSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = appSecret;

  try {
    operation();
  } finally {
    if (priorOpenRouterSecret === undefined) delete process.env.OPENROUTER_SESSION_SECRET;
    else process.env.OPENROUTER_SESSION_SECRET = priorOpenRouterSecret;
    if (priorAppSecret === undefined) delete process.env.APP_SESSION_SECRET;
    else process.env.APP_SESSION_SECRET = priorAppSecret;
  }
};

test("creates a browser-keyed OpenRouter session when no server secret is configured", () => {
  withSessionSecrets(undefined, undefined, () => {
    const sealed = sealOpenRouterSession({ apiKey: "sk-or-browser-test", userId: "user-1", connectedAt: 123 });

    assert.match(sealed.value, /^b1\./);
    assert.ok(sealed.browserKey);
    assert.deepEqual(parseOpenRouterSession(sealed.value, sealed.browserKey), {
      apiKey: "sk-or-browser-test",
      userId: "user-1",
      connectedAt: 123
    });
    assert.equal(parseOpenRouterSession(sealed.value, "A".repeat(43)), undefined);
    assert.equal(parseOpenRouterSession(sealed.value), undefined);
  });
});

test("uses the configured server secret when a strong one is available", () => {
  withSessionSecrets("s".repeat(32), undefined, () => {
    const sealed = sealOpenRouterSession({ apiKey: "sk-or-server-test", connectedAt: 456 });

    assert.match(sealed.value, /^s1\./);
    assert.equal(sealed.browserKey, undefined);
    assert.deepEqual(parseOpenRouterSession(sealed.value), {
      apiKey: "sk-or-server-test",
      connectedAt: 456,
      userId: undefined
    });
  });
});

test("falls back to a browser key instead of rejecting a short server secret", () => {
  withSessionSecrets("too-short", undefined, () => {
    const sealed = sealOpenRouterSession({ apiKey: "sk-or-fallback-test", connectedAt: 789 });

    assert.match(sealed.value, /^b1\./);
    assert.ok(sealed.browserKey);
    assert.equal(parseOpenRouterSession(sealed.value, sealed.browserKey)?.apiKey, "sk-or-fallback-test");
  });
});

test("uses APP_SESSION_SECRET when the OpenRouter-specific secret is too short", () => {
  withSessionSecrets("too-short", "a".repeat(32), () => {
    const sealed = sealOpenRouterSession({ apiKey: "sk-or-app-secret-test", connectedAt: 987 });

    assert.match(sealed.value, /^s1\./);
    assert.equal(sealed.browserKey, undefined);
    assert.equal(parseOpenRouterSession(sealed.value)?.apiKey, "sk-or-app-secret-test");
  });
});
