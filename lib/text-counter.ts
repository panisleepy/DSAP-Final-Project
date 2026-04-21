const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const TAG_REGEX = /(^|\s)([@#][\p{L}\p{N}_]+)/giu;

const MAX_LENGTH = 2000;

export function measureTweetLength(text: string) {
  if (!text) {
    return { length: 0, remaining: MAX_LENGTH, isValid: true };
  }

  const normalized = text
    .replace(URL_REGEX, (match) => "x".repeat(Math.min(match.length, 23)))
    .replace(TAG_REGEX, (substring, leading) => leading ?? "");

  const length = [...normalized.trim()].length;
  const remaining = MAX_LENGTH - length;

  return {
    length,
    remaining,
    isValid: remaining >= 0 && length > 0,
  };
}

export function enforceTweetLength(text: string) {
  const { isValid } = measureTweetLength(text);
  return isValid;
}

