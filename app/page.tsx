"use client";

import { useEffect, useMemo, useState } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";
import AppHeader from "@/components/AppHeader";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import DomainSelector from "@/components/DomainSelector";
import EntityGlossary, { GlossaryEntry } from "@/components/EntityGlossary";
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
import { ExtractedEntity, extractEntitiesHeuristic } from "@/lib/extractEntities";
import { normalizeTranslationFootnotes, parseTranslationText } from "@/lib/footnotes";
import { fileToDataUrl, hasSelectableTextInPdfPage, renderPdfPagesToJpegDataUrls } from "@/lib/imageOcr";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import { DOMAINS, TranslationDomain } from "@/lib/prompts";
import { withSmartRetry } from "@/lib/smartRetry";
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
  "This PDF appears image-based. The workspace can translate scanned pages with OCR, but names, seals, and dense tables may still need manual review.";

/** Builds a rolling context summary from the end of the translated text. */
const makeRollingSummary = (text: string, maxLen = 180): string => {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(-maxLen);
  // Try to start at a sentence boundary.
  const sentenceBreak = slice.search(/[.!?。！？]\s+/);
  return sentenceBreak > 10 ? slice.slice(sentenceBreak + 1).trim() : slice.trim();
};

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
  const [readingWidth, setReadingWidth] = useState<"focused" | "wide">("focused");

  // Streaming / live progress state.
  const [liveText, setLiveText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [completedUnits, setCompletedUnits] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);

  // Phase 1: Translation Quality state.
  const [domain, setDomain] = useState<TranslationDomain>("general");
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [previousSummary, setPreviousSummary] = useState("");

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
  const pagesWithSelectableText = useMemo(
    () => pdfPages.filter((page) => hasSelectableTextInPdfPage(page.text)).length,
    [pdfPages]
  );
  const ocrPageCount = useMemo(() => Math.max(pdfTotalPages - pagesWithSelectableText, 0), [pagesWithSelectableText, pdfTotalPages]);
  const hasTranslation = useMemo(
    () => translatedChunks.length > 0 || translationPages.some((page) => page.translatedText.trim()),
    [translatedChunks, translationPages]
  );
  const hasSourceLoaded = useMemo(() => {
    if (inputMode === "pdf") {
      return pdfTotalPages > 0;
    }
    if (inputMode === "image") {
      return Boolean(imageDataUrl);
    }
    return Boolean(pastedText.trim());
  }, [imageDataUrl, inputMode, pastedText, pdfTotalPages]);
  const selectedDomain = useMemo(() => DOMAINS.find((entry) => entry.id === domain) ?? DOMAINS[0], [domain]);
  const lockedGlossaryCount = useMemo(
    () => glossaryEntries.filter((entry) => entry.locked && entry.english.trim()).length,
    [glossaryEntries]
  );
  const sourceSummary = useMemo(() => {
    if (inputMode === "pdf") {
      if (!pdfTotalPages) {
        return {
          title: "No PDF loaded yet",
          detail: "Upload a Chinese PDF to preview pages and translate them in the review workspace.",
          helper: "Selectable text translates fastest. Image-based pages can fall back to OCR."
        };
      }

      return {
        title: pdfName || "PDF ready",
        detail: `${pdfTotalPages} page${pdfTotalPages === 1 ? "" : "s"} loaded · ${pagesWithSelectableText} selectable · ${ocrPageCount} OCR candidate${ocrPageCount === 1 ? "" : "s"}`,
        helper: ocrPageCount > 0 ? SCANNED_MESSAGE : "This document appears mostly text-selectable and is ready for translation."
      };
    }

    if (inputMode === "image") {
      if (!imageDataUrl) {
        return {
          title: "No image loaded yet",
          detail: "Upload a screenshot, scan, or photo to run OCR-assisted translation.",
          helper: "Higher contrast and tighter crops usually produce better OCR output."
        };
      }

      return {
        title: imageName || "Image ready",
        detail: "Vision OCR mode is ready for translation.",
        helper: "Review names, chart labels, and tables after translation for OCR drift."
      };
    }

    if (!pastedText.trim()) {
      return {
        title: "No pasted text yet",
        detail: "Paste Traditional or Simplified Chinese to translate it immediately.",
        helper: "Short passages are fastest here. Longer texts benefit from glossary setup before you run them."
      };
    }

    const sectionCount = sourceChunks.length;
    return {
      title: "Text ready",
      detail: `${pastedText.length.toLocaleString()} characters · ${sectionCount} section${sectionCount === 1 ? "" : "s"} to translate`,
      helper: "Use the glossary and domain selector before translating if terminology matters."
    };
  }, [imageDataUrl, imageName, inputMode, ocrPageCount, pagesWithSelectableText, pastedText, pdfName, pdfTotalPages, sourceChunks.length]);

  const translateDisabled =
    processing ||
    (inputMode === "pdf" ? pdfTotalPages === 0 : inputMode === "image" ? !imageDataUrl : sourceChunks.length === 0);
  const usingCustomKey = Boolean(activeUserApiKey.trim());
  const canShowPdfSideBySide = inputMode === "pdf" && Boolean(pdfObjectUrl) && pdfTotalPages > 0;
  const canShowImageSideBySide = inputMode === "image" && Boolean(imageDataUrl) && hasTranslation;
  const showResultsPanel = hasSourceLoaded || hasTranslation || processing;
  const showLivePreview = isStreaming && activeView === "english";
  const readingWidthClass = readingWidth === "wide" ? "max-w-5xl" : "max-w-3xl";

  useEffect(() => {
    if (!processing && !hasTranslation && hasSourceLoaded) {
      setActiveView("original");
    }
  }, [hasSourceLoaded, hasTranslation, processing]);

  /** Locked glossary as a plain Record for API payload. */
  const lockedGlossary = useMemo(() => {
    const record: Record<string, string> = {};
    for (const entry of glossaryEntries) {
      if (entry.locked && entry.english.trim()) {
        record[entry.chinese] = entry.english.trim();
      }
    }
    return record;
  }, [glossaryEntries]);

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
    setExtractedEntities([]);

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
    setActiveView("original");
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

    // Extract entities from the full text.
    const fullText = result.pages.map((p) => p.text).join("\n\n");
    const heuristics = extractEntitiesHeuristic(fullText);
    setExtractedEntities(heuristics);

    // Fire off LLM entity extraction in the background to auto-fill English.
    fetchEntityTranslations(fullText);
  };

  const handleImageSelect = async (file: File | null) => {
    setErrorMessage("");
    setTranslatedChunks([]);
    setTranslationPages([]);
    setExtractedEntities([]);

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
    setActiveView("original");
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

  const fetchEntityTranslations = async (text: string) => {
    try {
      const response = await fetch("/api/extract-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          domain,
          userPpqApiKey: activeUserApiKey || undefined
        })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { entities?: ExtractedEntity[] };
      if (!payload.entities || payload.entities.length === 0) {
        return;
      }

      // Merge LLM-provided English translations into existing extracted entities.
      setExtractedEntities((prev) => {
        const map = new Map(prev.map((e) => [e.chinese, e]));
        for (const entity of payload.entities!) {
          const existing = map.get(entity.chinese);
          if (existing) {
            map.set(entity.chinese, { ...existing, english: entity.english || existing.english });
          } else {
            map.set(entity.chinese, entity);
          }
        }
        return Array.from(map.values());
      });
    } catch {
      // Silently fail — glossary will still show heuristic Chinese terms.
    }
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

        const { text, model } = await withSmartRetry(
          async () =>
            streamTranslation(
              {
                imageTask: {
                  id: `pdf-ocr-p${page.pageNumber}`,
                  pageNumber: page.pageNumber,
                  imageDataUrl
                },
                userPpqApiKey: activeUserApiKey || undefined,
                domain,
                previousSummary: previousSummary || undefined,
                glossary: lockedGlossary
              },
              { onDelta: (delta) => setLiveText((prev) => prev + delta) }
            ),
          { maxRetries: 2 }
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
        setPreviousSummary(makeRollingSummary(text));
        continue;
      }

      // Selectable-text page: translate each chunk, streaming the active chunk.
      const translatedPageChunks: TranslationChunk[] = [];
      let pageModel = "";

      for (const pageChunk of pageChunks) {
        const { text, model } = await withSmartRetry(
          async () =>
            streamTranslation(
              {
                chunk: pageChunk,
                userPpqApiKey: activeUserApiKey || undefined,
                domain,
                previousSummary: previousSummary || undefined,
                glossary: lockedGlossary
              },
              { onDelta: (delta) => setLiveText((prev) => prev + delta) }
            ),
          { maxRetries: 2 }
        );

        if (!text.trim()) {
          throw new Error(`Empty translation output returned for page ${page.pageNumber}.`);
        }

        translatedPageChunks.push({ ...pageChunk, translatedEnglish: text });
        if (model) pageModel = model;
        setPreviousSummary(makeRollingSummary(text));
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

    const { text, model } = await withSmartRetry(
      async () =>
        streamTranslation(
          {
            imageTask: { id: "image-ocr-1", pageNumber: 1, imageDataUrl },
            userPpqApiKey: activeUserApiKey || undefined,
            domain,
            previousSummary: previousSummary || undefined,
            glossary: lockedGlossary
          },
          { onDelta: (delta) => setLiveText((prev) => prev + delta) }
        ),
      { maxRetries: 2 }
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
    setPreviousSummary(makeRollingSummary(text));
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
    setStatusMessage("Preparing chunks & glossary...");
    setPreviousSummary("");

    await new Promise((resolve) => setTimeout(resolve, 120));

    // Extract entities for text mode (PDF already extracted on upload).
    if (inputMode === "text" && sourceChunks.length > 0) {
      const sampleText = sourceChunks.map((c) => c.originalChinese).join("\n\n");
      const heuristics = extractEntitiesHeuristic(sampleText);
      setExtractedEntities(heuristics);
      fetchEntityTranslations(sampleText);
    }

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

          const { text, model } = await withSmartRetry(
            async () =>
              streamTranslation(
                {
                  chunk,
                  userPpqApiKey: activeUserApiKey || undefined,
                  domain,
                  previousSummary: previousSummary || undefined,
                  glossary: lockedGlossary
                },
                { onDelta: (delta) => setLiveText((prev) => prev + delta) }
              ),
            { maxRetries: 2 }
          );

          if (!text.trim()) {
            throw new Error("Empty translation result.");
          }

          completedChunks.push({ ...chunk, translatedEnglish: text });
          setTranslatedChunks([...completedChunks]);
          if (model) setUsedModel(model);
          setCompletedUnits(index + 1);
          setPreviousSummary(makeRollingSummary(text));
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
    setLiveText("");
    setIsStreaming(false);
    setCompletedUnits(0);
    setTotalUnits(0);
    setExtractedEntities([]);
    setPreviousSummary("");
    setActiveView("original");
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
    <main className="min-h-screen px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <AppHeader
          theme={theme}
          usingCustomKey={usingCustomKey}
          onThemeChange={setTheme}
          onOpenApiSettings={() => setIsSettingsOpen(true)}
        />

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="rounded-[30px] border border-amber-200/70 bg-white/85 p-6 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-amber-50">
                  1
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add source content</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Choose the input that best matches your source, then preview it before translating.
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

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/70">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Source Status
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{sourceSummary.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{sourceSummary.detail}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{sourceSummary.helper}</p>
              </div>
            </section>

            <section className="rounded-[30px] border border-amber-200/70 bg-white/85 p-6 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                  2
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tune the translation</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Set terminology, domain, and connection settings before you run the document.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Domain
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    {selectedDomain.label}
                  </span>
                </div>
                <div className="mt-3">
                  <DomainSelector value={domain} onChange={setDomain} disabled={processing} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedDomain.description}</p>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Glossary control</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Lock preferred names and technical terms before you translate.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGlossaryOpen(true)}
                      className="rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                    >
                      Open glossary
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {extractedEntities.length} detected
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {lockedGlossaryCount} locked
                    </span>
                  </div>
                  {lockedGlossaryCount > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {glossaryEntries
                        .filter((entry) => entry.locked && entry.english.trim())
                        .slice(0, 3)
                        .map((entry) => (
                          <span
                            key={`${entry.chinese}-${entry.english}`}
                            className="rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                          >
                            {entry.chinese}
                            {" -> "}
                            {entry.english}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/70">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connection</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Use the shared app key, or switch to a personal PPQ key if you need separate limits.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                        usingCustomKey
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${usingCustomKey ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {usingCustomKey ? "Personal PPQ key active" : "Using shared app key"}
                    </span>
                    {usedModel ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {usedModel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translateDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-700 to-amber-600 px-5 py-3 text-sm font-semibold text-amber-50 shadow-sm transition hover:from-amber-600 hover:to-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                >
                  {processing ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
                      Translating...
                    </>
                  ) : (
                    "Translate to English"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={processing}
                  className="rounded-full border border-slate-300 bg-white/90 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
                >
                  New document
                </button>
              </div>
            </section>
          </aside>

          <section className="space-y-5">
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
                {hasTranslation || processing ? (
                  <div className="sticky top-4 z-10 space-y-4 rounded-[26px] border border-amber-200/60 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {processing ? "Translation in progress" : "Translation results"}
                        </h3>
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {processing && totalUnits > 0
                            ? `Working through ${Math.min(completedUnits, totalUnits)} of ${totalUnits} ${inputMode === "pdf" ? "pages" : inputMode === "image" ? "image steps" : "sections"}`
                            : `Review ${sourceLabel}, compare layouts, then export the final English output.`}
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
                      <div className="flex flex-wrap items-center gap-2">
                        {(activeView === "english" || (activeView === "original" && inputMode !== "image")) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setDocumentFontSize((prev) => Math.max(14, prev - 1))}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              A-
                            </button>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {documentFontSize}px
                            </span>
                            <button
                              type="button"
                              onClick={() => setDocumentFontSize((prev) => Math.min(22, prev + 1))}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              A+
                            </button>
                            <button
                              type="button"
                              onClick={() => setDocumentFontSize(16)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Reset size
                            </button>
                            <button
                              type="button"
                              onClick={() => setReadingWidth((prev) => (prev === "focused" ? "wide" : "focused"))}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {readingWidth === "focused" ? "Wider page" : "Focused width"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-amber-200/60 bg-white/95 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Source preview</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      Review the source, adjust your glossary or domain if needed, then run translation when you are ready.
                    </p>
                  </div>
                )}

                {!hasTranslation && !processing ? (
                  inputMode === "image" ? (
                    <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Source Image</p>
                      {imageDataUrl ? (
                        <img
                          src={imageDataUrl}
                          alt="Uploaded source"
                          className="max-h-[72vh] w-full rounded-2xl border border-amber-100 object-contain dark:border-slate-700"
                        />
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">No image loaded.</p>
                      )}
                    </article>
                  ) : inputMode === "pdf" ? (
                    <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Source PDF</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {pdfName ? `${pdfName} · ${pdfTotalPages} pages` : "Upload a PDF to preview it here."}
                          </p>
                        </div>
                        {ocrPageCount > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                            {ocrPageCount} OCR page{ocrPageCount === 1 ? "" : "s"} detected
                          </span>
                        ) : null}
                      </div>
                      {pdfObjectUrl ? (
                        <iframe
                          src={`${pdfObjectUrl}#page=1&zoom=page-width`}
                          title="Source PDF preview"
                          className="mt-4 h-[72vh] min-h-[560px] w-full rounded-2xl border border-amber-100 bg-white dark:border-slate-700"
                        />
                      ) : (
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No PDF loaded.</p>
                      )}
                    </article>
                  ) : (
                    <article className={`mx-auto w-full ${readingWidthClass} rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/70`}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Original Chinese
                      </p>
                      <div className="text-slate-800 dark:text-slate-100" style={{ fontSize: `${documentFontSize}px` }}>
                        <ChineseSourceBody text={pastedText} />
                      </div>
                    </article>
                  )
                ) : null}

                {hasTranslation || processing ? (
                  <>
                    {activeView === "original" ? (
                      inputMode === "image" ? (
                        <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Image</p>
                          {imageDataUrl ? (
                            <img
                              src={imageDataUrl}
                              alt="Uploaded source"
                              className="max-h-[72vh] w-full rounded-2xl border border-amber-100 object-contain dark:border-slate-700"
                            />
                          ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">No image loaded.</p>
                          )}
                        </article>
                      ) : inputMode === "pdf" ? (
                        <div className="space-y-4">
                          {pdfPages.map((page) => (
                            <article
                              key={`orig-page-${page.pageNumber}`}
                              className={`mx-auto w-full ${readingWidthClass} rounded-3xl border border-amber-200/70 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70`}
                            >
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  第 {page.pageNumber} 頁 · Page {page.pageNumber}
                                </p>
                                {!page.text.trim() ? (
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                                    OCR page
                                  </span>
                                ) : null}
                              </div>
                              <div
                                className="text-slate-800 dark:text-slate-100"
                                style={{ fontSize: `${documentFontSize}px` }}
                              >
                                {page.text.trim() ? (
                                  <ChineseSourceBody text={page.text} />
                                ) : (
                                  <p className="cn-text text-sm text-slate-500 dark:text-slate-400">
                                    此頁未偵測到可選取的文字，翻譯時會改用 OCR。
                                  </p>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <article className={`mx-auto w-full ${readingWidthClass} rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/70`}>
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
                      <article className={`mx-auto w-full ${readingWidthClass} rounded-3xl border border-amber-200/70 bg-white/90 p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/70`}>
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

                          {showLivePreview && liveText ? (
                            <p className={parsedEnglishText.bodyParagraphs.length > 0 ? "mt-5 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
                              {liveText}
                              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-amber-500 align-middle" />
                            </p>
                          ) : null}

                          {processing && !englishText && !liveText ? (
                            <div className="space-y-3">
                              <div className="h-4 w-3/4 animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                              <div className="h-4 w-full animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                              <div className="h-4 w-5/6 animate-pulse rounded bg-amber-100/80 dark:bg-slate-800" />
                              <p className="pt-2 text-sm text-slate-400 dark:text-slate-500">Waiting for the model to respond...</p>
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
                  </>
                ) : null}
              </section>
            ) : (
              <section className="rounded-[30px] border border-dashed border-amber-300 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Build the translation workspace</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Start with a PDF, scan, or pasted passage. Once a source is loaded, this panel becomes your review
                  canvas for original text, live translation, and side-by-side comparison.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Choose the right input</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      PDFs work best for longer documents. Image mode handles scans and screenshots. Text mode is fastest for quick checks.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">2. Tune terminology</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Set the domain and lock names or technical terms in the glossary before you run the translation.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">3. Review like an editor</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Compare the original and English output, then export clean HTML, TXT, or PDF once you are satisfied.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </section>
        </div>
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

      <EntityGlossary
        extracted={extractedEntities}
        entries={glossaryEntries}
        onEntriesChange={setGlossaryEntries}
        open={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
