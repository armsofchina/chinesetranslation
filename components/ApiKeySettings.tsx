"use client";

import { FormEvent } from "react";

type ApiKeySettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  apiKeyDraft: string;
  rememberKey: boolean;
  statusLabel: string;
  onApiKeyDraftChange: (value: string) => void;
  onRememberKeyChange: (checked: boolean) => void;
  onSave: () => void;
  onClearSaved: () => void;
};

export default function ApiKeySettings({
  isOpen,
  onClose,
  apiKeyDraft,
  rememberKey,
  statusLabel,
  onApiKeyDraftChange,
  onRememberKeyChange,
  onSave,
  onClearSaved
}: ApiKeySettingsProps) {
  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">API Key Settings</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{statusLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
            Want higher translation limits?
          </p>
          <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
            You can use your own OpenRouter API key. This gives you your own request/credit limits instead of relying on
            the app default key.
          </p>

          <div className="mt-3 space-y-2 text-xs text-slate-700 dark:text-slate-200">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Quick tutorial: get a free OpenRouter key</p>
            <p>1) Create or sign in to your OpenRouter account at openrouter.ai.</p>
            <p>2) Open the Keys page and click Create Key.</p>
            <p>3) Name your key (for example: Chinese Translator App).</p>
            <p>4) Copy the key once shown (it may only be visible one time).</p>
            <p>5) Paste it below and click Save.</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://openrouter.ai/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
            >
              Open OpenRouter
            </a>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
            >
              Go to API Keys
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">
              Use your own OpenRouter API key
            </span>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => onApiKeyDraftChange(event.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-800"
            />
          </label>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Optional. If provided, your key will be used for this translation instead of the default app key.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(event) => onRememberKeyChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Remember my key on this device
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClearSaved}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear saved key
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your key is only used to send translation requests. It is not stored on our server.
          </p>
        </form>
      </div>
    </div>
  );
}
