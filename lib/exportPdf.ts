import { jsPDF } from "jspdf";

export const downloadEnglishPdf = (englishText: string): void => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  const marginTop = 64;
  const lineHeight = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("English Translation", marginX, marginTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, marginTop + 20);

  doc.setFontSize(12);
  let y = marginTop + 48;

  const paragraphs = englishText
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, usableWidth);
    lines.forEach((line: string) => {
      if (y > pageHeight - 56) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    });
    y += 8;
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`english-translation-${stamp}.pdf`);
};
