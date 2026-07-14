import { TranslationDomain } from "@/lib/prompts";

export type ExtractedEntity = {
  chinese: string;
  english?: string;
  type: "person" | "place" | "organization" | "title" | "term" | "other";
};

// Common Chinese surnames (simplified heuristic for person detection).
const COMMON_SURNAMES = new Set([
  "王","李","張","张","劉","刘","陳","陈","楊","杨","黃","黄","趙","赵","吳","吴","周","徐","孫","孙","馬","马","朱","胡","郭","何","高","林","羅","罗","鄭","郑","梁","謝","谢","宋","唐","許","许","韓","韩","馮","冯","鄧","邓","曹","彭","曾","肖","田","董","袁","潘","于","余","董","葉","叶","杜","蘇","苏","魏","程","呂","吕","丁","沈","任","姚","盧","卢","傅","鐘","钟","姜","崔","譚","谭","廖","范","汪","陸","陆","金","石","戴","賈","贾","韋","韦","夏","付","方","白","鄒","邹","孟","熊","秦","邱","江","尹","薛","閆","闫","段","雷","侯","龍","龙","史","黎","賀","贺","顧","顾","毛","郝","龔","龚","邵","萬","万","錢","钱","嚴","严","覃","武","戴","莫","孔","白","向","湯","汤"
]);

// Common suffixes/prefixes that indicate an organization.
const ORG_KEYWORDS = [
  "公司","集團","集团","銀行","银行","協會","协会","學會","学会","研究院","研究所","醫院","医院","學校","学校","大學","大学","學院","学院","中心","出版社","報社","报社","電視台","电视台","電台","电台","局","處","处","科","署","廳","厅","部","委員會","委员会","法院","檢察院","检察院"," government"
];

// Place indicators.
const PLACE_KEYWORDS = [
  "省","市","縣","县","區","区","鄉","乡","鎮","镇","村","里","島","岛","山","河","湖","海","灣","湾","路","街","大道"
];

// Title indicators.
const TITLE_SUFFIXES = [
  "先生","女士","小姐","博士","教授","醫生","医生","律師","律师","法官","檢察官","检察官","校長","校长","院長","院长","局長","局长","處長","处长","科長","科长","主任","秘書","秘书","經理","经理","總裁","总裁","董事長","董事长","總經理","总经理","工程師","工程师","研究員","研究员","記者","记者","編輯","编辑","翻譯","翻译","作者","詩人","诗人","畫家","画家"
];

const HAN_RE = /\p{Script=Han}/u;

const isHanOnly = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed.length > 0 && Array.from(trimmed).every((c) => HAN_RE.test(c));
};

const countHanChars = (text: string): number =>
  Array.from(text).filter((c) => HAN_RE.test(c)).length;

/**
 * Heuristic entity extraction from Chinese text.
 * This does not call an LLM; it uses pattern matching for speed.
 * The results are meant as a starting glossary that the user can refine.
 */
export const extractEntitiesHeuristic = (text: string): ExtractedEntity[] => {
  const entities = new Map<string, ExtractedEntity>();

  const addEntity = (chinese: string, type: ExtractedEntity["type"]) => {
    const key = chinese.trim();
    if (!key || key.length < 2) return;
    // Skip already-known.
    if (entities.has(key)) return;
    entities.set(key, { chinese: key, type });
  };

  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("http")) continue;

    // 1. Detect person names: "張三" (surname + 1-2 chars), "張三丰" (surname + 2 chars).
    // Use a sliding window of 2–4 Han characters at sentence boundaries or after punctuation.
    const tokens = trimmed.split(/[，。！？；：、\s「」『』（）【】《》“”‘’"]/);
    for (const token of tokens) {
      const t = token.trim();
      if (t.length < 2 || t.length > 5) continue;
      const chars = Array.from(t);
      // Must start with a common surname.
      if (!COMMON_SURNAMES.has(chars[0])) continue;
      // Rest must be Han.
      if (!chars.slice(1).every((c) => HAN_RE.test(c))) continue;
      // Avoid single-char given names with common words.
      if (t.length === 2 && (chars[1] === "生" || chars[1] === "氏")) continue;
      addEntity(t, "person");
    }

    // 2. Organization names — look for keywords.
    for (const kw of ORG_KEYWORDS) {
      let idx = trimmed.indexOf(kw);
      while (idx !== -1) {
        // Extract a window around the keyword.
        const start = Math.max(0, idx - 8);
        const end = idx + kw.length + 8;
        const candidate = trimmed.slice(start, end).trim();
        const hanCount = countHanChars(candidate);
        // Keep if the phrase is predominantly Chinese and not too long.
        if (hanCount >= 2 && candidate.length <= 20) {
          // Refine: take the longest Chinese-only substring containing the keyword.
          const refined = refineChinesePhrase(candidate, kw);
          if (refined && refined.length >= 2 && refined.length <= 18) {
            addEntity(refined, "organization");
          }
        }
        idx = trimmed.indexOf(kw, idx + 1);
      }
    }

    // 3. Place names.
    for (const kw of PLACE_KEYWORDS) {
      let idx = trimmed.indexOf(kw);
      while (idx !== -1) {
        const start = Math.max(0, idx - 6);
        const end = idx + kw.length + 4;
        let candidate = trimmed.slice(start, end).trim();
        // Strip leading/trailing punctuation.
        candidate = candidate.replace(/^[，。！？；：、\s]+/, "").replace(/[，。！？；：、\s]+$/, "");
        const hanCount = countHanChars(candidate);
        if (hanCount >= 2 && candidate.length <= 14) {
          const refined = refineChinesePhrase(candidate, kw);
          if (refined && refined.length >= 2 && !isGenericPlace(refined)) {
            addEntity(refined, "place");
          }
        }
        idx = trimmed.indexOf(kw, idx + 1);
      }
    }

    // 4. Titles.
    for (const suffix of TITLE_SUFFIXES) {
      let idx = trimmed.indexOf(suffix);
      while (idx !== -1) {
        const start = Math.max(0, idx - 10);
        let candidate = trimmed.slice(start, idx + suffix.length).trim();
        candidate = candidate.replace(/^[^\p{Script=Han}]+/u, "");
        const hanCount = countHanChars(candidate);
        if (hanCount >= 1 && candidate.length <= 14) {
          if (isHanOnly(candidate)) {
            addEntity(candidate, "title");
          }
        }
        idx = trimmed.indexOf(suffix, idx + 1);
      }
    }
  }

  // Deduplicate: remove entities that are substrings of longer entities of the same type.
  const list = Array.from(entities.values());
  const filtered = list.filter((entity) => {
    const longerSameType = list.some(
      (other) =>
        other !== entity &&
        other.type === entity.type &&
        other.chinese.includes(entity.chinese) &&
        other.chinese.length > entity.chinese.length
    );
    return !longerSameType;
  });

  // Sort: persons first, then organizations, places, titles, others.
  const typeOrder: Record<ExtractedEntity["type"], number> = {
    person: 0,
    organization: 1,
    place: 2,
    title: 3,
    term: 4,
    other: 5
  };

  return filtered.sort((a, b) => {
    const orderDiff = typeOrder[a.type] - typeOrder[b.type];
    if (orderDiff !== 0) return orderDiff;
    return a.chinese.localeCompare(b.chinese, "zh-Hans-CN");
  });
};

/**
 * Extract the longest Chinese-only substring containing the keyword.
 */
function refineChinesePhrase(text: string, keyword: string): string {
  // Find keyword position.
  const idx = text.indexOf(keyword);
  if (idx === -1) return text;

  // Expand left and right while characters are Han.
  const chars = Array.from(text);
  let start = idx;
  while (start > 0 && HAN_RE.test(chars[start - 1])) {
    start -= 1;
  }
  let end = idx + Array.from(keyword).length;
  while (end < chars.length && HAN_RE.test(chars[end])) {
    end += 1;
  }
  return chars.slice(start, end).join("");
}

const GENERIC_PLACES = new Set([
  "省市","省市縣","省市區","縣市","市區","鄉鎮","村里","山區","山腳","山頂","海邊","海灣"
]);

function isGenericPlace(text: string): boolean {
  return GENERIC_PLACES.has(text) || text.length < 3;
}

/**
 * Uses a lightweight LLM call to extract named entities with English glosses.
 * This runs once at the start of translation (on the first chunk or a sample
 * of text) and returns candidates the user can lock in.
 */
export const extractEntitiesWithLlm = async ({
  text,
  apiKey,
  model,
  domain,
  endpoint,
  headers
}: {
  text: string;
  apiKey: string;
  model: string;
  domain: TranslationDomain;
  endpoint: string;
  headers?: Record<string, string>;
}): Promise<ExtractedEntity[]> => {
  const domainNote: Record<TranslationDomain, string> = {
    general: "",
    historical: " Pay special attention to historical offices, reign titles, era names, and period institutions.",
    legal: " Pay special attention to legal roles, court names, statutory terms, and contractual parties.",
    medical: " Pay special attention to anatomical terms, drug names, diagnoses, and medical institutions.",
    literary: " Pay special attention to characters, fictional places, and allusive proper names."
  };

  const prompt = `You are a named-entity extraction assistant for Chinese-to-English translation.

Task: Read the following Chinese text sample and extract named entities (people, places, organizations, titles, and specialized terms) that should be translated consistently across the document.

For each entity, output a JSON object with:
- "chinese": the Chinese name exactly as it appears
- "english": your recommended English translation or romanization
- "type": one of "person", "place", "organization", "title", "term", "other"

Rules:
- Only include entities that appear in the text.
- Do not include generic common words (e.g., 中國, 美國 as generic country names unless they have specific period context).
- Prefer established English equivalents when they exist.${domainNote[domain] || ""}

Output ONLY a JSON array. No markdown, no explanations.

TEXT SAMPLE:
${text.slice(0, 2500)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You extract named entities and return only a JSON array." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return [];
  }

  const raw = payload?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") {
    return [];
  }

  // Strip markdown fences if present.
  const cleaned = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Array<{ chinese?: string; english?: string; type?: string }>;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item.chinese && typeof item.chinese === "string")
      .map((item) => ({
        chinese: item.chinese!.trim(),
        english: item.english?.trim() || undefined,
        type: normalizeType(item.type)
      }))
      .filter((e) => e.chinese.length >= 2);
  } catch {
    return [];
  }
};

const normalizeType = (raw?: string): ExtractedEntity["type"] => {
  if (!raw) return "other";
  const lower = raw.toLowerCase().trim();
  if (lower.includes("person")) return "person";
  if (lower.includes("place") || lower.includes("location")) return "place";
  if (lower.includes("org") || lower.includes("institution")) return "organization";
  if (lower.includes("title") || lower.includes("role")) return "title";
  if (lower.includes("term") || lower.includes("concept")) return "term";
  return "other";
};
