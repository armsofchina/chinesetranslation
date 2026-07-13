let workerConfigured = false;

const ensureWorker = async () => {
  if (workerConfigured) {
    return;
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  workerConfigured = true;
};

const clampMaxWidth = (width: number, maxWidth: number): number => Math.max(640, Math.min(width, maxWidth));

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
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  const uniquePageNumbers = Array.from(new Set(pageNumbers)).filter(
    (pageNumber) => pageNumber >= 1 && pageNumber <= pdfDoc.numPages
  );
  const result = new Map<number, string>();

  for (const pageNumber of uniquePageNumbers) {
    const page = await pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = clampMaxWidth(baseViewport.width, 2000);
    const renderScale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to render PDF page for OCR.");
    }

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    result.set(pageNumber, dataUrl);
  }

  return result;
};

export const hasSelectableTextInPdfPage = (pageText: string): boolean => Boolean(pageText.trim());
