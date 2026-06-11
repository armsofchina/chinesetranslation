"use client";

import { useId, useState } from "react";

type ImageUploadProps = {
  fileName?: string;
  onFileSelect: (file: File | null) => void;
};

export default function ImageUpload({ fileName, onFileSelect }: ImageUploadProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/tiff"
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
          {fileName ? fileName : "Drop a scan, screenshot, or photo here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPG, WEBP, BMP, or TIFF</p>
      </label>
    </section>
  );
}
