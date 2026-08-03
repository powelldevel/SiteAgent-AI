import { NextResponse } from "next/server";
import { recordOperationalEvent } from "@/lib/observability";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase";

export type AuthContext =
  | {
      ok: true;
      userId: string;
      email: string;
      companyId: string;
      name: string;
      role: string;
      accessToken: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

type UserProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  company_id: string | null;
};

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getAuthContext(request: Request): Promise<AuthContext> {
  const route = new URL(request.url).pathname;

  if (!isSupabaseServerConfigured()) {
    await recordOperationalEvent({
      route,
      action: "auth_failure",
      status: "failed",
      message: "Supabase server configuration is unavailable.",
      metadata: { httpStatus: 503 },
    });
    return {
      ok: false,
      response: NextResponse.json({
        connected: false,
        message: "Saving is temporarily unavailable.",
      }, { status: 503 }),
    };
  }

  const supabase = getSupabaseServerClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    await recordOperationalEvent({
      route,
      action: "auth_failure",
      status: "blocked",
      message: "Authentication token is missing.",
      metadata: { httpStatus: 401 },
      persist: false,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { connected: true, error: "Sign in to continue." },
        { status: 401 },
      ),
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    await recordOperationalEvent({
      route,
      action: "auth_failure",
      status: "blocked",
      message: "Authentication token is invalid.",
      metadata: { httpStatus: 401 },
    });
    return {
      ok: false,
      response: NextResponse.json({ connected: true, error: "Your sign-in session is invalid." }, { status: 401 }),
    };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("users")
    .select("id,email,name,role,company_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const profile = profileData as UserProfileRow | null;

  if (profileError) {
    await recordOperationalEvent({
      userId: userData.user.id,
      route,
      action: "auth_failure",
      status: "failed",
      message: "Could not load the authenticated user profile.",
      metadata: { httpStatus: 500, code: profileError.code ?? null },
    });
    return {
      ok: false,
      response: NextResponse.json({ connected: true, error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile?.company_id) {
    await recordOperationalEvent({
      userId: userData.user.id,
      route,
      action: "auth_failure",
      status: "blocked",
      message: "Authenticated user has no company.",
      metadata: { httpStatus: 403 },
    });
    return {
      ok: false,
      response: NextResponse.json(
        { connected: true, error: "Create your company profile before continuing.", needsOnboarding: true },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    userId: userData.user.id,
    email: profile.email ?? userData.user.email ?? "",
    companyId: profile.company_id,
    name: profile.name ?? "User",
    role: profile.role ?? "owner",
    accessToken: token,
  };
}
