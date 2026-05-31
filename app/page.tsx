"use client";

import { useEffect, useMemo, useState } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import ExportButtons from "@/components/ExportButtons";
import FileUpload from "@/components/FileUpload";
import InputModeTabs, { InputMode } from "@/components/InputModeTabs";
import ProgressIndicator, { ProgressStep } from "@/components/ProgressIndicator";
import SideBySideView from "@/components/SideBySideView";
import TextInputPanel from "@/components/TextInputPanel";
import Toast from "@/components/Toast";
import TranslationTabs, { TranslationView } from "@/components/TranslationTabs";
import { downloadEnglishPdf } from "@/lib/exportPdf";
import { downloadTxt } from "@/lib/exportTxt";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import { createChunksFromPastedText, createChunksFromPdfPages, joinEnglishTranslation } from "@/lib/textChunking";
import { applyThemePreference, getSavedThemePreference, saveThemePreference } from "@/lib/theme";
import { ThemePreference, TranslationChunk, TranslateResponse } from "@/lib/types";

const USER_API_KEY_STORAGE = "translator-user-openrouter-key";

const SCANNED_MESSAGE =
  "This PDF does not appear to contain selectable text. It may be a scanned document. OCR support can be added in a future version.";

export default function HomePage() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [inputMode, setInputMode] = useState<InputMode>("pdf");
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
  const [usedModel, setUsedModel] = useState("");
  const [progressStep, setProgressStep] = useState<ProgressStep>("idle");
  const [documentFontSize, setDocumentFontSize] = useState(16);

  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

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
    if (inputMode === "pdf") {
      return pdfChunks;
    }
    return createChunksFromPastedText(pastedText);
  }, [inputMode, pdfChunks, pastedText]);

  const englishText = useMemo(() => joinEnglishTranslation(translatedChunks), [translatedChunks]);
  const translateDisabled = processing || sourceChunks.length === 0;
  const usingCustomKey = Boolean(activeUserApiKey.trim());

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  };

  const handleFileSelect = async (file: File | null) => {
    setErrorMessage("");
    setTranslatedChunks([]);

    if (!file) {
      setPdfName(undefined);
      setPdfChunks([]);
      setProgressStep("idle");
      return;
    }

    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF file.");
      setPdfName(undefined);
      setPdfChunks([]);
      return;
    }

    setInputMode("pdf");
    setPdfName(file.name);
    setProgressStep("extracting");
    setStatusMessage("Extracting text...");

    const result = await extractSelectableTextFromPdf(file);

    if (result.kind === "scanned") {
      setPdfChunks([]);
      setErrorMessage(SCANNED_MESSAGE);
      setStatusMessage("");
      setProgressStep("idle");
      return;
    }

    if (result.kind === "error") {
      setPdfChunks([]);
      setErrorMessage(result.message);
      setStatusMessage("");
      setProgressStep("idle");
      return;
    }

    setProgressStep("preparing");
    setStatusMessage("Preparing chunks...");
    const chunks = createChunksFromPdfPages(result.pages);

    if (chunks.length === 0) {
      setErrorMessage(SCANNED_MESSAGE);
    }

    setPdfChunks(chunks);
    setStatusMessage("");
    setProgressStep("idle");
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

    if (sourceChunks.length === 0) {
      setErrorMessage("Upload a PDF or paste Chinese text to begin.");
      return;
    }

    setProcessing(true);
    setTranslatedChunks([]);
    setProgressStep("preparing");
    setStatusMessage("Preparing chunks...");

    await new Promise((resolve) => setTimeout(resolve, 120));

    try {
      const completedChunks: TranslationChunk[] = [];
      setProgressStep("translating");

      for (let index = 0; index < sourceChunks.length; index += 1) {
        const chunk = sourceChunks[index];
        setStatusMessage(`Translating section ${index + 1} of ${sourceChunks.length}...`);

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
      }

      setProgressStep("generating");
      setStatusMessage("Generating output...");

      await new Promise((resolve) => setTimeout(resolve, 280));

      setActiveView("english");
      setProgressStep("done");
      setStatusMessage("Translation complete.");
      setTimeout(() => {
        setStatusMessage("");
        setProgressStep("idle");
      }, 1000);
    } catch (error) {
      setStatusMessage("");
      setProgressStep("idle");
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
    setUsedModel("");
    setProgressStep("idle");
    setDocumentFontSize(16);
  };

  const handleCopyEnglish = async () => {
    if (!englishText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(englishText);
      showToast("Copied to clipboard.");
    } catch {
      setErrorMessage("Unable to copy to clipboard on this browser.");
    }
  };

  const handleDownloadTxt = () => {
    try {
      downloadTxt(englishText);
      showToast("TXT downloaded");
    } catch {
      setErrorMessage("TXT export failed.");
    }
  };

  const handleDownloadPdf = () => {
    try {
      downloadEnglishPdf(englishText);
      showToast("PDF downloaded");
    } catch {
      setErrorMessage("PDF export failed.");
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dce9f8_0,_#f6f8fc_36%,_#f8fafc_100%)] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_#1f314a_0,_#0b1220_35%,_#020617_100%)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppHeader theme={theme} onThemeChange={setTheme} onOpenApiSettings={() => setIsSettingsOpen(true)} />

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add Chinese Text</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Choose one input method, then translate to English.
          </p>

          <div className="mt-5">
            <InputModeTabs value={inputMode} onChange={setInputMode} />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
            {inputMode === "pdf" ? (
              <FileUpload fileName={pdfName} onFileSelect={handleFileSelect} />
            ) : (
              <TextInputPanel value={pastedText} onChange={setPastedText} onClear={() => setPastedText("")} />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translateDisabled}
              className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {processing ? "Translating..." : "Translate to English"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              Reset
            </button>

            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {usingCustomKey ? "Using your OpenRouter key" : "Using default app key"}
            </span>

            {usedModel ? <span className="text-xs text-slate-500 dark:text-slate-400">Model: {usedModel}</span> : null}
            {statusMessage ? <span className="text-xs text-slate-500 dark:text-slate-400">{statusMessage}</span> : null}
          </div>
        </section>

        <ProgressIndicator step={progressStep} processing={processing} />

        <ErrorState message={errorMessage} />

        {translatedChunks.length > 0 ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Translation Results</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Review, copy, and download your translation.</p>
              </div>
              <ExportButtons
                onCopy={handleCopyEnglish}
                onDownloadTxt={handleDownloadTxt}
                onDownloadPdf={handleDownloadPdf}
                copied={toastVisible && toastMessage === "Copied to clipboard."}
                disabled={!englishText}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <TranslationTabs active={activeView} onChange={setActiveView} />

              {activeView === "english" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDocumentFontSize((prev) => Math.max(14, prev - 1))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentFontSize((prev) => Math.min(22, prev + 1))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    A+
                  </button>
                </div>
              ) : null}
            </div>

            {activeView === "original" ? (
              <div className="space-y-3">
                {sourceChunks.map((chunk) => (
                  <article
                    key={chunk.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {chunk.pageNumber ? `Page ${chunk.pageNumber}` : "Original Chinese"}
                    </p>
                    <p className="cn-text document-text text-[15px] text-slate-800 dark:text-slate-100">{chunk.originalChinese}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {activeView === "english" ? (
              <article className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  English Translation
                </p>
                <div
                  className="document-text text-slate-800 dark:text-slate-100"
                  style={{ fontFamily: "var(--font-doc), Georgia, serif", fontSize: `${documentFontSize}px`, lineHeight: 1.9 }}
                >
                  {translatedChunks.map((chunk) => (
                    <p key={chunk.id} className="mb-5 last:mb-0">
                      {chunk.translatedEnglish}
                    </p>
                  ))}
                </div>
              </article>
            ) : null}

            {activeView === "side-by-side" ? <SideBySideView chunks={translatedChunks} /> : null}
          </section>
        ) : (
          <EmptyState
            title="Upload a PDF or paste Chinese text to begin."
            description="After translation, you can switch views, copy the English output, and download TXT or PDF."
          />
        )}
      </div>

      <ApiKeySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeyDraft={apiKeyDraft}
        rememberKey={rememberKey}
        statusLabel={usingCustomKey ? "Your OpenRouter key" : "Default app key"}
        onApiKeyDraftChange={setApiKeyDraft}
        onRememberKeyChange={setRememberKey}
        onSave={handleSaveApiKey}
        onClearSaved={handleClearSavedKey}
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
