"use client";

import { useId, useState } from "react";

type FileUploadProps = {
  fileName?: string;
  onFileSelect: (file: File | null) => void;
};

export default function FileUpload({ fileName, onFileSelect }: FileUploadProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section>
      <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100" htmlFor={inputId}>
        Upload PDF
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/pdf"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
        className="sr-only"
      />

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          onFileSelect(file ?? null);
        }}
        className={`mt-3 block cursor-pointer rounded-2xl border-2 border-dashed px-6 py-9 text-center transition focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${
          isDragging
            ? "border-sky-500 bg-sky-50 dark:bg-sky-900/30"
            : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-sky-500 dark:hover:bg-sky-900/20"
        }`}
      >
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Drag and drop your PDF here</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">or click to browse files</p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">PDF only</p>
      </label>

      {fileName ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Selected file: {fileName}</p> : null}

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Selectable PDFs are supported. Scanned image-only PDFs may require OCR in a future version.
      </p>
    </section>
  );
}
