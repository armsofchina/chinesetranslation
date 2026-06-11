"use client";

import { FormEvent, useEffect, useId } from "react";

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
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[28px] border border-slate-300 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Connection Settings
            </h2>
            <span className="mt-2 inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {statusLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-sm font-medium text-sky-900 dark:text-sky-100">Use your own PPQ key only if you need it.</p>
          <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">
            The app already works with the shared server key. A personal key is helpful when you want your own billing,
            higher limits, or separate usage tracking.
          </p>

          <div className="mt-3 space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Quick setup</p>
            <p>1. Open PPQ and sign in.</p>
            <p>2. Create an API key in your account settings.</p>
            <p>3. Paste it here and save it locally on this device if you want.</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://ppq.ai/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
            >
              Open PPQ
            </a>
            <a
              href="https://ppq.ai/api-docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
            >
              Go to API Docs
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">
              PPQ API Key
            </span>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => onApiKeyDraftChange(event.target.value)}
              placeholder="ppq_..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-800"
            />
          </label>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Optional. Leave this blank to keep using the app's shared server key.
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
              Save key
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
            Your key is only used for translation requests and is never stored on the server.
          </p>
        </form>
      </div>
    </div>
  );
}
