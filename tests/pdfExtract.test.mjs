import assert from "node:assert/strict";
import test from "node:test";

import { createPdfOcrFallbackResult } from "../lib/imageOcr.ts";
import { extractSelectableTextFromPdf } from "../lib/pdfExtract.ts";

test("reports a clear error when an uploaded file is not a PDF", async () => {
  const bytes = new TextEncoder().encode("This is not a PDF file.");
  const result = await extractSelectableTextFromPdf({
    arrayBuffer: async () => bytes.buffer
  });

  assert.deepEqual(result, {
    kind: "error",
    message: "This file is not a valid PDF or is damaged. Try opening and re-exporting it as a new PDF."
  });
});

test("offers OCR for every PDF page that can still render", () => {
  const result = createPdfOcrFallbackResult(4, [4, 1, 3, 1], "Text extraction failed.");

  assert.equal(result.kind, "scanned");
  if (result.kind !== "scanned") return;
  assert.deepEqual(result.pages, [
    { pageNumber: 1, text: "" },
    { pageNumber: 3, text: "" },
    { pageNumber: 4, text: "" }
  ]);
  assert.match(result.message, /3 of 4 pages can still be rendered/);
  assert.match(result.message, /1 unreadable page was skipped/);
});

test("keeps a hard PDF error blocking when no page can render", () => {
  const result = createPdfOcrFallbackResult(2, [], "This PDF is password-protected.");

  assert.deepEqual(result, {
    kind: "error",
    message: "This PDF is password-protected. OCR fallback could not render any pages."
  });
});
