"use client";

import { parseChineseSource } from "@/lib/chineseSource";

type ChineseSourceBodyProps = {
  text: string;
  compact?: boolean;
};

const HEADING_RE = /^(?:第[一二三四五六七八九十百零〇\d]+[章節节回部篇條条]|[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十\d]+）|\([一二三四五六七八九十\d]+\))/;
const ENDS_WITH_PUNCT_RE = /[。！？!?；;：:，,、）)】》」』.]$/;
const LIST_ITEM_RE = /^(?:\d{1,3}[.、)）]|\([0-9一二三四五六七八九十]+\)|（[0-9一二三四五六七八九十]+）|[①-⑳]|[•·‧・‣▪◦*-]\s)/;

const isLikelyHeading = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 30) return false;
  if (HEADING_RE.test(trimmed)) return true;
  return trimmed.length <= 18 && !ENDS_WITH_PUNCT_RE.test(trimmed);
};

function ParagraphBlock({ text, compact }: { text: string; compact?: boolean }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length === 1 && isLikelyHeading(lines[0])) {
    return (
      <p className={`cn-text font-semibold text-slate-900 dark:text-slate-50 ${compact ? "mb-2 text-sm" : "mb-3 text-base"}`}>
        {lines[0]}
      </p>
    );
  }

  const allListItems = lines.length > 1 && lines.every((l) => LIST_ITEM_RE.test(l));
  if (allListItems) {
    return (
      <ul className={`cn-text list-none space-y-1 ${compact ? "mb-2" : "mb-4"}`}>
        {lines.map((line, i) => (
          <li key={`li-${i + 1}`} className="text-sm leading-7 text-slate-700 dark:text-slate-300">{line}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className={`cn-text cn-paragraph leading-7 text-slate-700 dark:text-slate-200 ${compact ? "mb-3 text-sm" : "mb-4 text-[15px]"}`}>
      {lines.map((line, i) => (
        <span key={`ln-${i + 1}`}>{i > 0 ? <br /> : null}{line}</span>
      ))}
    </p>
  );
}

export default function ChineseSourceBody({ text, compact = false }: ChineseSourceBodyProps) {
  const { blocks, footnotes } = parseChineseSource(text);
  if (blocks.length === 0 && footnotes.length === 0) {
    return <p className="cn-text text-sm text-slate-400 dark:text-slate-500">無可顯示文字</p>;
  }

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === "table") {
          return (
            <div key={`t-${i}`} className={`${compact ? "mb-3" : "mb-5"} overflow-x-auto rounded-lg border border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-950/30`}>
              <table className="cn-text min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {block.headers.map((h, j) => (
                      <th key={j} className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{h || `Col ${j + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      {row.map((cell, c) => (
                        <td key={c} className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="whitespace-pre-wrap break-words">{cell}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "preformatted") {
          return (
            <div key={`p-${i}`} className={compact ? "mb-3" : "mb-5"}>
              <pre className="cn-text overflow-x-auto rounded-lg border border-slate-200 bg-white/60 p-3 font-mono text-[11px] leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">{block.text}</pre>
            </div>
          );
        }
        return <ParagraphBlock key={`g-${i}`} text={block.text} compact={compact} />;
      })}

      {footnotes.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">註釋</p>
          <div className="space-y-1.5">
            {footnotes.map((note, i) => (
              <div key={`${note.marker}-${i}`} className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 font-semibold text-slate-500 dark:text-slate-400">{note.marker}</span>
                <span>{note.content}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
