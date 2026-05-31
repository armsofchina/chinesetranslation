"use client";

type FileUploadProps = {
  fileName?: string;
  onFileSelect: (file: File | null) => void;
};

export default function FileUpload({ fileName, onFileSelect }: FileUploadProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">Upload PDF</label>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        Supports selectable Chinese PDFs. Scanned PDFs will show an OCR notice.
      </p>
      <input
        type="file"
        accept="application/pdf"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-100 dark:file:text-slate-900"
      />
      {fileName ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Selected: {fileName}</p>
      ) : null}
    </div>
  );
}
