import { PdfExtractResult } from "@/lib/types";

let workerConfigured = false;

const ensureWorker = async () => {
  if (workerConfigured) {
    return;
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${encodeURIComponent(pdfjs.version)}`;
  workerConfigured = true;
};

const clampMaxWidth = (width: number, maxWidth: number): number => Math.max(640, Math.min(width, maxWidth));
const clampProbeWidth = (width: number): number => Math.max(96, Math.min(width, 320));

export const createPdfOcrFallbackResult = (
  totalPages: number,
  renderablePageNumbers: number[],
  sourceError: string
): PdfExtractResult => {
  const uniquePageNumbers = Array.from(new Set(renderablePageNumbers))
    .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages)
    .sort((left, right) => left - right);

  if (uniquePageNumbers.length === 0) {
    return {
      kind: "error",
      message: `${sourceError} OCR fallback could not render any pages.`
    };
  }

  const skippedPages = Math.max(totalPages - uniquePageNumbers.length, 0);
  const availability = skippedPages === 0
    ? totalPages === 1
      ? "The page can still be rendered."
      : `All ${totalPages} pages can still be rendered.`
    : `${uniquePageNumbers.length} of ${totalPages} pages can still be rendered; ${skippedPages} unreadable page${skippedPages === 1 ? " was" : "s were"} skipped.`;

  return {
    kind: "scanned",
    message: `${sourceError} ${availability} Translation will use OCR. Review names, seals, and dense tables carefully.`,
    pages: uniquePageNumbers.map((pageNumber) => ({ pageNumber, text: "" })),
    totalPages
  };
};

export const preparePdfOcrFallback = async (
  file: File,
  sourceError: string,
  maxPages: number,
  onProgress?: (completedPages: number, totalPages: number) => void
): Promise<PdfExtractResult> => {
  let loadingTask: ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
  try {
    await ensureWorker();
    const pdfjs = await import("pdfjs-dist");
    const data = new Uint8Array(await file.arrayBuffer());
    loadingTask = pdfjs.getDocument({
      data: data.slice(),
      isEvalSupported: false,
      stopAtErrors: false,
      useWorkerFetch: false
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (totalPages > maxPages) {
      await pdfDoc.destroy();
      return {
        kind: "error",
        message: `This PDF has ${totalPages} pages. Documents are limited to ${maxPages} pages per workspace.`
      };
    }

    const renderablePageNumbers: number[] = [];
    onProgress?.(0, totalPages);

    try {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        let page: Awaited<ReturnType<typeof pdfDoc.getPage>> | undefined;
        try {
          page = await pdfDoc.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const probeWidth = clampProbeWidth(baseViewport.width);
          const viewport = page.getViewport({ scale: probeWidth / baseViewport.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) {
            throw new Error("Unable to create a PDF render surface.");
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context, viewport }).promise;
          renderablePageNumbers.push(pageNumber);
        } catch (pageError) {
          console.warn(
            `PDF page ${pageNumber} could not be rendered for OCR fallback:`,
            pageError instanceof Error ? pageError.message : "Unknown page render error."
          );
        } finally {
          page?.cleanup();
          onProgress?.(pageNumber, totalPages);
        }
      }
    } finally {
      await pdfDoc.destroy();
    }

    return createPdfOcrFallbackResult(totalPages, renderablePageNumbers, sourceError);
  } catch (error) {
    await loadingTask?.destroy().catch(() => undefined);
    console.error(
      "PDF OCR fallback preparation failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : "Unknown PDF render error."
    );
    return {
      kind: "error",
      message: `${sourceError} OCR fallback could not open or render this document.`
    };
  }
};

export const fileToDataUrl = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Unable to read image file."));
      }
    };
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

export const renderPdfPagesToJpegDataUrls = async (file: File, pageNumbers: number[]): Promise<Map<number, string>> => {
  await ensureWorker();
  const pdfjs = await import("pdfjs-dist");
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data: data.slice(),
    isEvalSupported: false,
    stopAtErrors: false,
    useWorkerFetch: false
  });
  const pdfDoc = await loadingTask.promise;

  const uniquePageNumbers = Array.from(new Set(pageNumbers)).filter(
    (pageNumber) => pageNumber >= 1 && pageNumber <= pdfDoc.numPages
  );
  const result = new Map<number, string>();

  try {
    for (const pageNumber of uniquePageNumbers) {
      let page: Awaited<ReturnType<typeof pdfDoc.getPage>> | undefined;
      try {
        page = await pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = clampMaxWidth(baseViewport.width, 2000);
        const renderScale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Unable to render PDF page for OCR.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        result.set(pageNumber, canvas.toDataURL("image/jpeg", 0.92));
      } catch (pageError) {
        console.warn(
          `PDF page ${pageNumber} could not be rendered at OCR resolution:`,
          pageError instanceof Error ? pageError.message : "Unknown page render error."
        );
      } finally {
        page?.cleanup();
      }
    }
  } finally {
    await pdfDoc.destroy();
  }

  return result;
};

export const hasSelectableTextInPdfPage = (pageText: string): boolean => Boolean(pageText.trim());
