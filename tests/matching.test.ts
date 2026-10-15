import { describe, expect, it } from "vitest";

import { createKeywordMatcher, parseKeywords } from "@/lib/matching";

describe("keyword matching", () => {
  it("matches complete words without case sensitivity", () => {
    const matcher = createKeywordMatcher(["Guide"]);

    expect(matcher.match("Can I get the GUIDE, please?")).toBe("Guide");
    expect(matcher.match("The guideline is useful")).toBeNull();
  });

  it("supports Unicode words and normalization", () => {
    const matcher = createKeywordMatcher(["أسعار", "café"]);

    expect(matcher.match("ممكن أعرف أسعار؟")).toBe("أسعار");
    expect(matcher.match("Tell me about CAFE\u0301!")).toBe("café");
  });

  it("returns the first configured match", () => {
    const matcher = createKeywordMatcher(["details", "price"]);

    expect(matcher.match("What is the price? Send details.")).toBe("details");
  });

  it("removes empty and normalized duplicate keywords", () => {
    expect(parseKeywords(" guide, ,GUIDE, pricing ")).toEqual([
      "guide",
      "pricing",
    ]);
  });
});
