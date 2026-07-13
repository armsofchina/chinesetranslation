"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import TranslationEditor from "@/components/TranslationEditor";
import TranslationQualityPanel from "@/components/TranslationQualityPanel";
import { downloadBilingualHtml } from "@/lib/exportHtml";
import { downloadEnglishPdf } from "@/lib/exportPdf";
import { downloadTxt } from "@/lib/exportTxt";
import { ExtractedEntity, extractEntitiesHeuristic } from "@/lib/extractEntities";
import { normalizeTranslationFootnotes, parseTranslationText } from "@/lib/footnotes";
import { fileToDataUrl, hasSelectableTextInPdfPage, renderPdfPagesToJpegDataUrls } from "@/lib/imageOcr";
import { extractSelectableTextFromPdf } from "@/lib/pdfExtract";
import {
  clearWorkspaceSnapshot,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot
} from "@/lib/projectStore";
import { DOMAINS, TranslationDomain } from "@/lib/prompts";
import { inspectTranslationQuality } from "@/lib/qualityChecks";
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
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 250;

const SCANNED_MESSAGE =
  "This PDF appears image-based. The workspace can translate scanned pages with OCR, but names, seals, and dense tables may still need manual review.";

const makeRollingContext = (source: string, translation: string, maxLen = 800): string => {
  const combined = `Previous source:\n${source.trim()}\n\nPrevious translation:\n${translation.trim()}`;
  return combined.length <= maxLen ? combined : combined.slice(-maxLen);
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
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [approvedChunkIds, setApprovedChunkIds] = useState<string[]>([]);
  const [translationStale, setTranslationStale] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);

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

  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const editHistoryRef = useRef<TranslationChunk[][]>([]);

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
    let active = true;
    loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot || snapshot.version !== 1) {
          return;
        }
        setInputMode(snapshot.inputMode);
        setPdfName(snapshot.pdfName);
        setPdfFile(snapshot.pdfFile);
        setPdfPages(snapshot.pdfPages);
        setPdfTotalPages(snapshot.pdfTotalPages);
        setPdfScannedMessage(snapshot.pdfScannedMessage);
        if (snapshot.pdfFile) {
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
        setTranslationStale(snapshot.translationStale);
        setCanResume(snapshot.canResume);
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
        inputMode,
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
    extractedEntities,
    glossaryEntries,
    imageDataUrl,
    imageName,
    inputMode,
    pastedText,
    pdfFile,
    pdfName,
    pdfPages,
    pdfScannedMessage,
    pdfTotalPages,
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
    if (hasTranslation) {
      setTranslationStale(true);
      setCanResume(false);
      setApprovedChunkIds([]);
    }
  };

  const handleInputModeChange = (mode: InputMode) => {
    if (mode === inputMode) {
      return;
    }
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
    setPastedText(value);
    markTranslationStale();
  };

  const handleDomainChange = (value: TranslationDomain) => {
    setDomain(value);
    markTranslationStale();
  };

  const handleGlossaryEntriesChange = (entries: GlossaryEntry[]) => {
    setGlossaryEntries(entries);
    markTranslationStale();
  };

  const commitTranslationEdit = (chunkId: string, translatedEnglish: string) => {
    editHistoryRef.current.push(translatedChunks);
    const nextChunks = translatedChunks.map((chunk) =>
      chunk.id === chunkId ? { ...chunk, translatedEnglish } : chunk
    );
    setTranslatedChunks(nextChunks);
    setTranslationPages((pages) =>
      pages.map((page) => {
        const nextPageChunks = page.chunks.map((chunk) =>
          chunk.id === chunkId ? { ...chunk, translatedEnglish } : chunk
        );
        return {
          ...page,
          chunks: nextPageChunks,
          translatedText: normalizeTranslationFootnotes(joinEnglishTranslation(nextPageChunks))
        };
      })
    );
    setApprovedChunkIds((ids) => ids.filter((id) => id !== chunkId));
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
    setApprovedChunkIds((ids) =>
      ids.includes(chunkId) ? ids.filter((id) => id !== chunkId) : [...ids, chunkId]
    );
  };

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

    if (file.size > MAX_PDF_BYTES) {
      setErrorMessage("PDFs must be 50 MB or smaller.");
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

    if (result.totalPages > MAX_PDF_PAGES) {
      resetPdfState();
      setStatusMessage("");
      setProgressStep("idle");
      setErrorMessage(`PDFs are limited to ${MAX_PDF_PAGES} pages per workspace.`);
      return;
    }

    setPdfPages(result.pages);
    setPdfTotalPages(result.totalPages);
    setStatusMessage("");
    setProgressStep("idle");
    setApprovedChunkIds([]);
    setTranslationStale(false);
    setCanResume(false);
    setSourcePanelOpen(false);

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

  const streamChunkWithRetry = (chunk: TranslationChunk, rollingContext: string) =>
    withSmartRetry(
      async (_attempt, temperature) => {
        setLiveText("");
        return streamTranslation(
          {
            chunk,
            userPpqApiKey: activeUserApiKey || undefined,
            domain,
            previousSummary: rollingContext || undefined,
            glossary: lockedGlossary,
            temperature
          },
          {
            onDelta: (delta) => setLiveText((prev) => prev + delta),
            signal: abortControllerRef.current?.signal
          }
        );
      },
      { maxRetries: 2 }
    );

  const transcribeImageWithRetry = (imageTask: { id: string; pageNumber: number; imageDataUrl: string }) =>
    withSmartRetry(
      async (attempt) => {
        setLiveText("");
        return streamTranslation(
          {
            imageTask: { ...imageTask, mode: "ocr" },
            userPpqApiKey: activeUserApiKey || undefined,
            temperature: Math.min(0.1, attempt * 0.05)
          },
          {
            onDelta: (delta) => setLiveText((prev) => prev + delta),
            signal: abortControllerRef.current?.signal
          }
        );
      },
      { maxRetries: 2, validateEnglish: false }
    );

  const handleTranslatePdfPageByPage = async (resume: boolean) => {
    const pagesToTranslate = pdfPages;
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
    const lastCompletedChunk = completedChunks[completedChunks.length - 1];
    let rollingContext = lastCompletedChunk
      ? makeRollingContext(lastCompletedChunk.originalChinese, lastCompletedChunk.translatedEnglish)
      : "";
    const pagesNeedingOcr = pagesToTranslate
      .filter((page) => !hasSelectableTextInPdfPage(page.text) && !completedPageNumbers.has(page.pageNumber))
      .map((page) => page.pageNumber);

    setTotalUnits(pagesToTranslate.length);
    setCompletedUnits(completedPages.length);

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
      if (completedPageNumbers.has(page.pageNumber)) {
        continue;
      }
      const pageChunks = createChunksFromSinglePdfPage(page);
      const isOcrPage = pageChunks.length === 0;

      setStatusMessage(
        `${isOcrPage ? "Running OCR on" : "Translating"} page ${page.pageNumber} of ${pdfTotalPages}...`
      );
      setLiveText("");
      setIsStreaming(true);

      if (isOcrPage) {
        let ocrText = savedOcrText.get(page.pageNumber) || "";
        if (!ocrText) {
          const imageDataUrl = ocrImageMap.get(page.pageNumber);
          if (!imageDataUrl) {
            throw new Error(`Unable to prepare OCR image for page ${page.pageNumber}.`);
          }
          setStatusMessage(`Transcribing page ${page.pageNumber} of ${pdfTotalPages}...`);
          const ocrResult = await transcribeImageWithRetry({
            id: `pdf-ocr-p${page.pageNumber}`,
            pageNumber: page.pageNumber,
            imageDataUrl
          });
          ocrText = ocrResult.text.trim();
          if (!ocrText) {
            throw new Error(`No readable text was found on page ${page.pageNumber}.`);
          }
          savedOcrText.set(page.pageNumber, ocrText);
          setTranslationPages((pages) => [
            ...pages.filter((entry) => entry.pageNumber !== page.pageNumber),
            { pageNumber: page.pageNumber, originalText: ocrText, translatedText: "", chunks: [] }
          ].sort((left, right) => left.pageNumber - right.pageNumber));
        }

        setStatusMessage(`Translating page ${page.pageNumber} of ${pdfTotalPages}...`);
        const sourceChunk: TranslationChunk = {
          id: `pdf-ocr-p${page.pageNumber}`,
          pageNumber: page.pageNumber,
          originalChinese: ocrText,
          translatedEnglish: ""
        };
        const { text, model } = await streamChunkWithRetry(sourceChunk, rollingContext);

        if (!text.trim()) {
          throw new Error(`Empty OCR translation output returned for page ${page.pageNumber}.`);
        }

        const ocrChunk: TranslationChunk = {
          id: `pdf-ocr-p${page.pageNumber}`,
          pageNumber: page.pageNumber,
          originalChinese: ocrText,
          translatedEnglish: text
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
        setCompletedUnits(completedPages.length);
        rollingContext = makeRollingContext(ocrText, text);
        continue;
      }

      // Selectable-text page: translate each chunk, streaming the active chunk.
      const translatedPageChunks: TranslationChunk[] = [];
      let pageModel = "";

      for (const pageChunk of pageChunks) {
        const { text, model } = await streamChunkWithRetry(pageChunk, rollingContext);

        if (!text.trim()) {
          throw new Error(`Empty translation output returned for page ${page.pageNumber}.`);
        }

        translatedPageChunks.push({ ...pageChunk, translatedEnglish: text });
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
      setCompletedUnits(completedPages.length);
    }

    setIsStreaming(false);
    setLiveText("");
  };

  const handleTranslateImage = async (resume: boolean) => {
    if (!imageDataUrl) {
      throw new Error("Upload an image to begin translation.");
    }

    setTotalUnits(1);
    setCompletedUnits(resume && translatedChunks[0]?.translatedEnglish.trim() ? 1 : 0);
    setStatusMessage("Transcribing image...");
    setLiveText("");
    setIsStreaming(true);

    let ocrText = translationPages[0]?.originalText || "";
    if (!ocrText || ocrText === "[Image-based source text]") {
      const ocrResult = await transcribeImageWithRetry({ id: "image-ocr-1", pageNumber: 1, imageDataUrl });
      ocrText = ocrResult.text.trim();
      if (!ocrText) {
        throw new Error("No readable text was found in this image.");
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
    const { text, model } = await streamChunkWithRetry(sourceChunk, "");

    if (!text.trim()) {
      throw new Error("Empty image translation result.");
    }

    const normalizedChunk: TranslationChunk = {
      id: "image-ocr-1",
      pageNumber: 1,
      originalChinese: ocrText,
      translatedEnglish: text
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
    setIsStreaming(false);
    setLiveText("");
  };

  const handleTranslate = async () => {
    const resume = canResume && !translationStale;
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
        await handleTranslatePdfPageByPage(resume);
      } else if (inputMode === "image") {
        await handleTranslateImage(resume);
      } else {
        const completedById = new Map(
          (resume ? translatedChunks : [])
            .filter((chunk) => chunk.translatedEnglish.trim())
            .map((chunk) => [chunk.id, chunk])
        );
        const completedChunks = sourceChunks
          .map((chunk) => completedById.get(chunk.id))
          .filter((chunk): chunk is TranslationChunk => Boolean(chunk));
        const lastCompletedChunk = completedChunks[completedChunks.length - 1];
        let rollingContext = lastCompletedChunk
          ? makeRollingContext(lastCompletedChunk.originalChinese, lastCompletedChunk.translatedEnglish)
          : "";
        setTotalUnits(sourceChunks.length);
        setCompletedUnits(completedChunks.length);

        for (let index = 0; index < sourceChunks.length; index += 1) {
          const chunk = sourceChunks[index];
          if (completedById.has(chunk.id)) {
            continue;
          }
          setStatusMessage(`Translating section ${index + 1} of ${sourceChunks.length}...`);
          setLiveText("");
          setIsStreaming(true);

          const { text, model } = await streamChunkWithRetry(chunk, rollingContext);

          if (!text.trim()) {
            throw new Error("Empty translation result.");
          }

          completedById.set(chunk.id, { ...chunk, translatedEnglish: text });
          const nextCompleted = sourceChunks
            .map((sourceChunk) => completedById.get(sourceChunk.id))
            .filter((entry): entry is TranslationChunk => Boolean(entry));
          setTranslatedChunks(nextCompleted);
          if (model) setUsedModel(model);
          setCompletedUnits(nextCompleted.length);
          rollingContext = makeRollingContext(chunk.originalChinese, text);
        }

        setIsStreaming(false);
        setLiveText("");
      }

      setProgressStep("generating");
      setStatusMessage("Generating output...");

      await new Promise((resolve) => setTimeout(resolve, 280));

      setActiveView("english");
      setReviewMode(false);
      setTranslationStale(false);
      setCanResume(false);
      setProgressStep("done");
      setStatusMessage("Translation complete.");
      setTimeout(() => {
        setStatusMessage("");
        setProgressStep("idle");
      }, 1200);
    } catch (error) {
      setStatusMessage("");
      setProgressStep("idle");
      const cancelled = abortControllerRef.current?.signal.aborted;
      setErrorMessage(cancelled ? "Translation paused. Resume when you are ready." : error instanceof Error ? error.message : "Translation failed.");
      setCanResume(true);
    } finally {
      setProcessing(false);
      setIsStreaming(false);
      setLiveText("");
      abortControllerRef.current = null;
    }
  };

  const handleCancelTranslation = () => {
    setStatusMessage("Pausing translation...");
    abortControllerRef.current?.abort();
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
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
    clearWorkspaceSnapshot().catch(() => undefined);
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
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
        <AppHeader
          theme={theme}
          usingCustomKey={usingCustomKey}
          onThemeChange={setTheme}
          onOpenApiSettings={() => setIsSettingsOpen(true)}
        />

        <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-4 xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-7.25rem)] xl:flex-col xl:space-y-0">
            <div className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              <section className="workspace-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Source</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Add content</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={hasSourceLoaded ? "status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" : "status-pill"}>
                    <span className={`h-1.5 w-1.5 rounded-full ${hasSourceLoaded ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {hasSourceLoaded ? "Ready" : "Waiting"}
                  </span>
                  {hasSourceLoaded ? (
                    <button
                      type="button"
                      onClick={() => setSourcePanelOpen((open) => !open)}
                      className="secondary-button px-2.5 py-1.5 text-xs"
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
                    {inputMode === "pdf" ? (
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
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{sourceSummary.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{sourceSummary.detail}</p>
                <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-3">
                    <span>Input</span>
                    <span className="font-medium capitalize text-slate-700 dark:text-slate-200">{inputMode}</span>
                  </div>
                  {inputMode === "pdf" && pdfTotalPages > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>OCR pages</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{ocrPageCount}</span>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{sourceSummary.helper}</p>
              </div>
              </section>

              <section className="workspace-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Translation</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Tune and run</h2>
                </div>
                <span className="status-pill">{selectedDomain.label}</span>
              </div>

              <div className="mt-4">
                <DomainSelector value={domain} onChange={handleDomainChange} disabled={processing} />
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedDomain.description}</p>
              </div>

              <div className="mt-4">
                <div className="workspace-panel-quiet p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Glossary</p>
                    <button type="button" onClick={() => setIsGlossaryOpen(true)} className="secondary-button px-2.5 py-1.5 text-xs">
                      Open
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="status-pill">{extractedEntities.length} detected</span>
                    <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
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
                  {canResume && !translationStale
                    ? "Resume translation"
                    : translationStale
                      ? "Update translation"
                      : "Translate to English"}
                </button>
              )}
              <button type="button" onClick={handleReset} disabled={processing} className="secondary-button w-full">
                New document
              </button>
              <p className="text-center text-[11px] leading-4 text-slate-400 dark:text-slate-500">
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
                  <div className="sticky top-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
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
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {processing && totalUnits > 0
                            ? `Working through ${Math.min(completedUnits, totalUnits)} of ${totalUnits} ${inputMode === "pdf" ? "pages" : inputMode === "image" ? "image steps" : "sections"}`
                            : translationStale
                              ? "Update the translation before copying or exporting."
                              : `${sourceLabel}${usedModel ? ` · ${usedModel}` : ""}`}
                        </p>
                      </div>
                      <ExportButtons
                        onCopy={handleCopyEnglish}
                        onDownloadHtml={handleDownloadHtml}
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
                                className={`secondary-button h-9 px-3 text-xs ${
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
                                  className="secondary-button h-9 px-3 text-xs"
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
                                className="secondary-button h-8 border-0 bg-transparent px-2 text-xs"
                                title="Reset text size"
                              >
                                100%
                              </button>
                              <button
                                type="button"
                                onClick={() => setReadingWidth((prev) => (prev === "focused" ? "wide" : "focused"))}
                                className="secondary-button h-8 border-0 bg-transparent px-2 text-xs"
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
                        <p className="text-sm text-slate-600 dark:text-slate-300">No image loaded.</p>
                      )}
                    </article>
                  ) : inputMode === "pdf" ? (
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
                            {ocrPageCount} OCR page{ocrPageCount === 1 ? "" : "s"} detected
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
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No PDF loaded.</p>
                      )}
                    </article>
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
                            <p className="text-sm text-slate-600 dark:text-slate-300">No image loaded.</p>
                          )}
                        </article>
                      ) : inputMode === "pdf" ? (
                        <div className="space-y-4">
                          {pdfPages.map((page) => {
                            const savedPage = translationPages.find((entry) => entry.pageNumber === page.pageNumber);
                            const originalText = page.text.trim() || savedPage?.originalText.trim() || "";

                            return (
                              <article
                                key={`orig-page-${page.pageNumber}`}
                                className={`reader-card mx-auto w-full ${readingWidthClass} p-5 sm:p-6`}
                              >
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <p className="eyebrow">
                                    第 {page.pageNumber} 頁 · Page {page.pageNumber}
                                  </p>
                                  {!page.text.trim() ? (
                                    <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                                      OCR text
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className="text-slate-800 dark:text-slate-100"
                                  style={{ fontSize: `${documentFontSize}px` }}
                                >
                                  {originalText ? (
                                    <ChineseSourceBody text={originalText} />
                                  ) : (
                                    <p className="cn-text text-sm text-slate-500 dark:text-slate-400">
                                      此頁未偵測到可選取的文字，翻譯時會改用 OCR。
                                    </p>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
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
                              <p className="pt-2 text-sm text-slate-400 dark:text-slate-500">Waiting for the model to respond...</p>
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
              <section className="workspace-panel flex min-h-[520px] items-center justify-center p-8 text-center">
                <div className="mx-auto max-w-md">
                  <p className="eyebrow">Workspace</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">Load a source to begin</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Upload a PDF, image, or paste Chinese text. The preview and translation results will stay focused here.
                  </p>
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
        onEntriesChange={handleGlossaryEntriesChange}
        open={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />

      <Toast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
