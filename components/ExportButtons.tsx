"use client";

type ExportButtonsProps = {
  onCopy: () => void;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
  copied: boolean;
  disabled?: boolean;
};

export default function ExportButtons({
  onCopy,
  onDownloadTxt,
  onDownloadPdf,
  copied,
  disabled
}: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCopy}
        disabled={disabled}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {copied ? "Copied." : "Copy English"}
      </button>
      <button
        type="button"
        onClick={onDownloadTxt}
        disabled={disabled}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        Download TXT
      </button>
      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={disabled}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        Download PDF
      </button>
    </div>
  );
}
