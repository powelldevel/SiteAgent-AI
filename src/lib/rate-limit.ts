import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getRequestKey(request: Request, fallback = "anonymous") {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const bearer = request.headers.get("authorization")?.slice(0, 32);

  return bearer || forwarded || realIp || fallback;
}

export function rateLimit(key: string, options: { limit: number; windowMs: number }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= options.limit) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
