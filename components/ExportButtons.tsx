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
  const runAndClose = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    action();
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

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
      <details className="group relative">
        <summary
          className={`secondary-button cursor-pointer list-none px-3 py-2 text-xs marker:hidden ${
            disabled ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Export
        </summary>
        <div className="absolute right-0 z-30 mt-2 grid min-w-40 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={(event) => runAndClose(event, onDownloadHtml)} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Bilingual HTML
          </button>
          <button type="button" onClick={(event) => runAndClose(event, onDownloadTxt)} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            English TXT
          </button>
          <button type="button" onClick={(event) => runAndClose(event, onDownloadPdf)} className="rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            English PDF
          </button>
        </div>
      </details>
    </div>
  );
}
