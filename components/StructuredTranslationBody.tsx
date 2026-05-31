"use client";

import { parseStructuredBlocks } from "@/lib/structuredBlocks";

type StructuredTranslationBodyProps = {
  paragraphs: string[];
  compact?: boolean;
};

export default function StructuredTranslationBody({ paragraphs, compact = false }: StructuredTranslationBodyProps) {
  const blocks = parseStructuredBlocks(paragraphs);
  const paragraphSpacing = compact ? "mb-3" : "mb-5";
  const sectionSpacing = compact ? "mb-4" : "mb-6";

  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "table") {
          const hasRows = block.rows.length > 0;
          return (
            <div
              key={`table-${index + 1}`}
              className={`${sectionSpacing} overflow-x-auto rounded-2xl border border-amber-200/80 bg-white/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/40`}
            >
              <table className="min-w-full table-auto border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`header-${headerIndex + 1}`}
                        className="border-b border-amber-200 px-3 py-2 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        {header || `Column ${headerIndex + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasRows ? (
                    block.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex + 1}`}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`cell-${rowIndex + 1}-${cellIndex + 1}`}
                            className="border-b border-amber-100 px-3 py-2 align-top text-slate-700 dark:border-slate-800 dark:text-slate-200"
                          >
                            <span className="whitespace-pre-wrap break-words">{cell}</span>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-2 text-slate-500 dark:text-slate-400"
                        colSpan={Math.max(block.headers.length, 1)}
                      >
                        No data rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "preformatted") {
          return (
            <div key={`pre-${index + 1}`} className={sectionSpacing}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {block.kind === "chart" ? "Chart Data" : "Structured Table Data"}
              </p>
              <pre className="overflow-x-auto rounded-2xl border border-amber-200/80 bg-white/70 p-3 font-mono text-xs leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                {block.text}
              </pre>
            </div>
          );
        }

        return (
          <p key={`paragraph-${index + 1}`} className={`${paragraphSpacing} last:mb-0`}>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
