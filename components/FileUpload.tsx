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
      <input
        id={inputId}
        type="file"
        accept=".pdf,.docx,.epub,.pptx,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
        className={`relative block cursor-pointer rounded-xl border border-dashed px-4 py-8 text-center transition ${
          isDragging
            ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/20"
            : "border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600"
        }`}
      >
        <p className="break-words text-sm font-medium text-slate-800 dark:text-slate-100">
          {fileName ? fileName : "Drop a document here or click to browse"}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">PDF, DOCX, EPUB, or PowerPoint (.pptx)</p>
      </label>
    </section>
  );
}
