const MENTION_REGEX = /@([a-zA-Z0-9_]{1,30})/g;
const HASHTAG_REGEX = /#([a-zA-Z0-9_]{1,50})/g;

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(text))) {
    const original = match[1];
    const lower = original.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(original);
  }
  return result;
}

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = HASHTAG_REGEX.exec(text))) {
    const original = match[1];
    const lower = original.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(original);
  }
  return result;
}
