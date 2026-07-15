import assert from "node:assert/strict";
import test from "node:test";
import { cleanExtractedChineseText } from "../lib/chineseTextCleanup.ts";

test("joins extraction spacing without deleting paragraph boundaries", () => {
  const source = "第一章\n\n上 海 公 司\n2 0 2 6 年 7 月";
  assert.equal(cleanExtractedChineseText(source), "第一章\n\n上海公司\n2026年7月");
});

test("preserves table-like tabs and meaningful line breaks", () => {
  const source = "项目\t金额\n服务\t1,200 元\n\n备注";
  assert.equal(cleanExtractedChineseText(source), "项目\t金额\n服务\t1,200元\n\n备注");
});
