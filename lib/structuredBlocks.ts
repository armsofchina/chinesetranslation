export type StructuredBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    }
  | {
      type: "preformatted";
      text: string;
      kind: "table" | "chart";
    };

const MARKDOWN_SEPARATOR_CELL_RE = /^:?-{3,}:?$/;
const BOX_DRAWING_RE = /[┌┬┐└┴┘├┼┤│─═║╔╗╚╝]/;
const BAR_CHART_RE = /[▁▂▃▄▅▆▇█■□◆◇●○]/;
const ASCII_GRID_RE = /^[+\-|=: ]+$/;
const KEY_VALUE_RE = /^.{1,50}:\s*[-+]?\d[\d,]*(?:\.\d+)?(?:%|[a-zA-Z]+)?$/;

const toNonEmptyLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeRowLength = (rows: string[][], targetLength: number): string[][] =>
  rows.map((row) => {
    if (row.length === targetLength) {
      return row;
    }
    if (row.length > targetLength) {
      return row.slice(0, targetLength);
    }
    return [...row, ...Array.from({ length: targetLength - row.length }, () => "")];
  });

const splitPipeCells = (line: string): string[] =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const parseMarkdownTable = (paragraph: string): StructuredBlock | null => {
  const lines = toNonEmptyLines(paragraph);
  if (lines.length < 2 || !lines[0].includes("|") || !lines[1].includes("|")) {
    return null;
  }

  const headerCells = splitPipeCells(lines[0]);
  const separatorCells = splitPipeCells(lines[1]);
  if (headerCells.length < 2 || separatorCells.length !== headerCells.length) {
    return null;
  }

  if (!separatorCells.every((cell) => MARKDOWN_SEPARATOR_CELL_RE.test(cell))) {
    return null;
  }

  const dataRows = normalizeRowLength(
    lines
      .slice(2)
      .filter((line) => line.includes("|"))
      .map((line) => splitPipeCells(line)),
    headerCells.length
  );

  return {
    type: "table",
    headers: headerCells,
    rows: dataRows
  };
};

const parseDelimitedTable = (paragraph: string): StructuredBlock | null => {
  const lines = toNonEmptyLines(paragraph);
  if (lines.length < 2) {
    return null;
  }

  const candidates = ["\t", ";", ",", "|"] as const;

  for (const delimiter of candidates) {
    if (!lines.every((line) => line.includes(delimiter))) {
      continue;
    }

    const splitRows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
    const columnCount = splitRows[0].length;
    if (columnCount < 2) {
      continue;
    }
    if (!splitRows.every((row) => row.length === columnCount)) {
      continue;
    }

    if (delimiter === "," || delimiter === ";") {
      const isLikelySentenceRows = splitRows.some((row) => row.every((cell) => cell.split(" ").length > 8));
      if (isLikelySentenceRows) {
        continue;
      }
    }

    const [firstRow, ...restRows] = splitRows;
    const useFirstAsHeader =
      firstRow.every((cell) => cell.length > 0) &&
      firstRow.some((cell) => /[A-Za-z]/.test(cell)) &&
      firstRow.every((cell) => !/^\d+(?:\.\d+)?$/.test(cell));

    if (useFirstAsHeader) {
      return {
        type: "table",
        headers: firstRow,
        rows: restRows
      };
    }

    return {
      type: "table",
      headers: Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`),
      rows: splitRows
    };
  }

  return null;
};

const parsePreformattedBlock = (paragraph: string): StructuredBlock | null => {
  const lines = toNonEmptyLines(paragraph);
  if (lines.length < 2) {
    return null;
  }

  const hasBoxDrawing = lines.some((line) => BOX_DRAWING_RE.test(line));
  const hasAsciiGrid = lines.filter((line) => ASCII_GRID_RE.test(line)).length >= 2;
  const hasBarChartGlyphs = lines.some((line) => BAR_CHART_RE.test(line));
  const keyValueLineCount = lines.filter((line) => KEY_VALUE_RE.test(line)).length;
  const hasMultipleColumnSpacing = lines.filter((line) => /\S+\s{2,}\S+/.test(line)).length >= 2;

  const isLikelyTable = hasBoxDrawing || hasAsciiGrid || hasMultipleColumnSpacing;
  const isLikelyChart = hasBarChartGlyphs || keyValueLineCount >= 2;

  if (!isLikelyTable && !isLikelyChart) {
    return null;
  }

  return {
    type: "preformatted",
    text: paragraph.trim(),
    kind: isLikelyChart && !isLikelyTable ? "chart" : "table"
  };
};

const parseStructuredBlock = (paragraph: string): StructuredBlock => {
  return parseMarkdownTable(paragraph) || parseDelimitedTable(paragraph) || parsePreformattedBlock(paragraph) || {
    type: "paragraph",
    text: paragraph
  };
};

export const parseStructuredBlocks = (paragraphs: string[]): StructuredBlock[] =>
  paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => parseStructuredBlock(paragraph));
