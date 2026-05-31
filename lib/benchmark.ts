import { createHash } from "crypto";

/** Human-readable slug for the benchmark post (documented in UI / seed). */
export const BENCHMARK_POST_SLUG = "benchmark-post-tree";

/** Deterministic MongoDB ObjectId (24 hex) derived from the slug. */
export function slugToObjectId(slug: string): string {
  return createHash("sha256").update(slug).digest("hex").slice(0, 24);
}

export const BENCHMARK_POST_ID = slugToObjectId(BENCHMARK_POST_SLUG);

export const BENCHMARK_COMMENT_TARGET = 4000;
export const BENCHMARK_ROOT_COMMENT_COUNT = 10;
