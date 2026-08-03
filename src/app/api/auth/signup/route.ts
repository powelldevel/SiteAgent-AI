import { NextResponse } from "next/server";
import { z } from "zod";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAuthClient, getSupabaseServerClient, isSupabaseServerConfigured, isSupabaseUserClientConfigured } from "@/lib/supabase";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type IdRow = { id: string };

function authErrorMessage(error: unknown) {
  if (!error) return "We could not create your account. Please try again.";

  if (typeof error === "object" && "message" in error && typeof error.message === "string" && error.message !== "{}") {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return "This email is already registered. Try signing in.";
    }
    if (message.includes("password")) {
      return "Password must be at least 8 characters.";
    }
    if (message.includes("email")) {
      return "Please check your email and password.";
    }
    return "We could not create your account. Please try again.";
  }

  return "We could not create your account. Please try again.";
}

export async function POST(request: Request) {
  const limited = rateLimit(`auth:signup:${getRequestKey(request)}`, { limit: 12, windowMs: 60_000 });

  if (limited) {
    return limited;
  }

  if (!isSupabaseUserClientConfigured() || !isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, error: "Accounts are temporarily unavailable." }, { status: 503 });
  }

  const supabase = getSupabaseAuthClient();
  const server = getSupabaseServerClient();

  if (!supabase || !server) {
    return NextResponse.json({ connected: false, error: "Accounts are temporarily unavailable." }, { status: 503 });
  }

  const parsed = authSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Please check your email and password." }, { status: 400 });
  }

  const { email, password, name, companyName, phone, address } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existingProfile } = await server
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { connected: true, error: "This email is already registered. Try signing in." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        name: name?.trim() || null,
        company_name: companyName?.trim() || null,
      },
    },
  });

  if (error || !data.user) {
    return NextResponse.json({ connected: true, error: authErrorMessage(error) }, { status: 400 });
  }

  let profile = null;

  if (data.user && name?.trim() && companyName?.trim()) {
    const { data: companyData, error: companyError } = await server
      .from("companies")
      .insert({
        name: companyName.trim(),
        phone: phone || null,
        email: data.user.email,
        address: address || null,
      })
      .select("id")
      .single();

    if (companyError) {
      return NextResponse.json(
        { connected: true, error: "We could not create your company profile. Please try again." },
        { status: 500 },
      );
    }

    const company = companyData as IdRow;
    const { error: profileError } = await server.from("users").upsert({
      id: data.user.id,
      email: data.user.email ?? normalizedEmail,
      name: name.trim(),
      role: "owner",
      company_id: company.id,
    });

    if (profileError) {
      return NextResponse.json(
        { connected: true, error: "We could not create your account. Please try again." },
        { status: 500 },
      );
    }

    profile = {
      id: data.user.id,
      email: data.user.email ?? normalizedEmail,
      name: name.trim(),
      role: "owner",
      companyId: company.id,
      companyName: companyName.trim(),
      phone: phone ?? "",
      address: address ?? "",
      vatRegistered: false,
      vatRate: 0.15,
    };

    await recordPilotEvent(server, company.id, data.user.id, "sign_up");
    await recordPilotEvent(server, company.id, data.user.id, "company_created");
  }

  return NextResponse.json({
    connected: true,
    needsEmailConfirmation: !data.session,
    session: data.session
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
        }
      : null,
    user: data.user
      ? {
          id: data.user.id,
          email: data.user.email,
        }
      : null,
    profile,
  });
}
