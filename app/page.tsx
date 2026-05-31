"use client";

import { useEffect, useMemo, useState } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";
import ExportButtons from "@/components/ExportButtons";
import FileUpload from "@/components/FileUpload";
import SideBySideView from "@/components/SideBySideView";
import TextInputPanel from "@/components/TextInputPanel";
import ThemeToggle from "@/components/ThemeToggle";
import TranslationTabs, { TranslationView } from "@/components/TranslationTabs";
import { downloadEnglishPdf } from "@/lib/exportPdf";
import { downloadTxt } from "@/lib/exportTxt";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import { createChunksFromPastedText, createChunksFromPdfPages, joinEnglishTranslation } from "@/lib/textChunking";
import { applyThemePreference, getSavedThemePreference, saveThemePreference } from "@/lib/theme";
import { ThemePreference, TranslationChunk, TranslateResponse } from "@/lib/types";

const USER_API_KEY_STORAGE = "translator-user-openrouter-key";

export default function HomePage() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [activeUserApiKey, setActiveUserApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);

  const [pdfName, setPdfName] = useState<string | undefined>(undefined);
  const [pdfChunks, setPdfChunks] = useState<TranslationChunk[]>([]);
  const [pastedText, setPastedText] = useState("");

  const [translatedChunks, setTranslatedChunks] = useState<TranslationChunk[]>([]);
  const [activeView, setActiveView] = useState<TranslationView>("english");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usedModel, setUsedModel] = useState("");
  const [activityLog, setActivityLog] = useState<string[]>([]);

  useEffect(() => {
    const savedTheme = getSavedThemePreference();
    setTheme(savedTheme);
    applyThemePreference(savedTheme);

    const savedKey = window.localStorage.getItem(USER_API_KEY_STORAGE) || "";
    if (savedKey) {
      setApiKeyDraft(savedKey);
      setActiveUserApiKey(savedKey);
      setRememberKey(true);
    }
  }, []);

  useEffect(() => {
    applyThemePreference(theme);
    saveThemePreference(theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme === "system") {
        applyThemePreference("system");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const sourceChunks = useMemo(() => {
    if (pdfChunks.length > 0) {
      return pdfChunks;
    }
    return createChunksFromPastedText(pastedText);
  }, [pdfChunks, pastedText]);

  const englishText = useMemo(() => joinEnglishTranslation(translatedChunks), [translatedChunks]);

  const pushActivity = (message: string) => {
    setActivityLog((previous) => [`${new Date().toLocaleTimeString()} - ${message}`, ...previous].slice(0, 12));
  };

  const handleFileSelect = async (file: File | null) => {
    setErrorMessage("");
    setTranslatedChunks([]);

    if (!file) {
      setPdfName(undefined);
      setPdfChunks([]);
      return;
    }

    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF file.");
      setPdfName(undefined);
      setPdfChunks([]);
      return;
    }

    setPdfName(file.name);
    setStatusMessage("Extracting PDF text...");

    const result = await extractSelectableTextFromPdf(file);

    if (result.kind === "scanned") {
      setPdfChunks([]);
      setErrorMessage(result.message);
      setStatusMessage("");
      return;
    }

    if (result.kind === "error") {
      setPdfChunks([]);
      setErrorMessage(result.message);
      setStatusMessage("");
      return;
    }

    setStatusMessage("Preparing text...");
    const chunks = createChunksFromPdfPages(result.pages);

    if (chunks.length === 0) {
      setErrorMessage(
        "This PDF appears to contain scanned images rather than selectable text. OCR support can be added in a future version."
      );
    }

    setPdfChunks(chunks);
    setStatusMessage("");
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyDraft.trim();
    setActiveUserApiKey(trimmed);

    if (rememberKey && trimmed) {
      window.localStorage.setItem(USER_API_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(USER_API_KEY_STORAGE);
    }

    if (!trimmed) {
      setRememberKey(false);
    }

    setIsSettingsOpen(false);
  };

  const handleClearSavedKey = () => {
    setApiKeyDraft("");
    setActiveUserApiKey("");
    setRememberKey(false);
    window.localStorage.removeItem(USER_API_KEY_STORAGE);
  };

  const handleTranslate = async () => {
    setErrorMessage("");
    setCopied(false);
    setActivityLog([]);

    if (sourceChunks.length === 0) {
      setErrorMessage("Add a PDF or paste Chinese text before translating.");
      return;
    }

    setProcessing(true);
    setStatusMessage("Preparing text...");
    setTranslatedChunks([]);
    pushActivity("Preparing translation plan...");

    await new Promise((resolve) => setTimeout(resolve, 120));
    setStatusMessage("Translating...");
    pushActivity(`Found ${sourceChunks.length} section(s) to translate.`);

    try {
      const completedChunks: TranslationChunk[] = [];

      for (let index = 0; index < sourceChunks.length; index += 1) {
        const chunk = sourceChunks[index];
        setStatusMessage(`Translating section ${index + 1} of ${sourceChunks.length}...`);
        pushActivity(`Analyzing section ${index + 1}/${sourceChunks.length}...`);

        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chunks: [chunk],
            userOpenRouterApiKey: activeUserApiKey || undefined
          })
        });

        const payload = (await response.json()) as TranslateResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Translation API failed.");
        }

        const translatedChunk = payload.chunks?.[0];
        if (!translatedChunk?.translatedEnglish?.trim()) {
          throw new Error("Empty translation result.");
        }

        completedChunks.push(translatedChunk);
        setTranslatedChunks([...completedChunks]);
        setUsedModel(payload.model);
        pushActivity(`Completed section ${index + 1}/${sourceChunks.length}.`);
      }

      setActiveView("english");
      setStatusMessage("Generating output...");
      pushActivity("Polishing final English output...");
      setTimeout(() => setStatusMessage(""), 500);
      pushActivity("Translation complete.");
    } catch (error) {
      setStatusMessage("");
      pushActivity("Translation stopped due to an error.");
      setErrorMessage(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setPdfName(undefined);
    setPdfChunks([]);
    setPastedText("");
    setTranslatedChunks([]);
    setStatusMessage("");
    setErrorMessage("");
    setCopied(false);
    setUsedModel("");
    setActivityLog([]);
  };

  const handleCopyEnglish = async () => {
    if (!englishText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(englishText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setErrorMessage("Unable to copy to clipboard on this browser.");
    }
  };

  const handleDownloadTxt = () => {
    try {
      downloadTxt(englishText);
    } catch {
      setErrorMessage("TXT export failed.");
    }
  };

  const handleDownloadPdf = () => {
    try {
      downloadEnglishPdf(englishText);
    } catch {
      setErrorMessage("PDF export failed.");
    }
  };

  const usingCustomKey = Boolean(activeUserApiKey.trim());

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#cde5ff,_#f8fafc_42%,_#f8fafc)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_#1f3655,_#020617_45%,_#020617)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Chinese PDF/Text Translator</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Upload a Chinese PDF or paste Chinese text to generate a clean English translation.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Key mode: {usingCustomKey ? "Using your OpenRouter key" : "Using default app key"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle value={theme} onChange={setTheme} />
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                API Key Settings
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FileUpload fileName={pdfName} onFileSelect={handleFileSelect} />
            <TextInputPanel value={pastedText} onChange={setPastedText} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={processing}
              className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? "Working..." : "Translate"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear / Reset
            </button>
            {statusMessage ? <span className="text-sm text-slate-600 dark:text-slate-300">{statusMessage}</span> : null}
            {usedModel ? <span className="text-xs text-slate-500 dark:text-slate-400">Model: {usedModel}</span> : null}
          </div>

          {(processing || activityLog.length > 0) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Translation Activity
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Live progress feedback. This shows translation steps, not private model chain-of-thought.
              </p>
              <div className="mt-3 max-h-44 space-y-1 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950/70">
                {processing ? <p className="animate-pulse text-sky-700 dark:text-sky-300">Thinking...</p> : null}
                {activityLog.map((line, index) => (
                  <p key={`${line}-${index}`} className="text-slate-700 dark:text-slate-200">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </header>

        {translatedChunks.length > 0 ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TranslationTabs active={activeView} onChange={setActiveView} />
              <ExportButtons
                onCopy={handleCopyEnglish}
                onDownloadTxt={handleDownloadTxt}
                onDownloadPdf={handleDownloadPdf}
                copied={copied}
                disabled={!englishText}
              />
            </div>

            {activeView === "original" ? (
              <div className="space-y-3">
                {sourceChunks.map((chunk) => (
                  <article
                    key={chunk.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Original Chinese {chunk.pageNumber ? `(Page ${chunk.pageNumber})` : ""}
                    </p>
                    <p className="document-text text-sm text-slate-800 dark:text-slate-100">{chunk.originalChinese}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {activeView === "english" ? (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  English Translation
                </p>
                <div
                  className="document-text text-[15px] text-slate-800 dark:text-slate-100"
                  style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
                >
                  {translatedChunks.map((chunk) => (
                    <p key={chunk.id} className="mb-4 last:mb-0">
                      {chunk.translatedEnglish}
                    </p>
                  ))}
                </div>
              </article>
            ) : null}

            {activeView === "side-by-side" ? <SideBySideView chunks={translatedChunks} /> : null}
          </section>
        ) : null}
      </div>

      <ApiKeySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeyDraft={apiKeyDraft}
        rememberKey={rememberKey}
        statusLabel={usingCustomKey ? "Using your OpenRouter key" : "Using default app key"}
        onApiKeyDraftChange={setApiKeyDraft}
        onRememberKeyChange={setRememberKey}
        onSave={handleSaveApiKey}
        onClearSaved={handleClearSavedKey}
      />
    </main>
  );
}
