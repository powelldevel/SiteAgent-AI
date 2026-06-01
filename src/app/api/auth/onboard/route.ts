import { NextResponse } from "next/server";
import { z } from "zod";
import { getBearerToken } from "@/lib/auth";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase";

const onboardSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type IdRow = { id: string };
type UserProfileRow = { id: string; company_id: string | null };

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Demo mode: Supabase is not connected yet.",
    });
  }

  const supabase = getSupabaseServerClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return NextResponse.json({ connected: true, error: "Sign in before creating a company profile." }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ connected: true, error: "Your sign-in session is invalid." }, { status: 401 });
  }

  const parsed = onboardSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Company profile is incomplete.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existingData, error: existingError } = await supabase
    .from("users")
    .select("id,company_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const existing = existingData as UserProfileRow | null;

  if (existingError) {
    return NextResponse.json({ connected: true, error: existingError.message }, { status: 500 });
  }

  if (existing?.company_id) {
    return NextResponse.json({
      connected: true,
      profile: {
        id: userData.user.id,
        email: userData.user.email,
        name: parsed.data.name,
        role: "owner",
        companyId: existing.company_id,
      },
    });
  }

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.companyName,
      phone: parsed.data.phone || null,
      email: userData.user.email,
      address: parsed.data.address || null,
    })
    .select("id")
    .single();
  const company = companyData as IdRow;

  if (companyError) {
    return NextResponse.json({ connected: true, error: companyError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("users").upsert({
    id: userData.user.id,
    email: userData.user.email ?? "",
    name: parsed.data.name,
    role: "owner",
    company_id: company.id,
  });

  if (profileError) {
    return NextResponse.json({ connected: true, error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    connected: true,
    profile: {
      id: userData.user.id,
      email: userData.user.email,
      name: parsed.data.name,
      role: "owner",
      companyId: company.id,
    },
  });
}
