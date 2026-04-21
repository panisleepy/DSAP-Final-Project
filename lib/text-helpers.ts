const MENTION_REGEX = /(^|[^\w])@([a-zA-Z0-9_]{3,24})/g;
const HASHTAG_REGEX = /(^|[^\w])#([a-zA-Z0-9_]{1,80})/g;

export function extractMentions(content: string): string[] {
  const mentions = new Set<string>();
  if (!content) return [];

  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const alias = match[2]?.toLowerCase();
    if (alias) {
      mentions.add(alias);
    }
  }

  return [...mentions];
}

export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  if (!content) return [];

  let match: RegExpExecArray | null;
  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    const tag = match[2]?.toLowerCase();
    if (tag) {
      tags.add(tag);
    }
  }

  return [...tags];
}

export function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export function createPreviewFromContent(content: string, length = 140) {
  return content.trim().slice(0, length);
}
