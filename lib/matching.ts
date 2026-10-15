export type KeywordMatcher = {
  keywords: string[];
  match: (text: string) => string | null;
};

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

const isWordCharacter = (value: string | undefined) =>
  value !== undefined && /[\p{L}\p{N}\p{M}_]/u.test(value);

const hasTokenBoundaries = (text: string, start: number, length: number) => {
  const previous = start > 0 ? text[start - 1] : undefined;
  const next = text[start + length];

  return !isWordCharacter(previous) && !isWordCharacter(next);
};

export const parseKeywords = (value: string): string[] => {
  const seen = new Set<string>();

  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword) => {
      const normalized = normalize(keyword);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

export const createKeywordMatcher = (keywords: string[]): KeywordMatcher => {
  const configured = keywords.map((original) => ({
    original,
    normalized: normalize(original),
  }));

  return {
    keywords: configured.map(({ original }) => original),
    match(text) {
      const normalizedText = normalize(text);

      for (const keyword of configured) {
        let fromIndex = 0;

        while (fromIndex <= normalizedText.length - keyword.normalized.length) {
          const index = normalizedText.indexOf(keyword.normalized, fromIndex);
          if (index === -1) break;
          if (hasTokenBoundaries(normalizedText, index, keyword.normalized.length)) {
            return keyword.original;
          }
          fromIndex = index + keyword.normalized.length;
        }
      }

      return null;
    },
  };
};
