import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const feedbackSchema = z.object({
  rating: z.enum(["good", "ok", "bad"]),
  message: z.string().trim().min(8).max(1200),
  page: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(`feedback:post:${getRequestKey(request)}`, { limit: 12, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, error: "Feedback is temporarily unavailable." }, { status: 503 });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = feedbackSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Add a short note before sending feedback." }, { status: 400 });
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const recorded = await recordPilotEvent(supabase, auth.companyId, auth.userId, "feedback_submitted", {
    rating: parsed.data.rating,
    page: parsed.data.page ?? "settings",
    message: parsed.data.message,
    hasMessage: true,
  });

  if (!recorded) {
    return NextResponse.json({ connected: true, error: "Could not save your feedback." }, { status: 500 });
  }

  return NextResponse.json({ connected: true, message: "Feedback sent. Thank you." });
}
