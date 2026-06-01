const CIRCLED_OR_SUPERSCRIPT_NUMBER_CLASS = "\u00B9\u00B2\u00B3\u2070-\u2079\u2460-\u24FF\u2776-\u277F";
const HAN_CLASS = "\\p{Script=Han}";
const ALNUM_CLASS = "A-Za-z0-9";

const toHalfWidthAscii = (text: string): string =>
  Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 0x3000) {
        return " ";
      }
      if (code >= 0xff01 && code <= 0xff5e) {
        return String.fromCharCode(code - 0xfee0);
      }
      return char;
    })
    .join("");

export const cleanExtractedChineseText = (text: string): string => {
  if (!text.trim()) {
    return "";
  }

  let cleaned = toHalfWidthAscii(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  // Remove extraction artifacts between Chinese characters.
  cleaned = cleaned.replace(new RegExp(`(${HAN_CLASS})\\s+(${HAN_CLASS})`, "gu"), "$1$2");
  // Remove artificial spacing between Chinese and ASCII alphanumerics.
  cleaned = cleaned.replace(new RegExp(`(${HAN_CLASS})\\s+([${ALNUM_CLASS}])`, "gu"), "$1$2");
  cleaned = cleaned.replace(new RegExp(`([${ALNUM_CLASS}])\\s+(${HAN_CLASS})`, "gu"), "$1$2");
  // Join split numbers (e.g. "2 0 1 8" -> "2018").
  cleaned = cleaned.replace(/([0-9])\s+([0-9])/g, "$1$2");
  // Remove spacing between Chinese text and circled/superscript note markers.
  cleaned = cleaned.replace(
    new RegExp(`(${HAN_CLASS}|[。！？；：，、）】》〉」』])\\s+([${CIRCLED_OR_SUPERSCRIPT_NUMBER_CLASS}])`, "gu"),
    "$1$2"
  );
  cleaned = cleaned.replace(
    new RegExp(`([${CIRCLED_OR_SUPERSCRIPT_NUMBER_CLASS}])\\s+(${HAN_CLASS})`, "gu"),
    "$1$2"
  );
  // Remove spaces before punctuation and after opening punctuation.
  cleaned = cleaned
    .replace(/\s+([，。！？；：、,.!?;:）】》〉」』])/g, "$1")
    .replace(/([（【《〈「『])\s+/g, "$1");

  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
