import { PdfExtractResult } from "@/lib/types";

const SCANNED_PDF_MESSAGE =
  "This PDF appears to contain scanned images rather than selectable text. OCR support can be added in a future version.";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
};

let workerConfigured = false;

const ensureWorker = async () => {
  if (workerConfigured) {
    return;
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  workerConfigured = true;
};

const normalizePageText = (text: string): string =>
  text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

export const extractSelectableTextFromPdf = async (file: File): Promise<PdfExtractResult> => {
  try {
    await ensureWorker();
    const pdfjs = await import("pdfjs-dist");
    const data = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const pages: { pageNumber: number; text: string }[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as PdfTextItem[])
        .map((item) => {
          const value = item.str ?? "";
          if (!value) {
            return "";
          }
          return item.hasEOL ? `${value}\n` : `${value} `;
        })
        .join("");

      const normalized = normalizePageText(pageText);
      pages.push({ pageNumber, text: normalized });
    }

    const hasSelectableText = pages.some((page) => Boolean(page.text.trim()));
    if (!hasSelectableText) {
      return { kind: "scanned", message: SCANNED_PDF_MESSAGE, pages, totalPages };
    }

    return { kind: "success", pages, totalPages };
  } catch {
    return { kind: "error", message: "Unable to extract text from this PDF file." };
  }
};
