import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstashEnv =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

if (!hasUpstashEnv && process.env.NODE_ENV === "development") {
  console.warn("[rate-limit] Disabled: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.");
}

export const ipRatelimit = hasUpstashEnv
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "murmur:rl:ip",
    })
  : null;

