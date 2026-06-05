"use client";

import { parseChineseSource } from "@/lib/chineseSource";

type ChineseSourceBodyProps = {
  text: string;
  /** Tighter spacing for side-by-side columns. */
  compact?: boolean;
};

// Lines that look like a heading (short, no terminal punctuation) or a
// chapter/section label common in Chinese documents.
const HEADING_RE =
  /^(?:第[一二三四五六七八九十百零〇\d]+[章節節节回部篇條条]|[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十\d]+）|\([一二三四五六七八九十\d]+\))/;
const ENDS_WITH_PUNCT_RE = /[。！？!?；;：:，,、）)】》」』.]$/;

// A list-item line such as "1. ...", "（1）...", "①...", "•...".
const LIST_ITEM_RE = /^(?:\d{1,3}[.、)）]|\([0-9一二三四五六七八九十]+\)|（[0-9一二三四五六七八九十]+）|[①-⑳]|[•·‧・‣▪◦*-]\s)/;

const isLikelyHeading = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 30) {
    return false;
  }
  if (HEADING_RE.test(trimmed)) {
    return true;
  }
  // Short standalone line without ending punctuation reads as a heading.
  return trimmed.length <= 18 && !ENDS_WITH_PUNCT_RE.test(trimmed);
};

function ParagraphBlock({ text, compact }: { text: string; compact?: boolean }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  // Single short line -> possible heading.
  if (lines.length === 1 && isLikelyHeading(lines[0])) {
    return (
      <p className={`cn-text font-semibold text-slate-900 dark:text-slate-50 ${compact ? "mb-2 text-[15px]" : "mb-3 text-lg"}`}>
        {lines[0]}
      </p>
    );
  }

  // Multiple list-item lines -> render as a list.
  const allListItems = lines.length > 1 && lines.every((line) => LIST_ITEM_RE.test(line));
  if (allListItems) {
    return (
      <ul className={`cn-text list-none space-y-1.5 ${compact ? "mb-3" : "mb-5"} pl-1`}>
        {lines.map((line, index) => (
          <li key={`li-${index + 1}`} className="leading-loose text-slate-800 dark:text-slate-100">
            {line}
          </li>
        ))}
      </ul>
    );
  }

  // Default paragraph. Preserve intentional internal line breaks.
  return (
    <p
      className={`cn-text cn-paragraph leading-loose text-slate-800 dark:text-slate-100 ${compact ? "mb-3 text-[15px]" : "mb-5 text-base"}`}
    >
      {lines.map((line, index) => (
        <span key={`ln-${index + 1}`}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </p>
  );
}

export default function ChineseSourceBody({ text, compact = false }: ChineseSourceBodyProps) {
  const { blocks, footnotes } = parseChineseSource(text);

  if (blocks.length === 0 && footnotes.length === 0) {
    return <p className="cn-text text-sm text-slate-500 dark:text-slate-400">未偵測到可顯示的文字。</p>;
  }

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
              <table className="cn-text min-w-full table-auto border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`header-${headerIndex + 1}`}
                        className="border-b border-amber-200 px-3 py-2 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                      >
                        {header || `第 ${headerIndex + 1} 欄`}
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
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400" colSpan={Math.max(block.headers.length, 1)}>
                        無資料列。
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
                {block.kind === "chart" ? "圖表資料" : "表格資料"}
              </p>
              <pre className="cn-text overflow-x-auto rounded-2xl border border-amber-200/80 bg-white/70 p-3 text-xs leading-7 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                {block.text}
              </pre>
            </div>
          );
        }

        return <ParagraphBlock key={`paragraph-${index + 1}`} text={block.text} compact={compact} />;
      })}

      {footnotes.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/80 dark:bg-amber-950/30">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">註釋</p>
          <ol className="space-y-2">
            {footnotes.map((note, index) => (
              <li
                key={`${note.marker}-${index + 1}`}
                className="cn-text text-sm leading-loose text-slate-700 dark:text-slate-200"
              >
                <span className="mr-2 font-semibold text-amber-800 dark:text-amber-200">{note.marker}</span>
                <span>{note.content}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
