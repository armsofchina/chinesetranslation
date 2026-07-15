import {
  SegmentQaFact,
  SegmentQaReport,
  SegmentQaTerm,
  SegmentQaWarning,
  TranslationChunk
} from "@/lib/types";

const HAN_RE = /\p{Script=Han}/gu;
const FULLWIDTH_ASCII_START = 0xff01;
const FULLWIDTH_ASCII_END = 0xff5e;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const toHalfWidth = (value: string): string =>
  Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code >= FULLWIDTH_ASCII_START && code <= FULLWIDTH_ASCII_END) {
        return String.fromCharCode(code - 0xfee0);
      }
      return character;
    })
    .join("");

const pad = (value: string | number): string => String(value).padStart(2, "0");

const extractDates = (text: string): Map<string, string> => {
  const normalized = toHalfWidth(text);
  const dates = new Map<string, string>();
  const add = (source: string, year: string | number, month: string | number, day: string | number) => {
    const numericMonth = Number(month);
    const numericDay = Number(day);
    if (numericMonth >= 1 && numericMonth <= 12 && numericDay >= 1 && numericDay <= 31) {
      dates.set(`date:${year}-${pad(numericMonth)}-${pad(numericDay)}`, source);
    }
  };

  for (const match of normalized.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]?/g)) {
    add(match[0], match[1], match[2], match[3]);
  }
  for (const match of normalized.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    add(match[0], match[1], match[2], match[3]);
  }
  for (const match of normalized.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g)) {
    add(match[0], match[3], match[1], match[2]);
  }
  for (const match of normalized.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi
  )) {
    add(match[0], match[3], MONTHS[match[1].toLowerCase()], match[2]);
  }
  for (const match of normalized.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})\b/gi
  )) {
    add(match[0], match[3], MONTHS[match[2].toLowerCase()], match[1]);
  }
  return dates;
};

const extractPercentages = (text: string): Map<string, string> => {
  const percentages = new Map<string, string>();
  for (const match of toHalfWidth(text).matchAll(/[-+]?\d+(?:[,.]\d+)*\s*%/g)) {
    percentages.set(`percentage:${match[0].replace(/[\s,]/g, "")}`, match[0]);
  }
  return percentages;
};

const extractCurrency = (text: string): Map<string, string> => {
  const currency = new Map<string, string>();
  const normalized = toHalfWidth(text);
  for (const match of normalized.matchAll(
    /(?:[$¥￥€£]\s*[-+]?\d+(?:[,.]\d+)*|[-+]?\d+(?:[,.]\d+)*\s*(?:元|圓|圆|人民幣|人民币|美元|港元|新台幣|新台币|RMB|CNY|USD|HKD|TWD))/gi
  )) {
    const numeric = match[0].match(/[-+]?\d+(?:[,.]\d+)*/)?.[0]?.replaceAll(",", "");
    if (numeric) {
      currency.set(`currency:${numeric}`, match[0]);
    }
  }
  return currency;
};

const extractNumbers = (text: string): Map<string, string> => {
  const numbers = new Map<string, string>();
  for (const match of toHalfWidth(text).matchAll(/[-+]?\d+(?:[,.]\d+)*/g)) {
    const normalized = match[0].replaceAll(",", "");
    numbers.set(`number:${normalized}`, match[0]);
  }
  return numbers;
};

const toFacts = (source: string, target: string): SegmentQaFact[] => {
  const sourceGroups = [
    ["date", extractDates(source), extractDates(target)],
    ["percentage", extractPercentages(source), extractPercentages(target)],
    ["currency", extractCurrency(source), extractCurrency(target)],
    ["number", extractNumbers(source), extractNumbers(target)]
  ] as const;

  const facts: SegmentQaFact[] = [];
  const seenNumericValues = new Set<string>();
  for (const [kind, sourceFacts, targetFacts] of sourceGroups) {
    for (const [normalized, original] of sourceFacts) {
      const numericValue = normalized.split(":").slice(1).join(":");
      if (kind === "number" && seenNumericValues.has(numericValue)) {
        continue;
      }
      if (kind !== "number") {
        const containedNumbers = original.match(/\d+(?:[,.]\d+)*/g) ?? [];
        containedNumbers.forEach((number) => seenNumericValues.add(number.replaceAll(",", "")));
      }
      facts.push({
        kind,
        source: original,
        normalized,
        matched: targetFacts.has(normalized) || (kind !== "number" && extractNumbers(target).has(`number:${numericValue}`))
      });
    }
  }
  return facts;
};

const toTerms = (source: string, target: string, glossary: Record<string, string>): SegmentQaTerm[] =>
  Object.entries(glossary)
    .filter(([chinese, english]) => chinese.trim() && english.trim() && source.includes(chinese))
    .map(([chinese, expectedEnglish]) => ({
      chinese,
      expectedEnglish,
      matched: target.toLocaleLowerCase().includes(expectedEnglish.toLocaleLowerCase())
    }));

export const buildSegmentQaReport = (
  chunk: Pick<TranslationChunk, "id" | "pageNumber" | "originalChinese">,
  translatedEnglish: string,
  glossary: Record<string, string> = {}
): SegmentQaReport => {
  const source = chunk.originalChinese.trim();
  const target = translatedEnglish.trim();
  const facts = toFacts(source, target);
  const terms = toTerms(source, target, glossary);
  const residualHanCharacters = target.match(HAN_RE)?.length ?? 0;
  const warnings: SegmentQaWarning[] = [];

  if (!target) {
    warnings.push({ code: "empty", severity: "error", message: "This segment has no English translation." });
  }
  if (facts.some((fact) => !fact.matched)) {
    warnings.push({
      code: "numbers",
      severity: "error",
      message: "One or more dates, numbers, percentages, or currency amounts were not found in the translation."
    });
  }
  if (terms.some((term) => !term.matched)) {
    warnings.push({
      code: "glossary",
      severity: "warning",
      message: "One or more locked glossary terms may not use the approved English wording."
    });
  }
  if (residualHanCharacters >= 4 && residualHanCharacters / Math.max(target.length, 1) > 0.06) {
    warnings.push({
      code: "source-leak",
      severity: "warning",
      message: "A noticeable amount of Chinese remains in the English output."
    });
  }
  const lengthRatio = target.length / Math.max(source.length, 1);
  if (target && source.length > 40 && (lengthRatio < 0.25 || lengthRatio > 6)) {
    warnings.push({
      code: "length",
      severity: "warning",
      message: "Translation length is unusual relative to the source."
    });
  }

  return {
    version: 1,
    segmentId: chunk.id,
    pageNumber: chunk.pageNumber,
    sourceCharacters: source.length,
    targetCharacters: target.length,
    residualHanCharacters,
    facts,
    terms,
    warnings
  };
};
