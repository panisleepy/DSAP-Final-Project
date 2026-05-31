import type { RemotePattern } from "next/dist/shared/lib/image-config";

export const ALLOWED_IMAGE_REMOTE_PATTERNS: RemotePattern[] = [
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  { protocol: "https", hostname: "avatars.githubusercontent.com" },
  { protocol: "https", hostname: "i.pinimg.com" },
  { protocol: "https", hostname: "images.plurk.com" },
  { protocol: "https", hostname: "res.cloudinary.com" },
  { protocol: "https", hostname: "leading-yellow-09aefeqxcs.edgeone.app" },
];

export function isAllowedRemoteImageUrl(src: string | null | undefined): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    return ALLOWED_IMAGE_REMOTE_PATTERNS.some((pattern) => {
      if (pattern.protocol && pattern.protocol !== url.protocol.replace(":", "")) {
        return false;
      }
      return pattern.hostname === url.hostname;
    });
  } catch {
    return false;
  }
}
