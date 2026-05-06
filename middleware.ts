import { NextRequest, NextResponse } from "next/server";
import { ipRatelimit } from "@/lib/rateLimiter";

const PROTECTED_BASE_PATHS = ["/api/posts", "/api/post", "/api/comment", "/api/comments"];
const RATE_LIMITED_METHODS = new Set(["POST", "PUT", "DELETE"]);

function isProtectedApiPath(pathname: string) {
  return PROTECTED_BASE_PATHS.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip") || "unknown";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtectedApiPath(pathname)) {
    return NextResponse.next();
  }

  if (!RATE_LIMITED_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  if (!ipRatelimit) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;

  const result = await ipRatelimit.limit(key);

  if (!result.success) {
    const res = NextResponse.json(
      {
        error: "Too Many Requests",
        message: "你目前的操作太頻繁，請稍後再試。",
      },
      { status: 429 },
    );

    res.headers.set("X-RateLimit-Limit", result.limit.toString());
    res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    if (result.reset) {
      res.headers.set("X-RateLimit-Reset", result.reset.toString());
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

