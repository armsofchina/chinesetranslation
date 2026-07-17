"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ApiKeySettings from "@/components/ApiKeySettings";
import AppHeader from "@/components/AppHeader";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import DocumentSourceView from "@/components/DocumentSourceView";
import DocumentRangeSelector from "@/components/DocumentRangeSelector";
import DomainSelector from "@/components/DomainSelector";
import DropZoneOverlay from "@/components/DropZoneOverlay";
import EmptyState from "@/components/EmptyState";
import EntityGlossary, { GlossaryEntry } from "@/components/EntityGlossary";
import ErrorState from "@/components/ErrorState";
import ExportButtons from "@/components/ExportButtons";
import FileUpload from "@/components/FileUpload";
import ImageSideBySideView from "@/components/ImageSideBySideView";
import ImageUpload from "@/components/ImageUpload";
import InputModeTabs, { InputMode } from "@/components/InputModeTabs";
import LargeFileWarningModal, { TranslationPreflightSummary } from "@/components/LargeFileWarningModal";
import PdfSideBySideView from "@/components/PdfSideBySideView";
import ProgressIndicator, { ProgressStep } from "@/components/ProgressIndicator";
import SideBySideView from "@/components/SideBySideView";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import TextInputPanel from "@/components/TextInputPanel";
import Toast from "@/components/Toast";
import TranslationTabs, { TranslationView } from "@/components/TranslationTabs";
import TranslationEditor from "@/components/TranslationEditor";
import { TranslationHistoryModal } from "@/components/TranslationHistoryList";
import TranslationQualityPanel from "@/components/TranslationQualityPanel";
import { AiProviderId, normalizeAiProvider } from "@/lib/aiProviders";
import {
  OPENROUTER_API_KEY_STORAGE,
  OPENROUTER_CONNECTION_STORAGE,
  OPENROUTER_MODEL_STORAGE,
} from "@/lib/openRouterBrowser";
import {
  normalizeOpenRouterModel,
  OPENROUTER_AUTO_FREE_MODEL
} from "@/lib/openRouterModels";
import { downloadBilingualHtml } from "@/lib/exportHtml";
import { downloadBilingualDocx } from "@/lib/exportDocx";
import { downloadEnglishPdf } from "@/lib/exportPdf";
import { downloadTxt } from "@/lib/exportTxt";
import { extractStructuredDocument, getDocumentFormat } from "@/lib/documentExtract";
import { ExtractedEntity, extractEntitiesHeuristic } from "@/lib/extractEntities";
import { normalizeTranslationFootnotes, parseTranslationText } from "@/lib/footnotes";
import {
  fileToDataUrl,
  hasSelectableTextInPdfPage,
  preparePdfOcrFallback,
  renderPdfPagesToJpegDataUrls
} from "@/lib/imageOcr";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import {
  clearWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot
} from "@/lib/projectStore";
import { DOMAINS, TranslationDomain } from "@/lib/prompts";
import { inspectTranslationQuality } from "@/lib/qualityChecks";
import { buildSegmentQaReport } from "@/lib/segmentQa";
import { withSmartRetry } from "@/lib/smartRetry";
import { streamTranslation } from "@/lib/streamClient";
import {
  createChunksFromPastedText,
  createChunksFromPdfPages,
  createChunksFromSinglePdfPage,
  joinEnglishTranslation
} from "@/lib/textChunking";
import { applyThemePreference, getSavedThemePreference, saveThemePreference } from "@/lib/theme";
import {
  clearTranslationHistory,
  deleteTranslationHistoryEntry,
  listTranslationHistory,
  makeHistoryEntryId,
  saveTranslationHistoryEntry,
  toHistoryChunks,
  TranslationHistoryEntry
} from "@/lib/translationHistory";
import { DocumentFormat, ExtractedPdfPage, ThemePreference, TranslationChunk, TranslationPage } from "@/lib/types";
import { assertCurrentTranslationJob, createTranslationJob, TranslationJobSnapshot } from "@/lib/translationJob";
import { findTranslationMemory, rememberTranslation } from "@/lib/translationMemory";

const USER_API_KEY_STORAGE = "translator-user-ppq-key";
const LEGACY_USER_API_KEY_STORAGE = "translator-user-openrouter-key";
const PROVIDER_STORAGE = "translator-ai-provider";
const HISTORY_ENABLED_STORAGE = "translator-history-enabled";
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_UNITS = 250;
const LARGE_FILE_BYTES = 10 * 1024 * 1024;
const LARGE_SOURCE_CHARACTERS = 30_000;
const LARGE_REQUEST_COUNT = 25;
const LARGE_OCR_PAGE_COUNT = 5;
const LARGE_UNIT_COUNT = 30;

const DOCUMENT_FORMAT_LABELS: Record<DocumentFormat, string> = {
  pdf: "PDF",
  docx: "DOCX",
  epub: "EPUB",
  pptx: "PowerPoint"
};

const DOCUMENT_UNIT_LABELS: Record<DocumentFormat, string> = {
  pdf: "page",
  docx: "section",
  epub: "chapter",
  pptx: "slide"
};

const SCANNED_MESSAGE =
  "This PDF appears image-based. The workspace can translate scanned pages with OCR, but names, seals, and dense tables may still need manual review.";

const makeRollingContext = (source: string, translation: string, maxLen = 800): string => {
  const combined = `Previous source:\n${source.trim()}\n\nPrevious translation:\n${translation.trim()}`;
  return combined.length <= maxLen ? combined : combined.slice(-maxLen);
};

/** True at the Tailwind `lg` breakpoint and above. Starts false so SSR/first paint match mobile. */
const useIsLargeScreen = (): boolean => {
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLargeScreen(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isLargeScreen;
};

export default function HomePage() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [inputMode, setInputMode] = useState<InputMode>("document");
  const [documentFormat, setDocumentFormat] = useState<DocumentFormat>("pdf");
  const [documentRangeStart, setDocumentRangeStart] = useState(1);
  const [documentRangeEnd, setDocumentRangeEnd] = useState(1);
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<AiProviderId>("ppq");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [activeUserApiKey, setActiveUserApiKey] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState(OPENROUTER_AUTO_FREE_MODEL);
  const [rememberKey, setRememberKey] = useState(false);
  const [openRouterConnection, setOpenRouterConnection] = useState<{
    connected: boolean;
    loading: boolean;
    userId?: string;
  }>({ connected: false, loading: true });

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
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [approvedChunkIds, setApprovedChunkIds] = useState<string[]>([]);
  const [translationStale, setTranslationStale] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<TranslationHistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySavingEnabled, setHistorySavingEnabled] = useState(true);

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
  const [analyzingTerms, setAnalyzingTerms] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const isLargeScreen = useIsLargeScreen();
  const abortControllerRef = useRef<AbortController | null>(null);
  const entityAbortControllerRef = useRef<AbortController | null>(null);
  const activeJobRef = useRef<TranslationJobSnapshot | null>(null);
  const sourceRevisionRef = useRef(0);
  const sourceLoadRef = useRef(0);
  const completedResultCountRef = useRef(0);
  const resultsRef = useRef<HTMLElement | null>(null);
  const editHistoryRef = useRef<TranslationChunk[][]>([]);
  const connectedFromOpenRouterRef = useRef(false);
  const historyEntryRef = useRef<TranslationHistoryEntry | null>(null);
  const historyEnabledRef = useRef(true);

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
    // OAuth keys are held in an encrypted HttpOnly cookie; JavaScript only receives connection status.
    fetch("/api/auth/openrouter/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session: { connected?: boolean; userId?: string }) => {
        setOpenRouterApiKey("");
        setOpenRouterConnection({ connected: Boolean(session.connected), loading: false, userId: session.userId });
      })
      .catch(() => setOpenRouterConnection({ connected: false, loading: false }));
    window.localStorage.removeItem(OPENROUTER_API_KEY_STORAGE);
    window.localStorage.removeItem(OPENROUTER_CONNECTION_STORAGE);
    setOpenRouterModel(normalizeOpenRouterModel(window.localStorage.getItem(OPENROUTER_MODEL_STORAGE)));
    setProvider(normalizeAiProvider(window.localStorage.getItem(PROVIDER_STORAGE)));
  }, []);

  useEffect(() => {
    setHistorySavingEnabled(window.localStorage.getItem(HISTORY_ENABLED_STORAGE) !== "0");
    void listTranslationHistory().then(setHistoryEntries).catch(() => undefined);
  }, []);

  useEffect(() => {
    historyEnabledRef.current = historySavingEnabled;
  }, [historySavingEnabled]);

  useEffect(() => {
    let toastTimer: number | undefined;
    const params = new URLSearchParams(window.location.search);
    const openRouterResult = params.get("openrouter");
    const openRouterError = params.get("openrouter_error");
    connectedFromOpenRouterRef.current = openRouterResult === "connected";
    if (params.get("settings") === "connections") {
      setIsSettingsOpen(true);
    }
    if (openRouterResult === "connected") {
      setProvider("openrouter");
      window.localStorage.setItem(PROVIDER_STORAGE, "openrouter");
      setToastMessage("OpenRouter connected.");
      setToastVisible(true);
      toastTimer = window.setTimeout(() => setToastVisible(false), 2400);
    } else if (openRouterResult === "error") {
      const errorMessages: Record<string, string> = {
        invalid_site_url: "OpenRouter needs a valid HTTPS NEXT_PUBLIC_SITE_URL that matches this site.",
        session_expired: "OpenRouter sign-in expired. Please try connecting again.",
        session_configuration: "This server is running an older OpenRouter sign-in build. Redeploy the current version and try again.",
        key_exchange_unavailable: "OpenRouter could not be reached to complete sign-in. Please try again.",
        key_exchange_rejected: "OpenRouter rejected this sign-in attempt. Start a new connection and authorize it again.",
        key_exchange_failed: "OpenRouter could not complete sign-in. Please start a new connection.",
        session_storage_failed: "OpenRouter connected, but the encrypted session could not be created.",
        storage_failed: "This browser blocked local storage, so the OpenRouter connection could not be saved."
      };
      setToastMessage(errorMessages[openRouterError || ""] || "OpenRouter is not configured correctly on this server.");
      setToastVisible(true);
      toastTimer = window.setTimeout(() => setToastVisible(false), 6000);
    }
    if (openRouterResult || params.has("settings")) {
      params.delete("openrouter");
      params.delete("openrouter_error");
      params.delete("settings");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
    }

    return () => {
      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const connectedFromOpenRouter = connectedFromOpenRouterRef.current;
    loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot || snapshot.version !== 1) {
          return;
        }
        const restoredFormat = snapshot.documentFormat || "pdf";
        const restoredProvider = connectedFromOpenRouter ? "openrouter" : snapshot.provider;
        if (restoredProvider) {
          setProvider(restoredProvider);
          window.localStorage.setItem(PROVIDER_STORAGE, restoredProvider);
        }
        if (snapshot.openRouterModel) {
          const restoredOpenRouterModel = normalizeOpenRouterModel(snapshot.openRouterModel);
          setOpenRouterModel(restoredOpenRouterModel);
          window.localStorage.setItem(OPENROUTER_MODEL_STORAGE, restoredOpenRouterModel);
        }
        setInputMode(snapshot.inputMode === "pdf" ? "document" : snapshot.inputMode);
        setDocumentFormat(restoredFormat);
        setDocumentRangeStart(snapshot.documentRangeStart ?? 1);
        setDocumentRangeEnd(snapshot.documentRangeEnd ?? Math.max(snapshot.pdfTotalPages, 1));
        setPdfName(snapshot.pdfName);
        setPdfFile(snapshot.pdfFile);
        setPdfPages(snapshot.pdfPages);
        setPdfTotalPages(snapshot.pdfTotalPages);
        setPdfScannedMessage(snapshot.pdfScannedMessage);
        if (snapshot.pdfFile && restoredFormat === "pdf") {
          setPdfObjectUrl(URL.createObjectURL(snapshot.pdfFile));
        }
        setImageName(snapshot.imageName);
        setImageDataUrl(snapshot.imageDataUrl);
        setPastedText(snapshot.pastedText);
        setTranslatedChunks(snapshot.translatedChunks);
        setTranslationPages(snapshot.translationPages);
        setDomain(snapshot.domain);
        setGlossaryEntries(snapshot.glossaryEntries);
        setExtractedEntities(snapshot.extractedEntities);
        setUsedModel(snapshot.usedModel);
        setApprovedChunkIds(snapshot.approvedChunkIds);
        const providerChangedOnConnect =
          connectedFromOpenRouter && snapshot.provider !== "openrouter" && snapshot.translatedChunks.length > 0;
        setTranslationStale(providerChangedOnConnect || snapshot.translationStale);
        setCanResume(providerChangedOnConnect ? false : snapshot.canResume);
        setSourcePanelOpen(!snapshot.pdfTotalPages && !snapshot.imageDataUrl && !snapshot.pastedText.trim());
        if (snapshot.translatedChunks.length > 0) {
          setActiveView("english");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setWorkspaceHydrated(true);
        }
      });

    return () => {
      active = false;
    };
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
    if (inputMode === "document") {
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
    if (inputMode === "document") {
      return pdfName || `Uploaded ${DOCUMENT_FORMAT_LABELS[documentFormat]}`;
    }
    if (inputMode === "image") {
      return imageName || "Uploaded image";
    }
    return "Pasted Chinese text";
  }, [documentFormat, inputMode, pdfName, imageName]);
  const pagesWithSelectableText = useMemo(
    () => documentFormat === "pdf" ? pdfPages.filter((page) => hasSelectableTextInPdfPage(page.text)).length : pdfPages.length,
    [documentFormat, pdfPages]
  );
  const ocrPageCount = useMemo(
    () => documentFormat === "pdf" ? pdfPages.filter((page) => !hasSelectableTextInPdfPage(page.text)).length : 0,
    [documentFormat, pdfPages]
  );
  const unavailablePdfPageCount = useMemo(
    () => documentFormat === "pdf" ? Math.max(pdfTotalPages - pdfPages.length, 0) : 0,
    [documentFormat, pdfPages.length, pdfTotalPages]
  );
  const documentFormatLabel = DOCUMENT_FORMAT_LABELS[documentFormat];
  const documentUnitLabel = DOCUMENT_UNIT_LABELS[documentFormat];
  const selectedDocumentPages = useMemo(
    () => pdfPages.filter((page) => page.pageNumber >= documentRangeStart && page.pageNumber <= documentRangeEnd),
    [documentRangeEnd, documentRangeStart, pdfPages]
  );
  const selectedOcrPageCount = useMemo(
    () => documentFormat === "pdf"
      ? selectedDocumentPages.filter((page) => !hasSelectableTextInPdfPage(page.text)).length
      : 0,
    [documentFormat, selectedDocumentPages]
  );
  const hasTranslation = useMemo(
    () => translatedChunks.length > 0 || translationPages.some((page) => page.translatedText.trim()),
    [translatedChunks, translationPages]
  );
  const hasSourceLoaded = useMemo(() => {
    if (inputMode === "document") {
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
    if (inputMode === "document") {
      if (!pdfTotalPages) {
        return {
          title: "No document loaded yet",
          detail: "Upload a Chinese PDF, DOCX, EPUB, or PowerPoint file.",
          helper: "Scanned PDF pages use OCR. Other document formats preserve their reading or slide order."
        };
      }

      if (documentFormat !== "pdf") {
        return {
          title: pdfName || `${documentFormatLabel} ready`,
          detail: `${pdfTotalPages} ${documentUnitLabel}${pdfTotalPages === 1 ? "" : "s"} found · ${pdfPages.length} with readable text`,
          helper: `${documentFormatLabel} text was extracted locally and is ready for translation.`
        };
      }

      return {
        title: pdfName || "PDF ready",
        detail: `${pdfTotalPages} page${pdfTotalPages === 1 ? "" : "s"} loaded · ${pagesWithSelectableText} with selectable text · ${ocrPageCount} needing OCR${unavailablePdfPageCount > 0 ? ` · ${unavailablePdfPageCount} unavailable` : ""}`,
        helper: pdfScannedMessage || (ocrPageCount > 0 ? SCANNED_MESSAGE : "This document appears mostly text-selectable and is ready for translation.")
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
  }, [documentFormat, documentFormatLabel, documentUnitLabel, imageDataUrl, imageName, inputMode, ocrPageCount, pagesWithSelectableText, pastedText, pdfName, pdfPages.length, pdfScannedMessage, pdfTotalPages, sourceChunks.length, unavailablePdfPageCount]);

  const translateDisabled =
    processing ||
    (inputMode === "document" ? selectedDocumentPages.length === 0 : inputMode === "image" ? !imageDataUrl : sourceChunks.length === 0);
  const translateButtonLabel = canResume && !translationStale
    ? "Resume translation"
    : translationStale
      ? "Update translation"
      : inputMode === "document" && documentFormat === "pdf" && selectedOcrPageCount > 0
        ? selectedOcrPageCount === selectedDocumentPages.length
          ? "Translate with OCR"
          : "Translate text + OCR"
        : "Translate to English";
  const usingCustomKey = Boolean(activeUserApiKey.trim());
  const connectionActive = provider === "openrouter" ? openRouterConnection.connected : usingCustomKey;
  const connectionLabel = provider === "openrouter"
    ? openRouterConnection.connected ? "OpenRouter connected" : "OpenRouter"
    : usingCustomKey ? "PPQ personal" : "PPQ shared";
  const canShowPdfSideBySide = inputMode === "document" && documentFormat === "pdf" && Boolean(pdfObjectUrl) && pdfTotalPages > 0;
  const canShowImageSideBySide = inputMode === "image" && Boolean(imageDataUrl) && hasTranslation;
  const showResultsPanel = hasSourceLoaded || hasTranslation || processing;
  const showLivePreview = isStreaming && activeView === "english";
  const readingWidthClass = readingWidth === "wide" ? "max-w-5xl" : "max-w-3xl";
  const preflightSummary = useMemo<TranslationPreflightSummary>(() => {
    if (inputMode === "document") {
      const ocrPages = documentFormat === "pdf"
        ? selectedOcrPageCount
        : 0;
      const sourceCharacters = selectedDocumentPages.reduce((total, page) => total + page.text.length, 0);
      const textRequests = createChunksFromPdfPages(selectedDocumentPages).length;
      const estimatedRequests = Math.max(textRequests + ocrPages * 2, 1);
      return {
        sourceCharacters,
        estimatedRequests,
        estimatedInputTokens: Math.ceil(sourceCharacters * 1.35 + estimatedRequests * 550 + ocrPages * 2_000),
        ocrPages,
        selectedUnits: selectedDocumentPages.length,
        totalUnits: Math.max(pdfTotalPages, 1),
        unitLabel: documentUnitLabel,
        sourceLabel: documentFormatLabel
      };
    }

    if (inputMode === "image") {
      return {
        sourceCharacters: 0,
        estimatedRequests: 2,
        estimatedInputTokens: 4_000,
        ocrPages: 1,
        selectedUnits: 1,
        totalUnits: 1,
        unitLabel: "image",
        sourceLabel: "Image"
      };
    }

    const sourceCharacters = pastedText.length;
    const estimatedRequests = Math.max(sourceChunks.length, 1);
    return {
      sourceCharacters,
      estimatedRequests,
      estimatedInputTokens: Math.ceil(sourceCharacters * 1.35 + estimatedRequests * 550),
      ocrPages: 0,
      selectedUnits: sourceChunks.length,
      totalUnits: Math.max(sourceChunks.length, 1),
      unitLabel: "section",
      sourceLabel: "Pasted text"
    };
  }, [documentFormat, documentFormatLabel, documentUnitLabel, inputMode, pastedText.length, pdfTotalPages, selectedDocumentPages, selectedOcrPageCount, sourceChunks]);

  const requiresLargeFileWarning = useMemo(
    () =>
      preflightSummary.sourceCharacters >= LARGE_SOURCE_CHARACTERS ||
      preflightSummary.estimatedRequests >= LARGE_REQUEST_COUNT ||
      preflightSummary.ocrPages >= LARGE_OCR_PAGE_COUNT ||
      preflightSummary.selectedUnits >= LARGE_UNIT_COUNT ||
      (inputMode === "document" && (pdfFile?.size ?? 0) >= LARGE_FILE_BYTES) ||
      (inputMode === "image" && (imageDataUrl?.length ?? 0) >= 8_000_000),
    [imageDataUrl?.length, inputMode, pdfFile?.size, preflightSummary]
  );

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

  const qualityIssues = useMemo(
    () => inspectTranslationQuality(translatedChunks, lockedGlossary),
    [lockedGlossary, translatedChunks]
  );

  useEffect(() => {
    if (!workspaceHydrated) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveWorkspaceSnapshot({
        version: 1,
        savedAt: Date.now(),
        provider,
        openRouterModel,
        inputMode,
        documentFormat,
        documentRangeStart,
        documentRangeEnd,
        pdfName,
        pdfFile,
        pdfPages,
        pdfTotalPages,
        pdfScannedMessage,
        imageName,
        imageDataUrl,
        pastedText,
        translatedChunks,
        translationPages,
        domain,
        glossaryEntries,
        extractedEntities,
        usedModel,
        approvedChunkIds,
        translationStale,
        canResume
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    approvedChunkIds,
    canResume,
    domain,
    documentFormat,
    documentRangeEnd,
    documentRangeStart,
    extractedEntities,
    glossaryEntries,
    imageDataUrl,
    imageName,
    inputMode,
    openRouterModel,
    pastedText,
    pdfFile,
    pdfName,
    pdfPages,
    pdfScannedMessage,
    pdfTotalPages,
    provider,
    translatedChunks,
    translationPages,
    translationStale,
    usedModel,
    workspaceHydrated
  ]);

  useEffect(() => {
    if (processing && typeof window !== "undefined" && window.innerWidth < 1280) {
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  }, [processing]);

  const markTranslationStale = () => {
    sourceRevisionRef.current += 1;
    if (activeJobRef.current && activeJobRef.current.sourceRevision !== sourceRevisionRef.current) {
      abortControllerRef.current?.abort();
    }
    if (hasTranslation) {
      setTranslationStale(true);
      setCanResume(false);
      setApprovedChunkIds([]);
    }
  };

  const handleInputModeChange = (mode: InputMode) => {
    if (processing || mode === inputMode) {
      return;
    }
    markTranslationStale();
    setInputMode(mode);
    setTranslatedChunks([]);
    setTranslationPages([]);
    setApprovedChunkIds([]);
    setTranslationStale(false);
    setCanResume(false);
    setErrorMessage("");
    setSourcePanelOpen(true);
    setActiveView("original");
    setReviewMode(false);
  };

  const handlePastedTextChange = (value: string) => {
    if (processing) return;
    setPastedText(value);
    markTranslationStale();
  };

  const handleDomainChange = (value: TranslationDomain) => {
    if (processing) return;
    setDomain(value);
    markTranslationStale();
  };

  const handleGlossaryEntriesChange = (entries: GlossaryEntry[]) => {
    if (processing) return;
    setGlossaryEntries(entries);
    markTranslationStale();
  };

  const handleDocumentRangeChange = (start: number, end: number) => {
    if (processing) return;
    const normalizedStart = Math.max(1, Math.min(start, Math.max(pdfTotalPages, 1)));
    const normalizedEnd = Math.max(normalizedStart, Math.min(end, Math.max(pdfTotalPages, 1)));
    if (normalizedStart === documentRangeStart && normalizedEnd === documentRangeEnd) {
      return;
    }
    setDocumentRangeStart(normalizedStart);
    setDocumentRangeEnd(normalizedEnd);
    markTranslationStale();
  };

  const commitTranslationEdit = (chunkId: string, translatedEnglish: string) => {
    const sourceChunk = translatedChunks.find((chunk) => chunk.id === chunkId);
    if (sourceChunk && translatedEnglish.trim()) {
      void rememberTranslation(sourceChunk.originalChinese, translatedEnglish, domain, lockedGlossary).catch(() => undefined);
    }
    editHistoryRef.current.push(translatedChunks);
    const nextChunks = translatedChunks.map((chunk) =>
      chunk.id === chunkId
        ? {
            ...chunk,
            translatedEnglish,
            qa: buildSegmentQaReport(chunk, translatedEnglish, lockedGlossary),
            translationMemoryHit: false
          }
        : chunk
    );
    setTranslatedChunks(nextChunks);
    setTranslationPages((pages) =>
      pages.map((page) => {
        const nextPageChunks = page.chunks.map((chunk) =>
          chunk.id === chunkId
            ? {
                ...chunk,
                translatedEnglish,
                qa: buildSegmentQaReport(chunk, translatedEnglish, lockedGlossary),
                translationMemoryHit: false
              }
            : chunk
        );
        return {
          ...page,
          chunks: nextPageChunks,
          translatedText: normalizeTranslationFootnotes(joinEnglishTranslation(nextPageChunks))
        };
      })
    );
    setApprovedChunkIds((ids) => ids.filter((id) => id !== chunkId));
    if (historyEntryRef.current && !translationStale) {
      const nextEntry: TranslationHistoryEntry = {
        ...historyEntryRef.current,
        savedAt: Date.now(),
        chunks: toHistoryChunks(nextChunks),
        approvedChunkIds: approvedChunkIds.filter((id) => id !== chunkId)
      };
      historyEntryRef.current = nextEntry;
      void saveTranslationHistoryEntry(nextEntry).then(refreshHistory).catch(() => undefined);
    }
  };

  const updateReviewNote = (chunkId: string, reviewNote: string) => {
    setTranslatedChunks((chunks) => chunks.map((chunk) => chunk.id === chunkId ? { ...chunk, reviewNote } : chunk));
    setTranslationPages((pages) => pages.map((page) => ({
      ...page,
      chunks: page.chunks.map((chunk) => chunk.id === chunkId ? { ...chunk, reviewNote } : chunk)
    })));
  };

  const retranslateChunk = async (chunkId: string) => {
    const chunk = translatedChunks.find((entry) => entry.id === chunkId);
    if (!chunk || processing || activeJobRef.current) return;
    const job = createTranslationJob({
      sourceRevision: sourceRevisionRef.current,
      provider,
      model: provider === "openrouter" ? openRouterModel : undefined,
      userPpqApiKey: provider === "ppq" ? activeUserApiKey || undefined : undefined,
      userOpenRouterApiKey: provider === "openrouter" ? openRouterApiKey || undefined : undefined,
      domain,
      glossary: lockedGlossary,
      chunks: [chunk]
    });
    const controller = new AbortController();
    activeJobRef.current = job;
    abortControllerRef.current = controller;
    setErrorMessage("");
    try {
      const result = await translateChunkWithMemory(chunk, "", job, true);
      assertCurrentTranslationJob(activeJobRef.current?.id, job.id, controller.signal);
      const updated = {
        ...chunk,
        translatedEnglish: result.text,
        qa: result.qa ?? buildSegmentQaReport(chunk, result.text, lockedGlossary),
        translationMemoryHit: false
      };
      editHistoryRef.current.push(translatedChunks);
      setTranslatedChunks((chunks) => chunks.map((entry) => entry.id === chunkId ? updated : entry));
      setTranslationPages((pages) => pages.map((page) => {
        const chunks = page.chunks.map((entry) => entry.id === chunkId ? updated : entry);
        return { ...page, chunks, translatedText: normalizeTranslationFootnotes(joinEnglishTranslation(chunks)) };
      }));
      setApprovedChunkIds((ids) => ids.filter((id) => id !== chunkId));
      if (result.model) setUsedModel(result.model);
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(error instanceof Error ? error.message : "Retranslation failed.");
    } finally {
      if (activeJobRef.current?.id === job.id) activeJobRef.current = null;
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setLiveText("");
    }
  };

  const undoTranslationEdit = () => {
    const previous = editHistoryRef.current.pop();
    if (!previous) {
      return;
    }
    setTranslatedChunks(previous);
    setTranslationPages((pages) =>
      pages.map((page) => {
        const previousById = new Map(previous.map((chunk) => [chunk.id, chunk]));
        const nextPageChunks = page.chunks.map((chunk) => previousById.get(chunk.id) ?? chunk);
        return {
          ...page,
          chunks: nextPageChunks,
          translatedText: normalizeTranslationFootnotes(joinEnglishTranslation(nextPageChunks))
        };
      })
    );
  };

  const toggleChunkApproved = (chunkId: string) => {
    const nextIds = approvedChunkIds.includes(chunkId)
      ? approvedChunkIds.filter((id) => id !== chunkId)
      : [...approvedChunkIds, chunkId];
    setApprovedChunkIds(nextIds);
    if (historyEntryRef.current && !translationStale) {
      const nextEntry: TranslationHistoryEntry = {
        ...historyEntryRef.current,
        savedAt: Date.now(),
        approvedChunkIds: nextIds
      };
      historyEntryRef.current = nextEntry;
      void saveTranslationHistoryEntry(nextEntry).then(refreshHistory).catch(() => undefined);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  };

  const refreshHistory = () => {
    void listTranslationHistory().then(setHistoryEntries).catch(() => undefined);
  };

  const handleHistoryEnabledChange = (enabled: boolean) => {
    setHistorySavingEnabled(enabled);
    window.localStorage.setItem(HISTORY_ENABLED_STORAGE, enabled ? "1" : "0");
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
    setDocumentFormat("pdf");
    setDocumentRangeStart(1);
    setDocumentRangeEnd(1);
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
    if (processing) return;
    const loadId = ++sourceLoadRef.current;
    entityAbortControllerRef.current?.abort();
    markTranslationStale();
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

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "ppt") {
      setErrorMessage("Legacy .ppt files are not supported. Save the presentation as .pptx and upload it again.");
      resetPdfState();
      return;
    }

    const format = getDocumentFormat(file);
    if (!format) {
      setErrorMessage("Please upload a PDF, DOCX, EPUB, or PowerPoint (.pptx) file.");
      resetPdfState();
      return;
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      setErrorMessage("Documents must be 50 MB or smaller.");
      resetPdfState();
      return;
    }

    setInputMode("document");
    setDocumentFormat(format);
    setActiveView("original");
    resetImageState();
    setPdfName(file.name);
    setPdfFile(file);
    replacePdfUrl(format === "pdf" ? URL.createObjectURL(file) : undefined);
    setProgressStep("extracting");
    setStatusMessage(`Extracting ${DOCUMENT_FORMAT_LABELS[format]} text...`);

    let result = format === "pdf"
      ? await extractSelectableTextFromPdf(file)
      : await extractStructuredDocument(file, format);

    if (format === "pdf" && result.kind === "error") {
      setStatusMessage("Text extraction failed. Checking PDF pages for OCR fallback...");
      result = await preparePdfOcrFallback(
        file,
        result.message,
        MAX_DOCUMENT_UNITS,
        (completedPages, totalPages) => {
          if (loadId === sourceLoadRef.current) {
            setStatusMessage(
              completedPages === 0
                ? `Checking ${totalPages} pages for OCR fallback...`
                : `Checking page ${completedPages} of ${totalPages} for OCR fallback...`
            );
          }
        }
      );
    }

    if (loadId !== sourceLoadRef.current) return;

    if (result.kind === "error") {
      setPdfPages([]);
      setPdfTotalPages(0);
      setStatusMessage("");
      setProgressStep("idle");
      setErrorMessage(result.message);
      return;
    }

    if (result.totalPages > MAX_DOCUMENT_UNITS) {
      resetPdfState();
      setStatusMessage("");
      setProgressStep("idle");
      setErrorMessage(`Documents are limited to ${MAX_DOCUMENT_UNITS} pages, chapters, sections, or slides per workspace.`);
      return;
    }

    setPdfPages(result.pages);
    setPdfTotalPages(result.totalPages);
    setDocumentRangeStart(1);
    setDocumentRangeEnd(Math.max(result.totalPages, 1));
    setStatusMessage("");
    setProgressStep("idle");
    setApprovedChunkIds([]);
    setTranslationStale(false);
    setCanResume(false);
    setSourcePanelOpen(false);

    const containsOcrPages = format === "pdf" && result.pages.some((page) => !hasSelectableTextInPdfPage(page.text));
    if (result.kind === "scanned" || containsOcrPages) {
      setPdfScannedMessage(result.kind === "scanned" ? result.message : SCANNED_MESSAGE);
    }

    if (result.kind === "scanned") {
      return;
    }

    // Extract entities from the full text.
    const fullText = result.pages.map((p) => p.text).join("\n\n");
    const heuristics = extractEntitiesHeuristic(fullText);
    setExtractedEntities(heuristics);

  };

  const handleImageSelect = async (file: File | null) => {
    if (processing) return;
    const loadId = ++sourceLoadRef.current;
    entityAbortControllerRef.current?.abort();
    markTranslationStale();
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

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage("Images must be 15 MB or smaller.");
      resetImageState();
      return;
    }

    setInputMode("image");
    setActiveView("original");
    resetPdfState();
    setImageName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      if (loadId !== sourceLoadRef.current) return;
      setImageDataUrl(dataUrl);
      setApprovedChunkIds([]);
      setTranslationStale(false);
      setCanResume(false);
      setSourcePanelOpen(false);
    } catch {
      setErrorMessage("Unable to load this image.");
      resetImageState();
    }
  };

  /** Loads dropped/pasted plain text as the current source. Returns false for empty text. */
  const applyDroppedText = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }
    entityAbortControllerRef.current?.abort();
    markTranslationStale();
    setErrorMessage("");
    setTranslatedChunks([]);
    setTranslationPages([]);
    setExtractedEntities([]);
    resetPdfState();
    resetImageState();
    setInputMode("text");
    setPastedText(trimmed);
    setActiveView("original");
    setApprovedChunkIds([]);
    setTranslationStale(false);
    setCanResume(false);
    setSourcePanelOpen(false);
    return true;
  };

  const handleDroppedText = (text: string) => {
    if (processing || !text.trim()) {
      return;
    }
    sourceLoadRef.current += 1;
    applyDroppedText(text);
  };

  const handleDroppedTextFile = async (file: File) => {
    if (file.size > MAX_DOCUMENT_BYTES) {
      setErrorMessage("Text files must be 50 MB or smaller.");
      return;
    }
    const loadId = ++sourceLoadRef.current;
    try {
      const text = await file.text();
      if (loadId !== sourceLoadRef.current) {
        return;
      }
      if (!applyDroppedText(text)) {
        setErrorMessage("This text file is empty.");
      }
    } catch {
      if (loadId === sourceLoadRef.current) {
        setErrorMessage("Unable to read this text file.");
      }
    }
  };

  /** Routes any dropped file to the right input mode, regardless of the active tab. */
  const handleDroppedFile = async (file: File) => {
    if (processing) {
      return;
    }
    if (file.type.startsWith("image/")) {
      await handleImageSelect(file);
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (file.type === "text/plain" || extension === "txt" || extension === "md" || extension === "markdown") {
      await handleDroppedTextFile(file);
      return;
    }
    await handleFileSelect(file);
  };

  const handleSaveApiKey = () => {
    if (processing) return;
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

  const handleProviderChange = (nextProvider: AiProviderId) => {
    if (processing || nextProvider === provider) {
      return;
    }
    setProvider(nextProvider);
    window.localStorage.setItem(PROVIDER_STORAGE, nextProvider);
    setErrorMessage("");
    markTranslationStale();
  };

  const handleOpenRouterModelChange = (nextModel: string) => {
    const normalizedModel = normalizeOpenRouterModel(nextModel);
    if (processing || normalizedModel === openRouterModel) {
      return;
    }
    setOpenRouterModel(normalizedModel);
    window.localStorage.setItem(OPENROUTER_MODEL_STORAGE, normalizedModel);
    setErrorMessage("");
    markTranslationStale();
  };

  const handleDisconnectOpenRouter = async () => {
    if (processing) return;
    await fetch("/api/auth/openrouter/session", { method: "DELETE" }).catch(() => undefined);
    setOpenRouterApiKey("");
    setOpenRouterConnection({ connected: false, loading: false });
    if (provider === "openrouter") {
      setProvider("ppq");
      window.localStorage.setItem(PROVIDER_STORAGE, "ppq");
      markTranslationStale();
    }
    showToast("OpenRouter disconnected.");
  };

  const fetchEntityTranslations = async (text: string, revision: number) => {
    entityAbortControllerRef.current?.abort();
    const controller = new AbortController();
    entityAbortControllerRef.current = controller;
    setAnalyzingTerms(true);
    try {
      const response = await fetch("/api/extract-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          domain,
          provider,
          model: provider === "openrouter" ? openRouterModel : undefined,
          userPpqApiKey: provider === "ppq" ? activeUserApiKey || undefined : undefined,
          userOpenRouterApiKey: provider === "openrouter" ? openRouterApiKey || undefined : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Term analysis failed.");
      }
      if (revision !== sourceRevisionRef.current) {
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
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(error instanceof Error ? error.message : "Term analysis failed.");
      }
    } finally {
      if (entityAbortControllerRef.current === controller) {
        entityAbortControllerRef.current = null;
        setAnalyzingTerms(false);
      }
    }
  };

  const handleAnalyzeTerms = () => {
    if (processing || analyzingTerms || inputMode === "image") return;
    const text = inputMode === "document"
      ? selectedDocumentPages.map((page) => page.text).join("\n\n")
      : pastedText;
    if (!text.trim()) return;
    const heuristics = extractEntitiesHeuristic(text);
    setExtractedEntities(heuristics);
    void fetchEntityTranslations(text, sourceRevisionRef.current);
  };

  const streamChunkWithRetry = (chunk: TranslationChunk, rollingContext: string, job: TranslationJobSnapshot) =>
    withSmartRetry(
      async (_attempt, temperature) => {
        assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
        setLiveText("");
        return streamTranslation(
          {
            chunk,
            provider: job.provider,
            model: job.model,
            userPpqApiKey: job.userPpqApiKey,
            userOpenRouterApiKey: job.userOpenRouterApiKey,
            domain: job.domain,
            previousSummary: rollingContext || undefined,
            glossary: { ...job.glossary },
            temperature
          },
          {
            onDelta: (delta) => {
              if (activeJobRef.current?.id === job.id) setLiveText((prev) => prev + delta);
            },
            signal: abortControllerRef.current?.signal
          }
        );
      },
      { maxRetries: 2 }
    );

  const translateChunkWithMemory = async (
    chunk: TranslationChunk,
    rollingContext: string,
    job: TranslationJobSnapshot,
    forceModel = false
  ) => {
    assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
    if (!forceModel) {
      const memory = await findTranslationMemory(chunk.originalChinese, job.domain, { ...job.glossary }).catch(() => undefined);
      assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
      if (memory) {
        return {
          text: memory,
          model: "",
          qa: buildSegmentQaReport(chunk, memory, { ...job.glossary }),
          translationMemoryHit: true
        };
      }
    }
    const result = await streamChunkWithRetry(chunk, rollingContext, job);
    assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
    await rememberTranslation(chunk.originalChinese, result.text, job.domain, { ...job.glossary }).catch(() => undefined);
    return { ...result, translationMemoryHit: false };
  };

  const transcribeImageWithRetry = (imageTask: { id: string; pageNumber: number; imageDataUrl: string }, job: TranslationJobSnapshot) =>
    withSmartRetry(
      async (attempt) => {
        assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
        setLiveText("");
        return streamTranslation(
          {
            imageTask: { ...imageTask, mode: "ocr" },
            provider: job.provider,
            model: job.model,
            userPpqApiKey: job.userPpqApiKey,
            userOpenRouterApiKey: job.userOpenRouterApiKey,
            temperature: Math.min(0.1, attempt * 0.05)
          },
          {
            onDelta: (delta) => {
              if (activeJobRef.current?.id === job.id) setLiveText((prev) => prev + delta);
            },
            signal: abortControllerRef.current?.signal
          }
        );
      },
      { maxRetries: 2, validateEnglish: false }
    );

  const handleTranslateDocumentByUnit = async (resume: boolean, job: TranslationJobSnapshot) => {
    const pagesToTranslate = job.pages;
    const completedChunks: TranslationChunk[] = resume ? translatedChunks.filter((chunk) => chunk.translatedEnglish.trim()) : [];
    const completedPages: TranslationPage[] = resume
      ? translationPages.filter((page) => page.translatedText.trim())
      : [];
    const savedOcrText = new Map(
      translationPages
        .filter((page) => page.originalText.trim() && page.originalText !== "[Image-based source text]")
        .map((page) => [page.pageNumber, page.originalText])
    );
    const completedPageNumbers = new Set(completedPages.map((page) => page.pageNumber));
    const skippedOcrPageNumbers: number[] = [];
    const lastCompletedChunk = completedChunks[completedChunks.length - 1];
    let rollingContext = lastCompletedChunk
      ? makeRollingContext(lastCompletedChunk.originalChinese, lastCompletedChunk.translatedEnglish)
      : "";
    const pagesNeedingOcr = documentFormat === "pdf" ? pagesToTranslate
      .filter((page) => !hasSelectableTextInPdfPage(page.text) && !completedPageNumbers.has(page.pageNumber))
      .map((page) => page.pageNumber) : [];

    setTotalUnits(pagesToTranslate.length);
    setCompletedUnits(completedPages.length);

    let lastModel = "";
    let ocrImageMap = new Map<number, string>();
    if (pagesNeedingOcr.length > 0) {
      if (!pdfFile) {
        throw new Error("Original PDF file is unavailable for OCR translation.");
      }
      setStatusMessage("Preparing OCR images from PDF pages...");
      ocrImageMap = await renderPdfPagesToJpegDataUrls(pdfFile, pagesNeedingOcr);
      assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current?.signal);
    }

    for (let index = 0; index < pagesToTranslate.length; index += 1) {
      const page = pagesToTranslate[index];
      if (completedPageNumbers.has(page.pageNumber)) {
        continue;
      }
      const pageChunks = createChunksFromSinglePdfPage(page);
      const isOcrPage = documentFormat === "pdf" && pageChunks.length === 0;
      const unitPosition = `${documentUnitLabel} ${page.pageNumber} of ${pdfTotalPages}`;

      setStatusMessage(
        `${isOcrPage ? "Running OCR on" : "Translating"} ${unitPosition}...`
      );
      setLiveText("");
      setIsStreaming(true);

      if (isOcrPage) {
        let ocrText = savedOcrText.get(page.pageNumber) || "";
        if (!ocrText) {
          const imageDataUrl = ocrImageMap.get(page.pageNumber);
          if (!imageDataUrl) {
            skippedOcrPageNumbers.push(page.pageNumber);
            setCompletedUnits(completedPages.length + skippedOcrPageNumbers.length);
            continue;
          }
          setStatusMessage(`Transcribing ${unitPosition}...`);
          const ocrResult = await transcribeImageWithRetry({
            id: `pdf-ocr-p${page.pageNumber}`,
            pageNumber: page.pageNumber,
            imageDataUrl
          }, job);
          ocrText = ocrResult.text.trim();
          if (!ocrText) {
            throw new Error(`Page ${page.pageNumber} has no readable text — it may be blank or too faint for OCR.`);
          }
          savedOcrText.set(page.pageNumber, ocrText);
          setTranslationPages((pages) => [
            ...pages.filter((entry) => entry.pageNumber !== page.pageNumber),
            { pageNumber: page.pageNumber, originalText: ocrText, translatedText: "", chunks: [] }
          ].sort((left, right) => left.pageNumber - right.pageNumber));
        }

        setStatusMessage(`Translating ${unitPosition}...`);
        const sourceChunk: TranslationChunk = {
          id: `pdf-ocr-p${page.pageNumber}`,
          pageNumber: page.pageNumber,
          originalChinese: ocrText,
          translatedEnglish: ""
        };
        const { text, model, qa, translationMemoryHit } = await translateChunkWithMemory(sourceChunk, rollingContext, job);

        if (!text.trim()) {
          throw new Error(`The translator returned nothing for page ${page.pageNumber}. Resume to retry it.`);
        }

        const ocrChunk: TranslationChunk = {
          id: `pdf-ocr-p${page.pageNumber}`,
          pageNumber: page.pageNumber,
          originalChinese: ocrText,
          translatedEnglish: text,
          qa,
          translationMemoryHit
        };
        const pageResult: TranslationPage = {
          pageNumber: page.pageNumber,
          originalText: ocrText,
          translatedText: text,
          chunks: [ocrChunk]
        };

        completedPages.push(pageResult);
        completedChunks.push(ocrChunk);
        setTranslationPages([...completedPages]);
        setTranslatedChunks([...completedChunks]);
        if (model) setUsedModel(model);
        if (model) lastModel = model;
        setCompletedUnits(completedPages.length);
        completedResultCountRef.current = completedChunks.length;
        rollingContext = makeRollingContext(ocrText, text);
        continue;
      }

      // Selectable-text page: translate each chunk, streaming the active chunk.
      const translatedPageChunks: TranslationChunk[] = [];
      let pageModel = "";

      for (const pageChunk of pageChunks) {
        const { text, model, qa, translationMemoryHit } = await translateChunkWithMemory(pageChunk, rollingContext, job);

        if (!text.trim()) {
          throw new Error(`The translator returned nothing for page ${page.pageNumber}. Resume to retry it.`);
        }

        translatedPageChunks.push({ ...pageChunk, translatedEnglish: text, qa, translationMemoryHit });
        if (model) pageModel = model;
        rollingContext = makeRollingContext(pageChunk.originalChinese, text);
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
      if (pageModel) lastModel = pageModel;
      setCompletedUnits(completedPages.length);
      completedResultCountRef.current = completedChunks.length;
    }

    setIsStreaming(false);
    setLiveText("");
    return { skippedPages: skippedOcrPageNumbers, chunks: completedChunks, model: lastModel };
  };

  const handleTranslateImage = async (resume: boolean, job: TranslationJobSnapshot) => {
    if (!job.imageDataUrl) {
      throw new Error("Upload an image to begin translation.");
    }

    setTotalUnits(1);
    setCompletedUnits(resume && translatedChunks[0]?.translatedEnglish.trim() ? 1 : 0);
    setStatusMessage("Transcribing image...");
    setLiveText("");
    setIsStreaming(true);

    let ocrText = translationPages[0]?.originalText || "";
    if (!ocrText || ocrText === "[Image-based source text]") {
      const ocrResult = await transcribeImageWithRetry({ id: "image-ocr-1", pageNumber: 1, imageDataUrl: job.imageDataUrl }, job);
      ocrText = ocrResult.text.trim();
      if (!ocrText) {
        throw new Error("No readable text was found in this image — try a sharper or higher-contrast photo.");
      }
      setTranslationPages([{ pageNumber: 1, originalText: ocrText, translatedText: "", chunks: [] }]);
    }

    setStatusMessage("Translating image text...");
    const sourceChunk: TranslationChunk = {
      id: "image-ocr-1",
      pageNumber: 1,
      originalChinese: ocrText,
      translatedEnglish: ""
    };
    const { text, model, qa, translationMemoryHit } = await translateChunkWithMemory(sourceChunk, "", job);

    if (!text.trim()) {
      throw new Error("The translator returned nothing for this image. Please try again.");
    }

    const normalizedChunk: TranslationChunk = {
      id: "image-ocr-1",
      pageNumber: 1,
      originalChinese: ocrText,
      translatedEnglish: text,
      qa,
      translationMemoryHit
    };
    setTranslatedChunks([normalizedChunk]);
    setTranslationPages([
      {
        pageNumber: 1,
        originalText: ocrText,
        translatedText: text,
        chunks: [normalizedChunk]
      }
    ]);
    if (model) setUsedModel(model);
    setCompletedUnits(1);
    completedResultCountRef.current = 1;
    setIsStreaming(false);
    setLiveText("");
    return { chunks: [normalizedChunk], model };
  };

  const runTranslation = async () => {
    const resume = canResume && !translationStale;
    setErrorMessage("");

    if (inputMode === "document" && pdfTotalPages === 0) {
      setErrorMessage("Upload a document to begin.");
      return;
    }
    if (inputMode === "document" && selectedDocumentPages.length === 0) {
      setErrorMessage(`The selected ${documentUnitLabel} range has no readable content.`);
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

    const jobChunks = inputMode === "document"
      ? createChunksFromPdfPages(selectedDocumentPages)
      : inputMode === "text"
        ? sourceChunks
        : [];
    const job = createTranslationJob({
      sourceRevision: sourceRevisionRef.current,
      provider,
      model: provider === "openrouter" ? openRouterModel : undefined,
      userPpqApiKey: provider === "ppq" ? activeUserApiKey || undefined : undefined,
      userOpenRouterApiKey: provider === "openrouter" ? openRouterApiKey || undefined : undefined,
      domain,
      glossary: lockedGlossary,
      chunks: jobChunks,
      pages: inputMode === "document" ? selectedDocumentPages : [],
      imageDataUrl: inputMode === "image" ? imageDataUrl : undefined
    });
    activeJobRef.current = job;

    setProcessing(true);
    setIsSettingsOpen(false);
    setIsGlossaryOpen(false);
    setIsPreflightOpen(false);
    setCanResume(false);
    if (!resume) {
      setTranslatedChunks([]);
      setTranslationPages([]);
      setApprovedChunkIds([]);
      editHistoryRef.current = [];
    }
    setLiveText("");
    setIsStreaming(false);
    setCompletedUnits(0);
    setTotalUnits(0);
    setActiveView("english");
    setProgressStep("preparing");
    setStatusMessage("Preparing chunks & glossary...");
    abortControllerRef.current = new AbortController();
    completedResultCountRef.current = resume ? translatedChunks.filter((chunk) => chunk.translatedEnglish.trim()).length : 0;

    await new Promise((resolve) => setTimeout(resolve, 120));

    try {
      assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current.signal);
      setProgressStep("translating");
      let skippedPdfPages: number[] = [];
      let archiveChunks: TranslationChunk[] = [];
      let archiveModel = "";

      if (inputMode === "document") {
        const documentResult = await handleTranslateDocumentByUnit(resume, job);
        skippedPdfPages = documentResult.skippedPages;
        archiveChunks = documentResult.chunks;
        archiveModel = documentResult.model;
      } else if (inputMode === "image") {
        const imageResult = await handleTranslateImage(resume, job);
        archiveChunks = imageResult.chunks;
        archiveModel = imageResult.model;
      } else {
        const completedById = new Map(
          (resume ? translatedChunks : [])
            .filter((chunk) => chunk.translatedEnglish.trim())
            .map((chunk) => [chunk.id, chunk])
        );
        const completedChunks = job.chunks
          .map((chunk) => completedById.get(chunk.id))
          .filter((chunk): chunk is TranslationChunk => Boolean(chunk));
        const lastCompletedChunk = completedChunks[completedChunks.length - 1];
        let rollingContext = lastCompletedChunk
          ? makeRollingContext(lastCompletedChunk.originalChinese, lastCompletedChunk.translatedEnglish)
          : "";
        setTotalUnits(job.chunks.length);
        setCompletedUnits(completedChunks.length);
        let lastModel = "";

        for (let index = 0; index < job.chunks.length; index += 1) {
          const chunk = job.chunks[index];
          if (completedById.has(chunk.id)) {
            continue;
          }
          setStatusMessage(`Translating section ${index + 1} of ${job.chunks.length}...`);
          setLiveText("");
          setIsStreaming(true);

          const { text, model, qa, translationMemoryHit } = await translateChunkWithMemory(chunk, rollingContext, job);

          if (!text.trim()) {
            throw new Error("The translator returned nothing. Please try again.");
          }

          completedById.set(chunk.id, { ...chunk, translatedEnglish: text, qa, translationMemoryHit });
          const nextCompleted = job.chunks
            .map((sourceChunk) => completedById.get(sourceChunk.id))
            .filter((entry): entry is TranslationChunk => Boolean(entry));
          setTranslatedChunks(nextCompleted);
          if (model) {
            setUsedModel(model);
            lastModel = model;
          }
          setCompletedUnits(nextCompleted.length);
          completedResultCountRef.current = nextCompleted.length;
          rollingContext = makeRollingContext(chunk.originalChinese, text);
        }

        archiveChunks = job.chunks
          .map((chunk) => completedById.get(chunk.id))
          .filter((chunk): chunk is TranslationChunk => Boolean(chunk));
        archiveModel = lastModel;

        setIsStreaming(false);
        setLiveText("");
      }

      setProgressStep("generating");
      setStatusMessage("Generating output...");

      await new Promise((resolve) => setTimeout(resolve, 280));
      assertCurrentTranslationJob(activeJobRef.current?.id, job.id, abortControllerRef.current.signal);

      setActiveView("english");
      setReviewMode(false);
      setTranslationStale(false);
      setCanResume(false);
      setProgressStep("done");
      if (historyEnabledRef.current && archiveChunks.length > 0) {
        const entry: TranslationHistoryEntry = {
          id: makeHistoryEntryId(sourceLabel, archiveChunks),
          savedAt: Date.now(),
          sourceLabel,
          inputMode,
          documentFormat: inputMode === "document" ? documentFormat : undefined,
          domain,
          usedModel: archiveModel || usedModel,
          sourceCharacters: archiveChunks.reduce((total, chunk) => total + chunk.originalChinese.length, 0),
          unitCount: new Set(archiveChunks.map((chunk) => chunk.pageNumber)).size,
          unitLabel: inputMode === "document" ? documentUnitLabel : inputMode === "image" ? "image" : "section",
          chunks: toHistoryChunks(archiveChunks),
          approvedChunkIds: resume ? approvedChunkIds : []
        };
        historyEntryRef.current = entry;
        void saveTranslationHistoryEntry(entry).then(refreshHistory).catch(() => undefined);
      }
      if (skippedPdfPages.length > 0) {
        const skippedLabel = `${skippedPdfPages.length} page${skippedPdfPages.length === 1 ? "" : "s"}`;
        setErrorMessage(`Translation completed for the readable pages, but ${skippedLabel} could not be rendered and was skipped.`);
        setStatusMessage(`Translation complete with ${skippedLabel} skipped.`);
      } else {
        setStatusMessage("Translation complete.");
      }
      setTimeout(() => {
        if (!activeJobRef.current) {
          setStatusMessage("");
          setProgressStep("idle");
        }
      }, 1200);
    } catch (error) {
      if (activeJobRef.current?.id !== job.id) return;
      setStatusMessage("");
      setProgressStep("idle");
      const cancelled = abortControllerRef.current?.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      setErrorMessage(cancelled ? "Translation paused. Resume when you are ready." : error instanceof Error ? error.message : "Translation failed.");
      setCanResume(Boolean(cancelled || completedResultCountRef.current > 0));
    } finally {
      if (activeJobRef.current?.id === job.id) {
        setProcessing(false);
        setIsStreaming(false);
        setLiveText("");
        abortControllerRef.current = null;
        activeJobRef.current = null;
      }
    }
  };

  const handleTranslate = () => {
    if (canResume && !translationStale) {
      void runTranslation();
      return;
    }
    if (requiresLargeFileWarning) {
      setErrorMessage("");
      setIsPreflightOpen(true);
      return;
    }
    void runTranslation();
  };

  /** Latest values for window-level listeners, so they never go stale or re-subscribe. */
  const globalActionRef = useRef({ processing, translateDisabled, handleImageSelect, handleDroppedText, handleTranslate });
  useEffect(() => {
    globalActionRef.current = { processing, translateDisabled, handleImageSelect, handleDroppedText, handleTranslate };
  });

  // Paste-anywhere (text or screenshots) and Cmd/Ctrl+Enter to translate.
  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const actions = globalActionRef.current;
      if (actions.processing) {
        return;
      }
      const clipboard = event.clipboardData;
      if (!clipboard) {
        return;
      }
      const imageFile = Array.from(clipboard.files).find((file) => file.type.startsWith("image/"));
      if (imageFile) {
        event.preventDefault();
        void actions.handleImageSelect(imageFile);
        return;
      }
      const text = clipboard.getData("text/plain");
      if (text.trim()) {
        event.preventDefault();
        actions.handleDroppedText(text);
      }
    };

    const handleWindowKeydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
      }
      const actions = globalActionRef.current;
      if (actions.processing || actions.translateDisabled) {
        return;
      }
      event.preventDefault();
      actions.handleTranslate();
    };

    window.addEventListener("paste", handleWindowPaste);
    window.addEventListener("keydown", handleWindowKeydown);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
      window.removeEventListener("keydown", handleWindowKeydown);
    };
  }, []);

  const handleCancelTranslation = () => {
    setStatusMessage("Pausing translation...");
    abortControllerRef.current?.abort();
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    entityAbortControllerRef.current?.abort();
    sourceLoadRef.current += 1;
    sourceRevisionRef.current += 1;
    activeJobRef.current = null;
    setIsPreflightOpen(false);
    setInputMode("document");
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
    setGlossaryEntries([]);
    setApprovedChunkIds([]);
    setTranslationStale(false);
    setCanResume(false);
    setReviewMode(false);
    setSourcePanelOpen(true);
    setActiveView("original");
    editHistoryRef.current = [];
    historyEntryRef.current = null;
    clearWorkspaceSnapshot().catch(() => undefined);
  };

  const handleRestoreHistoryEntry = (entry: TranslationHistoryEntry) => {
    if (processing) {
      return;
    }
    entityAbortControllerRef.current?.abort();
    sourceLoadRef.current += 1;
    sourceRevisionRef.current += 1;
    setErrorMessage("");
    setStatusMessage("");
    setProgressStep("idle");
    setExtractedEntities([]);

    // Rebuild pages and fresh QA reports from the stored chunks.
    const restoredChunks = entry.chunks.map((chunk) => ({
      ...chunk,
      qa: buildSegmentQaReport(chunk, chunk.translatedEnglish, lockedGlossary),
      translationMemoryHit: Boolean(chunk.translationMemoryHit)
    }));
    const chunksByPage = new Map<number, TranslationChunk[]>();
    for (const chunk of restoredChunks) {
      const pageChunks = chunksByPage.get(chunk.pageNumber) ?? [];
      pageChunks.push(chunk);
      chunksByPage.set(chunk.pageNumber, pageChunks);
    }
    const restoredPages: TranslationPage[] = Array.from(chunksByPage.entries())
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, pageChunks]) => ({
        pageNumber,
        originalText: pageChunks.map((chunk) => chunk.originalChinese).join("\n\n"),
        translatedText: normalizeTranslationFootnotes(joinEnglishTranslation(pageChunks)),
        chunks: pageChunks
      }));

    if (entry.inputMode === "document") {
      setInputMode("document");
      setDocumentFormat(entry.documentFormat ?? "pdf");
      const pages = restoredPages.map((page) => ({ pageNumber: page.pageNumber, text: page.originalText }));
      const totalUnits = Math.max(pages.length, entry.unitCount);
      setPdfName(entry.sourceLabel);
      setPdfFile(undefined);
      setPdfPages(pages);
      setPdfTotalPages(totalUnits);
      setDocumentRangeStart(1);
      setDocumentRangeEnd(totalUnits);
      setPdfScannedMessage("");
      replacePdfUrl(undefined);
      resetImageState();
      setPastedText("");
    } else if (entry.inputMode === "image") {
      setInputMode("image");
      resetPdfState();
      setPastedText("");
      setImageName(entry.sourceLabel);
      setImageDataUrl(undefined);
    } else {
      setInputMode("text");
      resetPdfState();
      resetImageState();
      setPastedText(restoredPages.map((page) => page.originalText).join("\n\n"));
    }

    setDomain(entry.domain);
    setTranslatedChunks(restoredChunks);
    setTranslationPages(restoredPages);
    setApprovedChunkIds(entry.approvedChunkIds);
    setUsedModel(entry.usedModel);
    setTranslationStale(false);
    setCanResume(false);
    setReviewMode(false);
    setActiveView("english");
    setSourcePanelOpen(false);
    setIsHistoryOpen(false);
    editHistoryRef.current = [];
    historyEntryRef.current = entry;
  };

  const handleDeleteHistoryEntry = (id: string) => {
    if (historyEntryRef.current?.id === id) {
      historyEntryRef.current = null;
    }
    void deleteTranslationHistoryEntry(id).then(refreshHistory).catch(() => undefined);
  };

  const handleClearHistory = () => {
    historyEntryRef.current = null;
    void clearTranslationHistory().then(refreshHistory).catch(() => undefined);
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

  const handleDownloadDocx = async () => {
    try {
      await downloadBilingualDocx({ chunks: translatedChunks, sourceLabel, model: usedModel });
      showToast("DOCX downloaded");
    } catch {
      setErrorMessage("DOCX export failed.");
    }
  };

  return (
    <main className="min-h-screen px-4 pb-24 pt-4 sm:px-6 lg:px-8 xl:pb-4">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
        <AppHeader
          theme={theme}
          connectionLabel={connectionLabel}
          connectionActive={connectionActive}
          onThemeChange={setTheme}
          onOpenApiSettings={() => {
            if (!processing) setIsSettingsOpen(true);
          }}
        />

        <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-4 xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-7.25rem)] xl:flex-col xl:space-y-0">
            <div className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              <section className="workspace-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Step 1</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Add content</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={progressStep === "extracting" ? "status-pill bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" : hasSourceLoaded ? "status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" : "status-pill"}>
                    <span className={`h-1.5 w-1.5 rounded-full ${progressStep === "extracting" ? "animate-pulse bg-amber-500" : hasSourceLoaded ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {progressStep === "extracting" ? "Extracting" : hasSourceLoaded ? "Ready" : "No source yet"}
                  </span>
                  {hasSourceLoaded ? (
                    <button
                      type="button"
                      onClick={() => setSourcePanelOpen((open) => !open)}
                      className="secondary-button px-2.5 py-1.5 text-sm"
                    >
                      {sourcePanelOpen ? "Hide" : "Change"}
                    </button>
                  ) : null}
                </div>
              </div>

              {sourcePanelOpen || !hasSourceLoaded ? (
                <>
                  <div className="mt-4">
                    <InputModeTabs value={inputMode} onChange={handleInputModeChange} />
                  </div>

                  <div className="mt-4">
                    {inputMode === "document" ? (
                      <FileUpload fileName={pdfName} onFileSelect={handleFileSelect} />
                    ) : inputMode === "image" ? (
                      <ImageUpload fileName={imageName} onFileSelect={handleImageSelect} />
                    ) : (
                      <TextInputPanel
                        value={pastedText}
                        onChange={handlePastedTextChange}
                        onClear={() => handlePastedTextChange("")}
                      />
                    )}
                  </div>
                </>
              ) : null}

              <div className="workspace-panel-quiet mt-4 p-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {progressStep === "extracting" ? "Extracting text from your file…" : sourceSummary.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {progressStep === "extracting" ? statusMessage || "Reading the document…" : sourceSummary.detail}
                </p>
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-3">
                    <span>Input</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {inputMode === "document" ? documentFormatLabel : inputMode === "image" ? "Image" : "Pasted text"}
                    </span>
                  </div>
                  {inputMode === "document" && documentFormat === "pdf" && pdfTotalPages > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>Pages needing OCR</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{ocrPageCount}</span>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{sourceSummary.helper}</p>
              </div>
              </section>

              <section className="workspace-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Step 2 · Optional</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Options</h2>
                </div>
                <span className="status-pill">{selectedDomain.label}</span>
              </div>

              <div className="mt-4">
                <DomainSelector value={domain} onChange={handleDomainChange} disabled={processing} />
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{selectedDomain.description}</p>
              </div>

              {inputMode === "document" && pdfTotalPages > 1 ? (
                <div className="workspace-panel-quiet mt-4 p-3">
                  <DocumentRangeSelector
                    start={documentRangeStart}
                    end={documentRangeEnd}
                    totalUnits={pdfTotalPages}
                    selectedUnits={selectedDocumentPages.length}
                    unitLabel={documentUnitLabel}
                    disabled={processing}
                    onChange={handleDocumentRangeChange}
                  />
                </div>
              ) : null}

              <div className="mt-4">
                <div className="workspace-panel-quiet p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Glossary</p>
                    <button type="button" onClick={() => setIsGlossaryOpen(true)} disabled={processing} className="secondary-button px-2.5 py-1.5 text-sm">
                      Open
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="status-pill">{extractedEntities.length} found</span>
                    <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {lockedGlossaryCount} pinned
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeTerms}
                    disabled={processing || analyzingTerms || inputMode === "image" || (inputMode === "text" ? !pastedText.trim() : selectedDocumentPages.length === 0)}
                    className="secondary-button mt-3 w-full text-sm"
                  >
                    {analyzingTerms ? "Analyzing terms…" : "Suggest glossary terms"}
                  </button>
                  {lockedGlossaryCount > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {glossaryEntries
                        .filter((entry) => entry.locked && entry.english.trim())
                        .slice(0, 3)
                        .map((entry) => (
                          <span
                            key={`${entry.chinese}-${entry.english}`}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {entry.chinese}
                            {" -> "}
                            {entry.english}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
              </section>
            </div>

            <section className="workspace-panel grid shrink-0 gap-2 p-3 shadow-lg shadow-slate-950/5 dark:shadow-black/20 xl:mt-3">
              {processing ? (
                <button type="button" onClick={handleCancelTranslation} className="secondary-button w-full">
                  Pause translation
                </button>
              ) : (
                <button type="button" onClick={handleTranslate} disabled={translateDisabled} className="primary-button w-full gap-2">
                  {translateButtonLabel}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    refreshHistory();
                    setIsHistoryOpen(true);
                  }}
                  disabled={processing}
                  className="secondary-button w-full"
                >
                  History
                </button>
                <button type="button" onClick={handleReset} disabled={processing} className="secondary-button w-full">
                  New document
                </button>
              </div>
              <p className="text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                Workspace changes save automatically on this device.
              </p>
            </section>
          </aside>

          <section ref={resultsRef} className="min-w-0 scroll-mt-4 space-y-4">
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
              <section className="workspace-panel min-h-[520px] space-y-4 p-3 sm:p-4 lg:p-5">
                {hasTranslation || processing ? (
                  <div className="z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:sticky md:top-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                            {processing ? "Translation in progress" : "Translation results"}
                          </h3>
                          {translationStale ? (
                            <span className="status-pill bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                              Source changed
                            </span>
                          ) : null}
                          {!processing && hasTranslation && !translationStale ? (
                            <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {processing && totalUnits > 0
                            ? `Working through ${Math.min(completedUnits, totalUnits)} of ${totalUnits} ${inputMode === "document" ? `${documentUnitLabel}s` : inputMode === "image" ? "image steps" : "sections"}`
                            : translationStale
                              ? "Update the translation before copying or exporting."
                              : `${sourceLabel}${usedModel ? ` · ${usedModel}` : ""}`}
                        </p>
                      </div>
                      <ExportButtons
                        onCopy={handleCopyEnglish}
                        onDownloadHtml={handleDownloadHtml}
                        onDownloadDocx={() => void handleDownloadDocx()}
                        onDownloadTxt={handleDownloadTxt}
                        onDownloadPdf={handleDownloadPdf}
                        copied={toastVisible && toastMessage === "Copied to clipboard."}
                        disabled={!englishText || processing || translationStale}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <TranslationTabs
                        active={activeView}
                        onChange={(view) => {
                          setActiveView(view);
                          if (view !== "english") {
                            setReviewMode(false);
                          }
                        }}
                      />
                      {(activeView === "english" || (activeView === "original" && inputMode !== "image")) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {activeView === "english" && hasTranslation && !processing ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setReviewMode((enabled) => !enabled)}
                                className={`secondary-button h-9 px-3 text-sm ${
                                  reviewMode
                                    ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
                                    : ""
                                }`}
                              >
                                {reviewMode ? "Reading view" : "Edit & review"}
                              </button>
                              {reviewMode ? (
                                <button
                                  type="button"
                                  onClick={undoTranslationEdit}
                                  disabled={editHistoryRef.current.length === 0}
                                  className="secondary-button h-9 px-3 text-sm"
                                >
                                  Undo edit
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {!reviewMode ? (
                            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
                              <button
                                type="button"
                                onClick={() => setDocumentFontSize((prev) => Math.max(14, prev - 1))}
                                className="icon-button h-8 w-8 border-0 bg-transparent"
                                title="Decrease text size"
                              >
                                A-
                              </button>
                              <span className="min-w-12 px-1 text-center text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                {documentFontSize}px
                              </span>
                              <button
                                type="button"
                                onClick={() => setDocumentFontSize((prev) => Math.min(22, prev + 1))}
                                className="icon-button h-8 w-8 border-0 bg-transparent"
                                title="Increase text size"
                              >
                                A+
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocumentFontSize(16)}
                                className="secondary-button h-8 border-0 bg-transparent px-2 text-sm"
                                title="Reset text size"
                              >
                                100%
                              </button>
                              <button
                                type="button"
                                onClick={() => setReadingWidth((prev) => (prev === "focused" ? "wide" : "focused"))}
                                className="secondary-button h-8 border-0 bg-transparent px-2 text-sm"
                                title="Toggle reading width"
                              >
                                {readingWidth === "focused" ? "Wide" : "Focus"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="eyebrow">Preview</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Source preview</h3>
                  </div>
                )}

                {hasTranslation && !processing ? (
                  <TranslationQualityPanel
                    issues={qualityIssues}
                    totalSegments={translatedChunks.length}
                    approvedSegments={approvedChunkIds.length}
                    onOpenReview={() => {
                      setActiveView("english");
                      setReviewMode(true);
                    }}
                  />
                ) : null}

                {!hasTranslation && !processing ? (
                  inputMode === "image" ? (
                    <article className="reader-card p-4">
                      <p className="eyebrow mb-3">Source image</p>
                      {imageDataUrl ? (
                        <img
                          src={imageDataUrl}
                          alt="Uploaded source"
                          className="max-h-[72vh] w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800"
                        />
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {imageName ? "The original image isn't stored in history — re-upload it to preview." : "No image loaded."}
                        </p>
                      )}
                    </article>
                  ) : inputMode === "document" ? (
                    documentFormat === "pdf" ? (
                      <article className="reader-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="eyebrow">Source PDF</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {pdfName ? `${pdfName} · ${pdfTotalPages} pages` : "Upload a PDF to preview it here."}
                            </p>
                          </div>
                          {ocrPageCount > 0 ? (
                            <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {ocrPageCount} page{ocrPageCount === 1 ? "" : "s"} need{ocrPageCount === 1 ? "s" : ""} OCR
                            </span>
                          ) : null}
                          {unavailablePdfPageCount > 0 ? (
                            <span className="status-pill bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                              {unavailablePdfPageCount} page{unavailablePdfPageCount === 1 ? "" : "s"} unavailable
                            </span>
                          ) : null}
                        </div>
                        {pdfObjectUrl ? (
                          <iframe
                            src={`${pdfObjectUrl}#page=1&zoom=page-width`}
                            title="Source PDF preview"
                            className="mt-4 h-[72vh] min-h-[560px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                          />
                        ) : (
                          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                            {pdfName ? "The original file isn't stored in history — re-upload it to preview." : "No PDF loaded."}
                          </p>
                        )}
                      </article>
                    ) : (
                      <DocumentSourceView
                        pages={pdfPages}
                        format={documentFormat}
                        fontSize={documentFontSize}
                        readingWidthClass={readingWidthClass}
                      />
                    )
                  ) : (
                    <article className={`reader-card mx-auto w-full ${readingWidthClass} p-6 sm:p-7`}>
                      <p className="eyebrow mb-4">Original Chinese</p>
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
                        <article className="reader-card p-4">
                          <p className="eyebrow mb-3">Original image</p>
                          {imageDataUrl ? (
                            <img
                              src={imageDataUrl}
                              alt="Uploaded source"
                              className="max-h-[72vh] w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800"
                            />
                          ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                          {imageName ? "The original image isn't stored in history — re-upload it to preview." : "No image loaded."}
                        </p>
                          )}
                        </article>
                      ) : inputMode === "document" ? (
                        <DocumentSourceView
                          pages={pdfPages}
                          translationPages={translationPages}
                          format={documentFormat}
                          fontSize={documentFontSize}
                          readingWidthClass={readingWidthClass}
                        />
                      ) : (
                        <article className={`reader-card mx-auto w-full ${readingWidthClass} p-6 sm:p-7`}>
                          <p className="eyebrow mb-4">Original Chinese</p>
                          <div className="text-slate-800 dark:text-slate-100" style={{ fontSize: `${documentFontSize}px` }}>
                            <ChineseSourceBody text={pastedText} />
                          </div>
                        </article>
                      )
                    ) : null}

                    {activeView === "english" ? (
                      reviewMode && !processing ? (
                        <TranslationEditor
                          chunks={translatedChunks}
                          issues={qualityIssues}
                          approvedChunkIds={approvedChunkIds}
                          onCommit={commitTranslationEdit}
                          onToggleApproved={toggleChunkApproved}
                          onRetranslate={retranslateChunk}
                          onNoteChange={updateReviewNote}
                        />
                      ) : (
                        <article className={`reader-card mx-auto w-full ${readingWidthClass} p-6 sm:p-8`}>
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <p className="eyebrow">English Translation</p>
                          {isStreaming ? (
                            <span className="status-pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
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
                              <p className="pt-2 text-sm text-slate-500 dark:text-slate-400">Waiting for the model to respond...</p>
                            </div>
                          ) : null}

                          {parsedEnglishText.footnotes.length > 0 ? (
                            <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                              <p className="eyebrow mb-3">Footnotes</p>
                              <ol className="space-y-2">
                                {parsedEnglishText.footnotes.map((note) => (
                                  <li
                                    key={`${note.marker}-${note.content.slice(0, 24)}`}
                                    className="text-sm leading-8 text-slate-700 dark:text-slate-200"
                                  >
                                    <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">{note.marker}</span>
                                    <span>{note.content}</span>
                                  </li>
                                ))}
                              </ol>
                            </section>
                          ) : null}
                        </div>
                        </article>
                      )
                    ) : null}

                    {activeView === "side-by-side" ? (
                      canShowPdfSideBySide && isLargeScreen ? (
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
                        <SideBySideView
                          chunks={translatedChunks}
                          unitLabel={inputMode === "document" ? documentUnitLabel : "Section"}
                        />
                      )
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : (
              <EmptyState
                onFileDrop={(file) => void handleDroppedFile(file)}
                onTextDrop={handleDroppedText}
                onPasteText={() => {
                  handleInputModeChange("text");
                  window.setTimeout(() => document.getElementById("source-text-input")?.focus(), 60);
                }}
                historyEntries={historyEntries}
                onRestoreHistory={handleRestoreHistoryEntry}
                onDeleteHistory={handleDeleteHistoryEntry}
                onOpenHistory={() => {
                  refreshHistory();
                  setIsHistoryOpen(true);
                }}
              />
            )}
          </section>
        </div>
      </div>

      <ApiKeySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        provider={provider}
        apiKeyDraft={apiKeyDraft}
        rememberKey={rememberKey}
        openRouterConnected={openRouterConnection.connected}
        openRouterLoading={openRouterConnection.loading}
        openRouterUserId={openRouterConnection.userId}
        openRouterModel={openRouterModel}
        onProviderChange={handleProviderChange}
        onOpenRouterModelChange={handleOpenRouterModelChange}
        onApiKeyDraftChange={setApiKeyDraft}
        onRememberKeyChange={setRememberKey}
        onSave={handleSaveApiKey}
        onClearSaved={handleClearSavedKey}
        onDisconnectOpenRouter={() => void handleDisconnectOpenRouter()}
        historyEnabled={historySavingEnabled}
        onHistoryEnabledChange={handleHistoryEnabledChange}
      />

      <LargeFileWarningModal
        open={isPreflightOpen}
        summary={preflightSummary}
        range={inputMode === "document" ? { start: documentRangeStart, end: documentRangeEnd } : undefined}
        onRangeChange={inputMode === "document" ? handleDocumentRangeChange : undefined}
        onCancel={() => setIsPreflightOpen(false)}
        onConfirm={() => {
          setIsPreflightOpen(false);
          void runTranslation();
        }}
      />

      <EntityGlossary
        extracted={extractedEntities}
        entries={glossaryEntries}
        onEntriesChange={handleGlossaryEntriesChange}
        onDismissExtracted={(chinese) => setExtractedEntities((entities) => entities.filter((entity) => entity.chinese !== chinese))}
        open={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      {/* Mobile sticky action bar: keeps Translate reachable without scrolling the sidebar. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 xl:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {processing ? (
          <div className="mx-auto flex max-w-[1480px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {statusMessage || "Translating..."}
              </p>
              {totalUnits > 0 ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {Math.min(completedUnits, totalUnits)} / {totalUnits}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={handleCancelTranslation} className="secondary-button shrink-0 px-4 py-2.5 text-sm">
              Pause
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-[1480px]">
            <button type="button" onClick={handleTranslate} disabled={translateDisabled} className="primary-button w-full py-3 text-sm">
              {translateButtonLabel}
            </button>
          </div>
        )}
      </div>

      <DropZoneOverlay
        disabled={processing}
        onFileDrop={(file) => void handleDroppedFile(file)}
        onTextDrop={handleDroppedText}
      />

      <TranslationHistoryModal
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={historyEntries}
        onRestore={handleRestoreHistoryEntry}
        onDelete={handleDeleteHistoryEntry}
        onClearAll={handleClearHistory}
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
