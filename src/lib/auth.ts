import { NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase";

export type AuthContext =
  | {
      ok: true;
      userId: string;
      email: string;
      companyId: string;
      name: string;
      role: string;
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
  if (!isSupabaseServerConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({
        connected: false,
        message: "Demo mode: Supabase is not connected yet.",
      }),
    };
  }

  const supabase = getSupabaseServerClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return {
      ok: false,
      response: NextResponse.json(
        { connected: true, error: "Sign in to use saved jobs and operations history." },
        { status: 401 },
      ),
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
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
    return {
      ok: false,
      response: NextResponse.json({ connected: true, error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile?.company_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { connected: true, error: "Create your company profile before saving operations packs.", needsOnboarding: true },
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
  };
}
