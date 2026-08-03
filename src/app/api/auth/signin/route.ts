import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAuthClient, isSupabaseUserClientConfigured } from "@/lib/supabase";
import { recordOperationalEvent } from "@/lib/observability";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const limited = rateLimit(`auth:signin:${getRequestKey(request)}`, { limit: 20, windowMs: 60_000 });

  if (limited) {
    await recordOperationalEvent({
      route: "/api/auth/signin",
      action: "auth_failure",
      status: "blocked",
      message: "Sign-in rate limit exceeded.",
      metadata: { httpStatus: 429 },
    });
    return limited;
  }

  if (!isSupabaseUserClientConfigured()) {
    await recordOperationalEvent({
      route: "/api/auth/signin",
      action: "auth_failure",
      status: "failed",
      message: "Supabase authentication is unavailable.",
      metadata: { httpStatus: 503 },
    });
    return NextResponse.json({ connected: false, error: "Accounts are temporarily unavailable." }, { status: 503 });
  }

  const supabase = getSupabaseAuthClient();

  if (!supabase) {
    await recordOperationalEvent({
      route: "/api/auth/signin",
      action: "auth_failure",
      status: "failed",
      message: "Supabase authentication client is unavailable.",
      metadata: { httpStatus: 503 },
    });
    return NextResponse.json({ connected: false, error: "Accounts are temporarily unavailable." }, { status: 503 });
  }

  const parsed = authSchema.safeParse(await request.json());

  if (!parsed.success) {
    await recordOperationalEvent({
      route: "/api/auth/signin",
      action: "auth_failure",
      status: "blocked",
      message: "Sign-in payload validation failed.",
      metadata: { httpStatus: 400 },
    });
    return NextResponse.json({ connected: true, error: "Please check your email and password." }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
  });

  if (error || !data.session) {
    await recordOperationalEvent({
      userId: data.user?.id ?? null,
      route: "/api/auth/signin",
      action: "auth_failure",
      status: "blocked",
      message: "Sign-in credentials were rejected.",
      metadata: { httpStatus: 401, code: error?.code ?? null },
    });
    return NextResponse.json({ connected: true, error: "Wrong email or password." }, { status: 401 });
  }

  await recordOperationalEvent({
    userId: data.user.id,
    route: "/api/auth/signin",
    action: "auth_failure",
    status: "success",
    message: "User signed in.",
    persist: false,
  });

  return NextResponse.json({
    connected: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}
