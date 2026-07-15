"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { AiProviderId } from "@/lib/aiProviders";
import {
  AUTO_FREE_OPENROUTER_MODEL,
  OpenRouterModelOption
} from "@/lib/openRouterModels";

type ApiKeySettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  provider: AiProviderId;
  apiKeyDraft: string;
  rememberKey: boolean;
  openRouterConnected: boolean;
  openRouterLoading: boolean;
  openRouterUserId?: string;
  openRouterModel: string;
  onProviderChange: (provider: AiProviderId) => void;
  onOpenRouterModelChange: (model: string) => void;
  onApiKeyDraftChange: (value: string) => void;
  onRememberKeyChange: (checked: boolean) => void;
  onSave: () => void;
  onClearSaved: () => void;
  onDisconnectOpenRouter: () => void;
};

export default function ApiKeySettings({
  isOpen,
  onClose,
  provider,
  apiKeyDraft,
  rememberKey,
  openRouterConnected,
  openRouterLoading,
  openRouterUserId,
  openRouterModel,
  onProviderChange,
  onOpenRouterModelChange,
  onApiKeyDraftChange,
  onRememberKeyChange,
  onSave,
  onClearSaved,
  onDisconnectOpenRouter
}: ApiKeySettingsProps) {
  const titleId = useId();
  const modelDescriptionId = useId();
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModelOption[]>([
    AUTO_FREE_OPENROUTER_MODEL
  ]);
  const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
  const [modelCatalogAvailable, setModelCatalogAvailable] = useState(true);

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

  useEffect(() => {
    if (!isOpen || provider !== "openrouter") {
      return;
    }
    const controller = new AbortController();
    setModelCatalogLoading(true);
    fetch("/api/providers/openrouter/models", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        const models = Array.isArray(payload?.models) ? payload.models : [];
        setOpenRouterModels(models.length > 0 ? models : [AUTO_FREE_OPENROUTER_MODEL]);
        setModelCatalogAvailable(payload?.catalogAvailable !== false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOpenRouterModels([AUTO_FREE_OPENROUTER_MODEL]);
          setModelCatalogAvailable(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setModelCatalogLoading(false);
        }
      });
    return () => controller.abort();
  }, [isOpen, provider]);

  const visibleOpenRouterModels = useMemo(() => {
    if (openRouterModels.some((model) => model.id === openRouterModel)) {
      return openRouterModels;
    }
    return [
      ...openRouterModels,
      {
        id: openRouterModel,
        name: openRouterModel,
        free: openRouterModel.endsWith(":free")
      }
    ];
  }, [openRouterModel, openRouterModels]);
  const selectedOpenRouterModel = visibleOpenRouterModels.find((model) => model.id === openRouterModel)
    || AUTO_FREE_OPENROUTER_MODEL;
  const freeOpenRouterModels = visibleOpenRouterModels.filter((model) => model.free && !model.automatic);
  const paidOpenRouterModels = visibleOpenRouterModels.filter((model) => !model.free);

  const formatModelOption = (model: OpenRouterModelOption) => {
    if (model.free) {
      return `${model.name} — Free`;
    }
    const inputPrice = model.promptPricePerMillion;
    const outputPrice = model.completionPricePerMillion;
    if (inputPrice === undefined || outputPrice === undefined) {
      return model.name;
    }
    return `${model.name} — $${inputPrice.toLocaleString(undefined, { maximumFractionDigits: 3 })} in / $${outputPrice.toLocaleString(undefined, { maximumFractionDigits: 3 })} out per 1M`;
  };

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
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-slate-300 bg-white p-6 shadow-soft dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Connections</p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Translation provider
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose which account and model gateway should run this project.
            </p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button px-3 py-1.5 text-xs">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={provider === "ppq"}
            onClick={() => onProviderChange("ppq")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "ppq"
                ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100 dark:border-sky-500 dark:bg-sky-950/30 dark:ring-sky-900/40"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">PPQ</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
              Use the shared app key or your own PPQ key.
            </span>
          </button>
          <button
            type="button"
            aria-pressed={provider === "openrouter"}
            onClick={() => onProviderChange("openrouter")}
            className={`rounded-2xl border p-4 text-left transition ${
              provider === "openrouter"
                ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100 dark:border-sky-500 dark:bg-sky-950/30 dark:ring-sky-900/40"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              OpenRouter
              {openRouterConnected ? (
                <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Connected
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
              Connect your account and use its models, credits, and limits.
            </span>
          </button>
        </div>

        {provider === "openrouter" ? (
          <section className="workspace-panel-quiet mt-5 p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="openrouter-model" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Translation model
                </label>
                {modelCatalogLoading ? (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Refreshing models…</span>
                ) : null}
              </div>
              <select
                id="openrouter-model"
                value={openRouterModel}
                onChange={(event) => onOpenRouterModelChange(event.target.value)}
                aria-describedby={modelDescriptionId}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-800"
              >
                <option value={AUTO_FREE_OPENROUTER_MODEL.id}>{formatModelOption(AUTO_FREE_OPENROUTER_MODEL)}</option>
                {freeOpenRouterModels.length > 0 ? (
                  <optgroup label="Free models">
                    {freeOpenRouterModels.map((model) => (
                      <option key={model.id} value={model.id}>{formatModelOption(model)}</option>
                    ))}
                  </optgroup>
                ) : null}
                {paidOpenRouterModels.length > 0 ? (
                  <optgroup label="Paid models">
                    {paidOpenRouterModels.map((model) => (
                      <option key={model.id} value={model.id}>{formatModelOption(model)}</option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <p id={modelDescriptionId} className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {selectedOpenRouterModel.automatic
                  ? "Recommended: OpenRouter automatically chooses an available zero-cost model for each request."
                  : selectedOpenRouterModel.free
                    ? "Pinned free model. If free capacity is unavailable, the request fails instead of silently using a paid model."
                    : "Paid model. Translation usage is charged against the connected OpenRouter account."}
              </p>
              {!modelCatalogAvailable ? (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                  The live catalog is temporarily unavailable. Automatic free selection is still available.
                </p>
              ) : null}
              <p className="mt-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {selectedOpenRouterModel.id}
              </p>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              {openRouterLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Checking OpenRouter connection…</p>
              ) : openRouterConnected ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">OpenRouter is connected</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Your OpenRouter key is encrypted in browser-bound HttpOnly session cookies and is never exposed to page scripts.
                      </p>
                      {openRouterUserId ? (
                        <p className="mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">{openRouterUserId}</p>
                      ) : null}
                    </div>
                    <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                      Ready
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="https://openrouter.ai/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-button px-3 py-2 text-xs"
                    >
                      Manage OpenRouter
                    </a>
                    <button type="button" onClick={onDisconnectOpenRouter} className="secondary-button px-3 py-2 text-xs">
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connect in one click</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    You will sign in at OpenRouter and authorize a user-controlled API key for this tool.
                  </p>
                  <a href="/api/auth/openrouter/start" className="primary-button mt-4 inline-flex px-4 py-2.5 text-sm">
                    Connect OpenRouter
                  </a>
                  <p className="mt-3 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                    After authorization, the key is encrypted in browser-bound HttpOnly session cookies. You can disconnect here or revoke it in OpenRouter.
                  </p>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-5">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
              <p className="text-sm font-medium text-sky-900 dark:text-sky-100">A personal PPQ key is optional.</p>
              <p className="mt-1 text-xs leading-5 text-sky-800 dark:text-sky-200">
                Leave it blank to use the shared server key, or add your own key for separate billing and usage limits.
              </p>
              <a
                href="https://ppq.ai/"
                target="_blank"
                rel="noreferrer"
                className="secondary-button mt-3 inline-flex px-3 py-1.5 text-xs"
              >
                Open PPQ
              </a>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-800 dark:text-slate-100">PPQ API key</span>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(event) => onApiKeyDraftChange(event.target.value)}
                  placeholder="ppq_..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-800"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(event) => onRememberKeyChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Remember my PPQ key on this device
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="primary-button px-4 py-2.5 text-sm">Save PPQ key</button>
                <button type="button" onClick={onClearSaved} className="secondary-button px-4 py-2.5 text-sm">
                  Clear key
                </button>
              </div>
              <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                A remembered PPQ key is stored in this browser and sent only to this app&apos;s translation routes.
              </p>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
