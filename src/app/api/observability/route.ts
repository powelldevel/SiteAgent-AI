import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { recordOperationalEvent } from "@/lib/observability";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";

const frontendEventSchema = z.object({
  action: z.literal("frontend_error"),
  message: z.string().trim().min(1).max(500),
  metadata: z.object({
    source: z.string().trim().max(80),
    path: z.string().trim().max(200),
  }),
});

export async function POST(request: Request) {
  const limited = rateLimit(`observability:post:${getRequestKey(request)}`, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const auth = await getAuthContext(request);
  if (!auth.ok) return auth.response;

  const parsed = frontendEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid error report." }, { status: 400 });
  }

  await recordOperationalEvent({
    userId: auth.userId,
    companyId: auth.companyId,
    route: parsed.data.metadata.path,
    action: "frontend_error",
    status: "failed",
    message: parsed.data.message,
    metadata: { source: parsed.data.metadata.source },
  });

  return NextResponse.json({ recorded: true });
}
