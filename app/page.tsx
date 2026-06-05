"use client";

import { useEffect, useMemo, useState } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";
import AppHeader from "@/components/AppHeader";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import ExportButtons from "@/components/ExportButtons";
import FileUpload from "@/components/FileUpload";
import ImageSideBySideView from "@/components/ImageSideBySideView";
import ImageUpload from "@/components/ImageUpload";
import InputModeTabs, { InputMode } from "@/components/InputModeTabs";
import PdfSideBySideView from "@/components/PdfSideBySideView";
import ProgressIndicator, { ProgressStep } from "@/components/ProgressIndicator";
import SideBySideView from "@/components/SideBySideView";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import TextInputPanel from "@/components/TextInputPanel";
import Toast from "@/components/Toast";
import TranslationTabs, { TranslationView } from "@/components/TranslationTabs";
import { downloadBilingualHtml } from "@/lib/exportHtml";
import { downloadEnglishPdf } from "@/lib/exportPdf";
import { downloadTxt } from "@/lib/exportTxt";
import { normalizeTranslationFootnotes, parseTranslationText } from "@/lib/footnotes";
import { fileToDataUrl, hasSelectableTextInPdfPage, renderPdfPagesToJpegDataUrls } from "@/lib/imageOcr";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import { streamTranslation } from "@/lib/streamClient";
import {
  createChunksFromPastedText,
  createChunksFromPdfPages,
  createChunksFromSinglePdfPage,
  joinEnglishTranslation
} from "@/lib/textChunking";
import { applyThemePreference, getSavedThemePreference, saveThemePreference } from "@/lib/theme";
import { ExtractedPdfPage, ThemePreference, TranslationChunk, TranslationPage } from "@/lib/types";

const USER_API_KEY_STORAGE = "translator-user-ppq-key";
const LEGACY_USER_API_KEY_STORAGE = "translator-user-openrouter-key";

const SCANNED_MESSAGE =
  "This PDF appears to contain scanned images rather than selectable text. OCR support can be added in a future version.";

export default function HomePage() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [inputMode, setInputMode] = useState<InputMode>("pdf");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [activeUserApiKey, setActiveUserApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);

  const [pdfName, setPdfName] = useState<string | undefined>(undefined);
  const [pdfFile, setPdfFile] = useState<File | undefined>(undefined);
  const [pdfPages, setPdfPages] = useState<ExtractedPdfPage[]>([]);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | undefined>(undefined);
  const [pdfScannedMessage, setPdfScannedMessage] = useState("");
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [pastedText, setPastedText] = useState("");

  const [translatedChunks, setTranslatedChunks] = useState<TranslationChunk[]>([]);
  const [translationPages, setTranslationPages] = useState<TranslationPage[]>([]);
  const [activeView, setActiveView] = useState<TranslationView>("english");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [usedModel, setUsedModel] = useState("");
  const [progressStep, setProgressStep] = useState<ProgressStep>("idle");
  const [documentFontSize, setDocumentFontSize] = useState(16);

  // Streaming / live progress state.
  const [liveText, setLiveText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [completedUnits, setCompletedUnits] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);

  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const savedTheme = getSavedThemePreference();
    setTheme(savedTheme);
    applyThemePreference(savedTheme);

    const savedKey =
      window.localStorage.getItem(USER_API_KEY_STORAGE) || window.localStorage.getItem(LEGACY_USER_API_KEY_STORAGE) || "";
    if (savedKey) {
      setApiKeyDraft(savedKey);
      setActiveUserApiKey(savedKey);
      setRememberKey(true);
      window.localStorage.setItem(USER_API_KEY_STORAGE, savedKey);
      window.localStorage.removeItem(LEGACY_USER_API_KEY_STORAGE);
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

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [pdfObjectUrl]);

  const sourceChunks = useMemo(() => {
    if (inputMode === "pdf") {
      return createChunksFromPdfPages(pdfPages);
    }
    if (inputMode === "image") {
      return [];
    }
    return createChunksFromPastedText(pastedText);
  }, [inputMode, pdfPages, pastedText]);

  const rawEnglishText = useMemo(() => joinEnglishTranslation(translatedChunks), [translatedChunks]);
  const englishText = useMemo(() => normalizeTranslationFootnotes(rawEnglishText), [rawEnglishText]);
  const parsedEnglishText = useMemo(() => parseTranslationText(englishText), [englishText]);
  const sourceLabel = useMemo(() => {
    if (inputMode === "pdf") {
      return pdfName || "Uploaded PDF";
    }
    if (inputMode === "image") {
      return imageName || "Uploaded image";
    }
    return "Pasted Chinese text";
  }, [inputMode, pdfName, imageName]);
  const translateDisabled =
    processing ||
    (inputMode === "pdf" ? pdfTotalPages === 0 : inputMode === "image" ? !imageDataUrl : sourceChunks.length === 0);
  const usingCustomKey = Boolean(activeUserApiKey.trim());
  const canShowPdfSideBySide = inputMode === "pdf" && Boolean(pdfObjectUrl) && pdfTotalPages > 0;
  const canShowImageSideBySide = inputMode === "image" && Boolean(imageDataUrl) && translatedChunks.length > 0;
  const showResultsPanel =
    translatedChunks.length > 0 || canShowPdfSideBySide || canShowImageSideBySide || processing;
  const showLivePreview = isStreaming && activeView === "english";

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  };

  const replacePdfUrl = (nextUrl?: string) => {
    setPdfObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });
  };

  const resetPdfState = () => {
    setPdfName(undefined);
    setPdfFile(undefined);
    setPdfPages([]);
    setPdfTotalPages(0);
    setPdfScannedMessage("");
    replacePdfUrl(undefined);
  };

  const resetImageState = () => {
    setImageName(undefined);
    setImageDataUrl(undefined);
  };

  const handleFileSelect = async (file: File | null) => {
    setErrorMessage("");
    setTranslatedChunks([]);
    setTranslationPages([]);
    setPdfScannedMessage("");

    if (!file) {
      resetPdfState();
      setProgressStep("idle");
      setStatusMessage("");
      return;
    }

    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF file.");
      resetPdfState();
      return;
    }

    setInputMode("pdf");
    resetImageState();
    setPdfName(file.name);
    setPdfFile(file);
    replacePdfUrl(URL.createObjectURL(file));
    setProgressStep("extracting");
    setStatusMessage("Extracting text...");

    const result = await extractSelectableTextFromPdf(file);

    if (result.kind === "error") {
      setPdfPages([]);
      setPdfTotalPages(0);
      setStatusMessage("");
      setProgressStep("idle");
      setErrorMessage(result.message);
      return;
    }

    setPdfPages(result.pages);
    setPdfTotalPages(result.totalPages);
    setStatusMessage("");
    setProgressStep("idle");

    if (result.kind === "scanned") {
      setPdfScannedMessage(SCANNED_MESSAGE);
      return;
    }
  };

  const handleImageSelect = async (file: File | null) => {
    setErrorMessage("");
    setTranslatedChunks([]);
    setTranslationPages([]);

    if (!file) {
      resetImageState();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload an image file.");
      resetImageState();
      return;
    }

    setInputMode("image");
    resetPdfState();
    setImageName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
    } catch {
      setErrorMessage("Unable to load this image.");
      resetImageState();
    }
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyDraft.trim();
    setActiveUserApiKey(trimmed);

    if (rememberKey && trimmed) {
      window.localStorage.setItem(USER_API_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(USER_API_KEY_STORAGE);
      window.localStorage.removeItem(LEGACY_USER_API_KEY_STORAGE);
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
    window.localStorage.removeItem(LEGACY_USER_API_KEY_STORAGE);
  };

  const handleTranslatePdfPageByPage = async () => {
    const pagesToTranslate = pdfPages;
    const completedChunks: TranslationChunk[] = [];
    const completedPages: TranslationPage[] = [];
    const pagesNeedingOcr = pagesToTranslate
      .filter((page) => !hasSelectableTextInPdfPage(page.text))
      .map((page) => page.pageNumber);

    setTotalUnits(pagesToTranslate.length);
    setCompletedUnits(0);

    let ocrImageMap = new Map<number, string>();
    if (pagesNeedingOcr.length > 0) {
      if (!pdfFile) {
        throw new Error("Original PDF file is unavailable for OCR translation.");
      }
      setStatusMessage("Preparing OCR images from PDF pages...");
      ocrImageMap = await renderPdfPagesToJpegDataUrls(pdfFile, pagesNeedingOcr);
    }

    for (let index = 0; index < pagesToTranslate.length; index += 1) {
      const page = pagesToTranslate[index];
      const pageChunks = createChunksFromSinglePdfPage(page);
      const isOcrPage = pageChunks.length === 0;

      setStatusMessage(
        `${isOcrPage ? "Running OCR on" : "Translating"} page ${page.pageNumber} of ${pdfTotalPages}...`
      );
      setLiveText("");
      setIsStreaming(true);

      if (isOcrPage) {
        const imageDataUrl = ocrImageMap.get(page.pageNumber);
        if (!imageDataUrl) {
          const emptyPage: TranslationPage = {
            pageNumber: page.pageNumber,
            originalText: page.text,
            translatedText: "",
            chunks: []
          };
          completedPages.push(emptyPage);
          setTranslationPages([...completedPages]);
          setCompletedUnits(index + 1);
          continue;
        }

        const { text, model } = await streamTranslation(
          {
            imageTask: {
              id: `pdf-ocr-p${page.pageNumber}`,
              pageNumber: page.pageNumber,
              imageDataUrl
            },
            userPpqApiKey: activeUserApiKey || undefined
          },
          { onDelta: (delta) => setLiveText((prev) => prev + delta) }
        );

        if (!text.trim()) {
          throw new Error(`Empty OCR translation output returned for page ${page.pageNumber}.`);
        }

        const ocrChunk: TranslationChunk = {
          id: `pdf-ocr-p${page.pageNumber}`,
          pageNumber: page.pageNumber,
          originalChinese: "[Image-based source text]",
          translatedEnglish: text
        };
        const pageResult: TranslationPage = {
          pageNumber: page.pageNumber,
          originalText: page.text,
          translatedText: text,
          chunks: [ocrChunk]
        };

        completedPages.push(pageResult);
        completedChunks.push(ocrChunk);
        setTranslationPages([...completedPages]);
        setTranslatedChunks([...completedChunks]);
        if (model) setUsedModel(model);
        setCompletedUnits(index + 1);
        continue;
      }

      // Selectable-text page: translate each chunk, streaming the active chunk.
      const translatedPageChunks: TranslationChunk[] = [];
      let pageModel = "";

      for (const pageChunk of pageChunks) {
        const { text, model } = await streamTranslation(
          { chunk: pageChunk, userPpqApiKey: activeUserApiKey || undefined },
          { onDelta: (delta) => setLiveText((prev) => prev + delta) }
        );

        if (!text.trim()) {
          throw new Error(`Empty translation output returned for page ${page.pageNumber}.`);
        }

        translatedPageChunks.push({ ...pageChunk, translatedEnglish: text });
        if (model) pageModel = model;
      }

      const translatedText = normalizeTranslationFootnotes(joinEnglishTranslation(translatedPageChunks));
      const pageResult: TranslationPage = {
        pageNumber: page.pageNumber,
        originalText: page.text,
        translatedText,
        chunks: translatedPageChunks
      };

      completedPages.push(pageResult);
      completedChunks.push(...translatedPageChunks);
      setTranslationPages([...completedPages]);
      setTranslatedChunks([...completedChunks]);
      if (pageModel) setUsedModel(pageModel);
      setCompletedUnits(index + 1);
    }

    setIsStreaming(false);
    setLiveText("");
  };

  const handleTranslateImage = async () => {
    if (!imageDataUrl) {
      throw new Error("Upload an image to begin translation.");
    }

    setTotalUnits(1);
    setCompletedUnits(0);
    setStatusMessage("Running OCR translation for image...");
    setLiveText("");
    setIsStreaming(true);

    const { text, model } = await streamTranslation(
      {
        imageTask: { id: "image-ocr-1", pageNumber: 1, imageDataUrl },
        userPpqApiKey: activeUserApiKey || undefined
      },
      { onDelta: (delta) => setLiveText((prev) => prev + delta) }
    );

    if (!text.trim()) {
      throw new Error("Empty image translation result.");
    }

    const normalizedChunk: TranslationChunk = {
      id: "image-ocr-1",
      pageNumber: 1,
      originalChinese: "[Image-based source text]",
      translatedEnglish: text
    };
    setTranslatedChunks([normalizedChunk]);
    setTranslationPages([
      {
        pageNumber: 1,
        originalText: "[Image-based source text]",
        translatedText: text,
        chunks: [normalizedChunk]
      }
    ]);
    if (model) setUsedModel(model);
    setCompletedUnits(1);
    setIsStreaming(false);
    setLiveText("");
  };

  const handleTranslate = async () => {
    setErrorMessage("");

    if (inputMode === "pdf" && pdfTotalPages === 0) {
      setErrorMessage("Upload a PDF to begin.");
      return;
    }
    if (inputMode === "image" && !imageDataUrl) {
      setErrorMessage("Upload an image to begin.");
      return;
    }
    if (inputMode === "text" && sourceChunks.length === 0) {
      setErrorMessage("Paste Chinese text to begin.");
      return;
    }

    setProcessing(true);
    setTranslatedChunks([]);
    setTranslationPages([]);
    setLiveText("");
    setIsStreaming(false);
    setCompletedUnits(0);
    setTotalUnits(0);
    setActiveView("english");
    setProgressStep("preparing");
    setStatusMessage("Preparing chunks...");

    await new Promise((resolve) => setTimeout(resolve, 120));

    try {
      setProgressStep("translating");

      if (inputMode === "pdf") {
        await handleTranslatePdfPageByPage();
      } else if (inputMode === "image") {
        await handleTranslateImage();
      } else {
        const completedChunks: TranslationChunk[] = [];
        setTotalUnits(sourceChunks.length);
        setCompletedUnits(0);

        for (let index = 0; index < sourceChunks.length; index += 1) {
          const chunk = sourceChunks[index];
          setStatusMessage(`Translating section ${index + 1} of ${sourceChunks.length}...`);
          setLiveText("");
          setIsStreaming(true);

          const { text, model } = await streamTranslation(
            { chunk, userPpqApiKey: activeUserApiKey || undefined },
            { onDelta: (delta) => setLiveText((prev) => prev + delta) }
          );

          if (!text.trim()) {
            throw new Error("Empty translation result.");
          }

          completedChunks.push({ ...chunk, translatedEnglish: text });
          setTranslatedChunks([...completedChunks]);
          if (model) setUsedModel(model);
          setCompletedUnits(index + 1);
        }

        setIsStreaming(false);
        setLiveText("");
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
      }, 1200);
    } catch (error) {
      setStatusMessage("");
      setProgressStep("idle");
      setErrorMessage(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setProcessing(false);
      setIsStreaming(false);
      setLiveText("");
    }
  };

  const handleReset = () => {
    resetPdfState();
    resetImageState();
    setPastedText("");
    setTranslatedChunks([]);
    setTranslationPages([]);
    setStatusMessage("");
    setErrorMessage("");
    setUsedModel("");
    setProgressStep("idle");
    setDocumentFontSize(16);
    setLiveText("");
    setIsStreaming(false);
    setCompletedUnits(0);
    setTotalUnits(0);
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

  const handleDownloadHtml = () => {
    try {
      downloadBilingualHtml({
        chunks: translatedChunks,
        sourceLabel,
        model: usedModel
      });
      showToast("HTML downloaded");
    } catch {
      setErrorMessage("HTML export failed.");
    }
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppHeader theme={theme} onThemeChange={setTheme} onOpenApiSettings={() => setIsSettingsOpen(true)} />

        <section className="rounded-[30px] border border-amber-200/70 bg-white/85 p-6 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-amber-50">
              1
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add Chinese source content</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Pick an input method, then translate to clean, review-ready English.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <InputModeTabs value={inputMode} onChange={setInputMode} />
          </div>

          <div className="mt-5 rounded-3xl border border-amber-200/60 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
            {inputMode === "pdf" ? (
              <FileUpload fileName={pdfName} onFileSelect={handleFileSelect} />
            ) : inputMode === "image" ? (
              <ImageUpload fileName={imageName} onFileSelect={handleImageSelect} />
            ) : (
              <TextInputPanel value={pastedText} onChange={setPastedText} onClear={() => setPastedText("")} />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={translateDisabled}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-700 to-amber-600 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-sm transition hover:from-amber-600 hover:to-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {processing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
                  Translating…
                </>
              ) : (
                "Translate to English"
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={processing}
              className="rounded-full border border-slate-300 bg-white/90 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              Reset
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  usingCustomKey
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${usingCustomKey ? "bg-emerald-500" : "bg-slate-400"}`} />
                {usingCustomKey ? "Your PPQ key" : "Default app key"}
              </span>
              {usedModel ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {usedModel}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <ProgressIndicator
          step={progressStep}
          processing={processing}
          completedUnits={completedUnits}
          totalUnits={totalUnits}
          statusMessage={statusMessage}
          streaming={isStreaming}
        />

        <ErrorState message={errorMessage} />

        {showResultsPanel ? (
          <section className="space-y-4 rounded-[30px] border border-amber-200/70 bg-white/85 p-6 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Translation results</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {processing && totalUnits > 0
                    ? `Translating live — ${Math.min(completedUnits, totalUnits)} of ${totalUnits} ${
                        inputMode === "pdf" ? "pages" : "sections"
                      } done`
                    : "Review, copy, and export as HTML, TXT, or PDF."}
                </p>
              </div>
              <ExportButtons
                onCopy={handleCopyEnglish}
                onDownloadHtml={handleDownloadHtml}
                onDownloadTxt={handleDownloadTxt}
                onDownloadPdf={handleDownloadPdf}
                copied={toastVisible && toastMessage === "Copied to clipboard."}
                disabled={!englishText || processing}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <TranslationTabs active={activeView} onChange={setActiveView} />

              {activeView === "english" || (activeView === "original" && inputMode !== "image") ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDocumentFontSize((prev) => Math.max(14, prev - 1))}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentFontSize((prev) => Math.min(22, prev + 1))}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    A+
                  </button>
                </div>
              ) : null}
            </div>

            {activeView === "original" ? (
              inputMode === "image" ? (
                <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Image</p>
                  {imageDataUrl ? (
                    <img src={imageDataUrl} alt="Uploaded source" className="max-h-[72vh] w-full rounded-2xl border border-amber-100 object-contain dark:border-slate-700" />
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">No image loaded.</p>
                  )}
                </article>
              ) : inputMode === "pdf" ? (
                <div className="space-y-4">
                  {pdfPages.map((page) => (
                    <article
                      key={`orig-page-${page.pageNumber}`}
                      className="rounded-3xl border border-amber-200/70 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        第 {page.pageNumber} 頁 · Page {page.pageNumber}
                      </p>
                      <div
                        className="text-slate-800 dark:text-slate-100"
                        style={{ fontSize: `${documentFontSize}px` }}
                      >
                        {page.text.trim() ? (
                          <ChineseSourceBody text={page.text} />
                        ) : (
                          <p className="cn-text text-sm text-slate-500 dark:text-slate-400">
                            此頁未偵測到可選取的文字（可能為掃描圖檔）。
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <article className="mx-auto w-full max-w-4xl rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Original Chinese
                  </p>
                  <div className="text-slate-800 dark:text-slate-100" style={{ fontSize: `${documentFontSize}px` }}>
                    <ChineseSourceBody text={pastedText} />
                  </div>
                </article>
              )
            ) : null}

            {activeView === "english" ? (
              <article className="mx-auto w-full max-w-4xl rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    English Translation
                  </p>
                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      Streaming
                    </span>
                  ) : null}
                </div>
                <div
                  className="document-text text-slate-800 dark:text-slate-100"
                  style={{ fontFamily: "var(--font-doc), Georgia, serif", fontSize: `${documentFontSize}px`, lineHeight: 1.9 }}
                >
                  {parsedEnglishText.bodyParagraphs.length > 0 ? (
                    <StructuredTranslationBody paragraphs={parsedEnglishText.bodyParagraphs} />
                  ) : null}

                  {/* Live streaming text for the chunk currently being translated. */}
                  {showLivePreview && liveText ? (
                    <p className={parsedEnglishText.bodyParagraphs.length > 0 ? "mt-5 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
                      {liveText}
                      <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-amber-500 align-middle" />
                    </p>
                  ) : null}

                  {/* Placeholder while waiting for the first tokens. */}
                  {processing && !englishText && !liveText ? (
                    <div className="space-y-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                      <div className="h-4 w-full animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                      <p className="pt-2 text-sm text-slate-400 dark:text-slate-500">Waiting for the model to respond…</p>
                    </div>
                  ) : null}

                  {parsedEnglishText.footnotes.length > 0 ? (
                    <section className="mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/80 dark:bg-amber-950/30">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        Footnotes
                      </p>
                      <ol className="space-y-2">
                        {parsedEnglishText.footnotes.map((note) => (
                          <li
                            key={`${note.marker}-${note.content.slice(0, 24)}`}
                            className="text-sm leading-8 text-slate-700 dark:text-slate-200"
                          >
                            <span className="mr-2 font-semibold text-amber-800 dark:text-amber-200">{note.marker}</span>
                            <span>{note.content}</span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : null}
                </div>
              </article>
            ) : null}

            {activeView === "side-by-side" ? (
              canShowPdfSideBySide ? (
                <PdfSideBySideView
                  pdfUrl={pdfObjectUrl ?? ""}
                  totalPages={pdfTotalPages}
                  extractedPages={pdfPages}
                  translationPages={translationPages}
                  scannedMessage={pdfScannedMessage}
                />
              ) : canShowImageSideBySide ? (
                <ImageSideBySideView imageDataUrl={imageDataUrl ?? ""} translatedText={translationPages[0]?.translatedText || ""} />
              ) : (
                <SideBySideView chunks={translatedChunks} />
              )
            ) : null}
          </section>
        ) : (
          <EmptyState
            title="Upload a PDF, upload an image, or paste Chinese text to begin."
            description="After translation, you can switch views, copy the English output, and export HTML, TXT, or PDF."
          />
        )}
      </div>

      <ApiKeySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeyDraft={apiKeyDraft}
        rememberKey={rememberKey}
        statusLabel={usingCustomKey ? "Your PPQ key" : "Default app key"}
        onApiKeyDraftChange={setApiKeyDraft}
        onRememberKeyChange={setRememberKey}
        onSave={handleSaveApiKey}
        onClearSaved={handleClearSavedKey}
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
