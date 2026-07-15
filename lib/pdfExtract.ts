import { PdfExtractResult } from "@/lib/types";
import { cleanExtractedChineseText } from "@/lib/chineseTextCleanup";

const SCANNED_PDF_MESSAGE =
  "This PDF appears image-based. OCR translation can still be used, but names, seals, and dense tables may need manual review.";
const PDF_WORKER_PATH = "/pdf.worker.min.mjs";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
};

type PositionedLine = { y: number; height: number; items: Array<PdfTextItem & { x: number }> };

let workerConfigured = false;

const ensureWorker = async () => {
  if (workerConfigured) {
    return;
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDF_WORKER_PATH}?v=${encodeURIComponent(pdfjs.version)}`;
  workerConfigured = true;
};

const hasPdfHeader = (data: Uint8Array): boolean => {
  const prefix = data.subarray(0, Math.min(data.length, 1024));
  return String.fromCharCode(...prefix).includes("%PDF-");
};

const getPdfErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : "";
  const detail = error instanceof Error ? error.message.toLowerCase() : "";

  if (name === "PasswordException" || detail.includes("password")) {
    return "This PDF is password-protected. Remove the password and upload it again.";
  }
  if (name === "InvalidPDFException" || detail.includes("invalid pdf") || detail.includes("pdf header")) {
    return "This file is not a valid PDF or is damaged. Try opening and re-exporting it as a new PDF.";
  }
  if (
    detail.includes("worker") ||
    detail.includes("fake worker") ||
    detail.includes("dynamically imported module")
  ) {
    return "The PDF reader could not load. Refresh the page and try again; if this continues, the deployment is missing its PDF worker file.";
  }
  if (detail.includes("all pages failed")) {
    return "The PDF opened, but none of its pages could be read. Try re-exporting the document or use OCR if the pages are images.";
  }
  return "This PDF could not be read. It may be damaged or use an unsupported security or encoding format.";
};

const normalizePageText = (text: string): string =>
  cleanExtractedChineseText(
    text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
  );

const median = (values: number[]): number => {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const rebuildPageText = (items: PdfTextItem[]): string => {
  const positioned = items
    .filter((item) => item.str?.trim() && item.transform?.length && Number.isFinite(item.transform[4]) && Number.isFinite(item.transform[5]))
    .map((item) => ({
      ...item,
      x: item.transform![4],
      y: item.transform![5],
      height: Math.abs(item.height || item.transform![3] || 10)
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);

  if (positioned.length === 0) {
    return items.map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`).join("");
  }

  const typicalHeight = median(positioned.map((item) => item.height).filter(Boolean));
  const lines: PositionedLine[] = [];
  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, Math.min(candidate.height, item.height) * 0.45));
    if (line) {
      line.items.push(item);
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ y: item.y, height: item.height, items: [item] });
    }
  }
  lines.sort((left, right) => right.y - left.y);

  return lines.map((line, lineIndex) => {
    line.items.sort((left, right) => left.x - right.x);
    let value = "";
    let priorEnd: number | undefined;
    for (const item of line.items) {
      const text = item.str || "";
      const gap = priorEnd === undefined ? 0 : item.x - priorEnd;
      if (value && gap > typicalHeight * 2.2) {
        value += "\t";
      } else if (value && gap > typicalHeight * 0.22 && /[A-Za-z0-9]$/.test(value) && /^[A-Za-z0-9]/.test(text)) {
        value += " ";
      }
      value += text;
      priorEnd = item.x + (item.width || text.length * (item.height || typicalHeight) * 0.55);
    }
    const next = lines[lineIndex + 1];
    const verticalGap = next ? line.y - next.y : 0;
    return `${value.trimEnd()}${next && verticalGap > typicalHeight * 1.65 ? "\n\n" : "\n"}`;
  }).join("");
};

const removeRepeatedMargins = (pages: { pageNumber: number; text: string }[]) => {
  if (pages.length < 3) return pages;
  const counts = new Map<string, number>();
  const candidatesByPage = pages.map((page) => {
    const lines = page.text.split("\n").map((line) => line.trim()).filter(Boolean);
    const candidates = new Set([...lines.slice(0, 2), ...lines.slice(-2)].filter((line) => line.length >= 2 && line.length <= 160));
    candidates.forEach((line) => counts.set(line, (counts.get(line) || 0) + 1));
    return candidates;
  });
  const threshold = Math.max(3, Math.ceil(pages.length * 0.6));
  const repeated = new Set([...counts].filter(([, count]) => count >= threshold).map(([line]) => line));
  if (repeated.size === 0) return pages;
  return pages.map((page, index) => ({
    ...page,
    text: normalizePageText(page.text.split("\n").filter((line) => !candidatesByPage[index].has(line.trim()) || !repeated.has(line.trim())).join("\n"))
  }));
};

export const extractSelectableTextFromPdf = async (file: File): Promise<PdfExtractResult> => {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    if (!hasPdfHeader(data)) {
      return {
        kind: "error",
        message: "This file is not a valid PDF or is damaged. Try opening and re-exporting it as a new PDF."
      };
    }

    await ensureWorker();
    const pdfjs = await import("pdfjs-dist");
    const loadingTask = pdfjs.getDocument({
      data: data.slice(),
      isEvalSupported: false,
      stopAtErrors: false,
      useWorkerFetch: false
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const pages: { pageNumber: number; text: string }[] = [];
    let failedPages = 0;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = rebuildPageText(textContent.items as PdfTextItem[]);
        pages.push({ pageNumber, text: normalizePageText(pageText) });
        page.cleanup();
      } catch (pageError) {
        failedPages += 1;
        pages.push({ pageNumber, text: "" });
        console.warn(
          `PDF page ${pageNumber} could not be read:`,
          pageError instanceof Error ? pageError.message : "Unknown page error."
        );
      }
    }

    await pdfDoc.destroy();

    if (failedPages === totalPages && totalPages > 0) {
      throw new Error("All pages failed to parse.");
    }

    const cleanedPages = removeRepeatedMargins(pages);
    const hasSelectableText = cleanedPages.some((page) => Boolean(page.text.trim()));
    if (!hasSelectableText) {
      return { kind: "scanned", message: SCANNED_PDF_MESSAGE, pages: cleanedPages, totalPages };
    }
    return { kind: "success", pages: cleanedPages, totalPages };
  } catch (error) {
    console.error(
      "PDF extraction failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : "Unknown PDF parsing error."
    );
    return { kind: "error", message: getPdfErrorMessage(error) };
  }
};
