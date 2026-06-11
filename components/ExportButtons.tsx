"use client";

type ExportButtonsProps = {
  onCopy: () => void;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
  onDownloadHtml: () => void;
  copied: boolean;
  disabled?: boolean;
};

export default function ExportButtons({ onCopy, onDownloadTxt, onDownloadPdf, onDownloadHtml, copied, disabled }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className="primary-button px-3 py-2 text-xs"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        onClick={onDownloadHtml}
        disabled={disabled}
        className="secondary-button px-2.5 py-2 text-xs"
      >
        HTML
      </button>
      <button
        type="button"
        onClick={onDownloadTxt}
        disabled={disabled}
        className="secondary-button px-2.5 py-2 text-xs"
      >
        TXT
      </button>
      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={disabled}
        className="secondary-button px-2.5 py-2 text-xs"
      >
        PDF
      </button>
    </div>
  );
}
