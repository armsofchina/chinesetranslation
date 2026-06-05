export type TranslationDomain = "general" | "historical" | "legal" | "medical" | "literary";

export const DOMAINS: Array<{ id: TranslationDomain; label: string; description: string }> = [
  {
    id: "general",
    label: "General",
    description: "Everyday Chinese — news, essays, correspondence, manuals"
  },
  {
    id: "historical",
    label: "Historical Documents",
    description: "Archives, gazetteers, official records, period sources"
  },
  {
    id: "legal",
    label: "Legal",
    description: "Statutes, contracts, court filings, regulatory text"
  },
  {
    id: "medical",
    label: "Medical",
    description: "Clinical notes, case reports, pharmacology, anatomy"
  },
  {
    id: "literary",
    label: "Literary",
    description: "Classical and modern prose, poetry, criticism"
  }
];

const BASE_SYSTEM_PROMPT = `You are a professional Chinese-to-English translator. Translate the provided text into clear, natural English. Preserve meaning, tone, names, dates, numbers, headings, lists, technical terms, and paragraph structure. Do not summarize. Do not add information not present in the original. Output only the English translation.`;

const HISTORICAL_SYSTEM_PROMPT = `You are a specialist translator of Chinese historical and archival documents into English. Your translations are precise, documentary in tone, and preserve the register of official or period sources.

Guidelines:
- Translate titles, offices, and institutional names accurately (e.g., 知府 = Magistrate; 翰林院 = Hanlin Academy). When a well-known English equivalent exists, use it. When none exists, romanize (pinyin) and provide a brief parenthetical gloss on first occurrence.
- Preserve era dates, reign titles, and cyclical dates (stem-branch) in a standard scholarly format.
- Maintain the formal, detached tone typical of archival records.
- Do not modernize anachronistic terms; preserve the historical valence.
- Output only the English translation.`;

const LEGAL_SYSTEM_PROMPT = `You are a certified legal translator specializing in Chinese-to-English statutory and contractual text. Your output is suitable for court filings, compliance review, and international arbitration.

Guidelines:
- Use established English legal terminology (e.g., 原告 = plaintiff; 被告 = defendant; 合同 = contract; 違約 = breach; 管轄權 = jurisdiction).
- Preserve all defined terms, numbering, cross-references, and list structure exactly.
- Do not paraphrase; mirror the logical structure and conditional scope of the original.
- Preserve dates, monetary amounts, percentages, and article references verbatim.
- Output only the English translation.`;

const MEDICAL_SYSTEM_PROMPT = `You are a medical translator with native-level fluency in Chinese and English. You translate clinical documents, case reports, pharmacology texts, and anatomical descriptions.

Guidelines:
- Use standard international medical terminology (ICD, SI units, anatomical Latin where appropriate).
- Translate symptoms, diagnoses, drug names, dosages, and lab values precisely.
- Preserve patient identifiers as anonymized placeholders when present.
- Maintain the clinical register: objective, concise, and unambiguous.
- Do not interpret clinical significance; translate the text as written.
- Output only the English translation.`;

const LITERARY_SYSTEM_PROMPT = `You are a literary translator translating Chinese prose and poetry into English. You respect the author's voice, rhythm, and imagery while producing readable, evocative English.

Guidelines:
- Preserve figurative language, imagery, and tonal shifts. Do not flatten metaphors into abstractions.
- For classical or allusive references, translate the surface meaning and, on first occurrence, add a brief unobtrusive gloss if the allusion is essential.
- Retain paragraph breaks, dialogue formatting, and narrative pacing.
- In poetry, preserve lineation and stanza structure; strive for rhythmic fidelity.
- Output only the English translation.`;

const PROMPTS: Record<TranslationDomain, string> = {
  general: BASE_SYSTEM_PROMPT,
  historical: HISTORICAL_SYSTEM_PROMPT,
  legal: LEGAL_SYSTEM_PROMPT,
  medical: MEDICAL_SYSTEM_PROMPT,
  literary: LITERARY_SYSTEM_PROMPT
};

/**
 * Returns the system prompt for the selected domain.
 */
export const getSystemPrompt = (domain: TranslationDomain): string => PROMPTS[domain] || PROMPTS.general;

/**
 * Returns the vision (OCR) system prompt variant for the selected domain.
 * It overlays domain-specific instructions on top of the OCR capability.
 */
export const getVisionSystemPrompt = (domain: TranslationDomain): string => {
  const base = `You are a professional Chinese-to-English translator with OCR capabilities. Read Chinese text from the provided image and translate it into clear, natural English. Preserve meaning, tone, names, dates, numbers, headings, lists, and paragraph structure. For tables, output clean markdown tables when possible. For chart labels or plotted data visible in the image, preserve values and labels accurately in readable text. Do not summarize. Do not add information not present in the image. Output only the English translation.`;

  const domainNote: Record<TranslationDomain, string> = {
    general: "",
    historical: " Treat the source as a historical/archival document: preserve formal register, period titles, and era dates.",
    legal: " Treat the source as a legal document: use established English legal terminology and preserve all defined terms, numbering, and cross-references.",
    medical: " Treat the source as a medical/clinical document: use standard international medical terminology and preserve all dosages, lab values, and anatomical terms.",
    literary: " Treat the source as a literary text: preserve figurative language, rhythm, and narrative pacing."
  };

  return `${base}${domainNote[domain] || ""}`;
};

/**
 * Builds a user prompt that includes:
 * - The domain-specific system prompt
 * - Rolling context summary from previous chunks
 * - A glossary of locked preferred translations
 * - The Chinese text to translate
 */
export type TranslationContextInput = {
  text: string;
  domain: TranslationDomain;
  /** 1–2 sentence summary of the previous chunk, for continuity. */
  previousSummary?: string;
  /** Locked preferred translations (Chinese → English). */
  glossary?: Record<string, string>;
};

export const buildTranslationMessages = (input: TranslationContextInput): Array<{ role: "system" | "user"; content: string }> => {
  const system = getSystemPrompt(input.domain);

  let userContent = "";

  if (input.previousSummary) {
    userContent += `Context from previous section: ${input.previousSummary.trim()}\n\n`;
  }

  if (input.glossary && Object.keys(input.glossary).length > 0) {
    const entries = Object.entries(input.glossary)
      .map(([cn, en]) => `- "${cn}" → "${en}"`)
      .join("\n");
    userContent += `Use these exact translations for the following terms:\n${entries}\n\n`;
  }

  userContent += `Translate this Chinese text into clean English:\n\n${input.text}`;

  return [
    { role: "system", content: system },
    { role: "user", content: userContent }
  ];
};

/**
 * Builds the vision/OCR translation messages with the same context support.
 */
export const buildVisionTranslationMessages = (input: TranslationContextInput): Array<{ role: "system" | "user"; content: unknown }> => {
  const system = getVisionSystemPrompt(input.domain);

  let userText = "Translate all readable Chinese text in this image into clean English.";

  if (input.previousSummary) {
    userText += `\n\nContext from previous section: ${input.previousSummary.trim()}`;
  }

  if (input.glossary && Object.keys(input.glossary).length > 0) {
    const entries = Object.entries(input.glossary)
      .map(([cn, en]) => `- "${cn}" → "${en}"`)
      .join("\n");
    userText += `\n\nUse these exact translations for the following terms:\n${entries}`;
  }

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: (input as any).imageDataUrl || "" } }
      ]
    }
  ];
};
