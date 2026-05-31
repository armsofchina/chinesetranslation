import { TranslationChunk } from "@/lib/types";

type DownloadBilingualHtmlOptions = {
  chunks: TranslationChunk[];
  title?: string;
  sourceLabel?: string;
  model?: string;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatLocalDateTime = (date: Date): string =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

const buildExportHtml = ({ chunks, title, sourceLabel, model }: DownloadBilingualHtmlOptions): string => {
  const now = new Date();
  const heading = title?.trim() || "Bilingual Translation Review";
  const safeHeading = escapeHtml(heading);
  const safeSource = escapeHtml(sourceLabel?.trim() || "Chinese source text");
  const safeModel = escapeHtml(model?.trim() || "Not reported");
  const generatedAt = escapeHtml(formatLocalDateTime(now));
  const sectionCount = chunks.length;
  const englishChars = chunks.reduce((sum, chunk) => sum + chunk.translatedEnglish.length, 0);
  const chineseChars = chunks.reduce((sum, chunk) => sum + chunk.originalChinese.length, 0);

  const tocItems = chunks
    .map((chunk, index) => {
      const label = chunk.pageNumber ? `Page ${chunk.pageNumber}` : `Section ${index + 1}`;
      return `<a href="#section-${index + 1}">${escapeHtml(label)}</a>`;
    })
    .join("");

  const sectionCards = chunks
    .map((chunk, index) => {
      const sectionTitle = chunk.pageNumber ? `Page ${chunk.pageNumber}` : `Section ${index + 1}`;
      return `
        <article class="page-card" id="section-${index + 1}">
          <header class="page-header">
            <div>
              <p class="eyebrow">Translation Chunk</p>
              <h2>${escapeHtml(sectionTitle)}</h2>
            </div>
            <a class="page-anchor" href="#section-${index + 1}"># Link</a>
          </header>
          <div class="page-grid">
            <section class="text-panel chinese-panel">
              <p class="panel-label">Original Chinese</p>
              <p class="doc-text cn-text">${escapeHtml(chunk.originalChinese)}</p>
            </section>
            <section class="text-panel english-panel">
              <p class="panel-label">English Translation</p>
              <p class="doc-text">${escapeHtml(chunk.translatedEnglish)}</p>
            </section>
          </div>
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeHeading}</title>
  <style>
    :root {
      --bg: #efe4cf;
      --bg-deep: #dbc6a4;
      --panel: rgba(255, 251, 243, 0.92);
      --panel-strong: rgba(255, 251, 243, 0.98);
      --ink: #1f1a15;
      --muted: #6d6153;
      --line: rgba(31, 26, 21, 0.14);
      --accent: #8f4b2f;
      --accent-2: #345d63;
      --shadow: 0 22px 60px rgba(50, 35, 18, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      color: var(--ink);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      background:
        radial-gradient(circle at top left, rgba(143, 75, 47, 0.20), transparent 24rem),
        radial-gradient(circle at top right, rgba(52, 93, 99, 0.18), transparent 26rem),
        linear-gradient(180deg, #f7f0e3 0%, var(--bg) 45%, var(--bg-deep) 100%);
      min-height: 100vh;
      line-height: 1.65;
    }

    body[data-view-mode="english"] .chinese-panel {
      display: none;
    }

    body[data-view-mode="chinese"] .english-panel {
      display: none;
    }

    .frame {
      width: min(1380px, calc(100vw - 24px));
      margin: 0 auto;
      padding: 16px 0 44px;
    }

    .hero-card,
    .page-card {
      border: 1px solid var(--line);
      border-radius: 28px;
      background: rgba(255, 251, 245, 0.9);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .hero-card {
      margin-bottom: 16px;
    }

    .hero-top {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(290px, 0.9fr);
      gap: 18px;
      padding: 20px;
    }

    .kicker {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--accent);
    }

    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.08;
    }

    .summary {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 17px;
    }

    .meta-card,
    .toc-card {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--panel);
      padding: 14px 16px;
    }

    .meta-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .meta-grid strong {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 0 20px 20px;
    }

    .toggle {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel-strong);
      padding: 4px;
      gap: 4px;
    }

    .toggle button {
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 10px 14px;
      border-radius: 999px;
      cursor: pointer;
      font: inherit;
    }

    .toggle button[aria-pressed="true"] {
      background: linear-gradient(135deg, var(--accent), #a96a40);
      color: #fffdf7;
    }

    .toc-title {
      margin: 0 0 8px;
      font-size: 16px;
    }

    .toc-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .toc-links a {
      text-decoration: none;
      color: var(--accent-2);
      border: 1px solid rgba(52, 93, 99, 0.22);
      border-radius: 999px;
      padding: 7px 11px;
      background: rgba(52, 93, 99, 0.06);
      font-size: 14px;
    }

    .pages {
      display: grid;
      gap: 16px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
    }

    .eyebrow {
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 11px;
      color: var(--muted);
    }

    .page-header h2 {
      margin: 0;
      font-size: 24px;
    }

    .page-anchor {
      color: var(--accent-2);
      text-decoration: none;
      font-weight: 600;
    }

    .page-grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 16px;
    }

    body[data-view-mode="english"] .page-grid,
    body[data-view-mode="chinese"] .page-grid {
      grid-template-columns: 1fr;
    }

    .text-panel {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel-strong);
      padding: 14px;
      min-width: 0;
    }

    .panel-label {
      margin: 0 0 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      font-weight: 700;
    }

    .doc-text {
      margin: 0;
      white-space: pre-wrap;
      font-size: 16px;
      line-height: 1.85;
    }

    .cn-text {
      font-family: "Noto Sans CJK TC", "Noto Sans CJK SC", "PingFang TC", "PingFang SC", "Microsoft JhengHei",
        "Microsoft YaHei", "Heiti TC", sans-serif;
    }

    @media (max-width: 1020px) {
      .hero-top {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 860px) {
      .page-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body data-view-mode="bilingual">
  <main class="frame">
    <section class="hero-card">
      <div class="hero-top">
        <div>
          <p class="kicker">Translation Review Export</p>
          <h1>${safeHeading}</h1>
          <p class="summary">Standalone bilingual review file generated by Chinese PDF/Text Translator.</p>
        </div>
        <div class="meta-card">
          <div class="meta-grid">
            <div><strong>Source</strong>${safeSource}</div>
            <div><strong>Model</strong>${safeModel}</div>
            <div><strong>Sections</strong>${sectionCount}</div>
            <div><strong>Generated</strong>${generatedAt}</div>
            <div><strong>Chinese Characters</strong>${chineseChars.toLocaleString()}</div>
            <div><strong>English Characters</strong>${englishChars.toLocaleString()}</div>
          </div>
        </div>
      </div>
      <div class="toolbar">
        <div class="toggle" role="radiogroup" aria-label="View mode">
          <button type="button" data-view="bilingual" aria-pressed="true">Bilingual</button>
          <button type="button" data-view="chinese" aria-pressed="false">Chinese only</button>
          <button type="button" data-view="english" aria-pressed="false">English only</button>
        </div>
      </div>
    </section>

    <section class="toc-card">
      <h3 class="toc-title">Jump to section</h3>
      <div class="toc-links">${tocItems}</div>
    </section>

    <section class="pages">
      ${sectionCards}
    </section>
  </main>

  <script>
    const modeButtons = document.querySelectorAll("[data-view]");
    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-view");
        document.body.setAttribute("data-view-mode", mode || "bilingual");
        modeButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      });
    });
  </script>
</body>
</html>`;
};

export const downloadBilingualHtml = (options: DownloadBilingualHtmlOptions): void => {
  const html = buildExportHtml(options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `bilingual-translation-review-${stamp}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
