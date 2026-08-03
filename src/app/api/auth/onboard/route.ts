import { NextResponse } from "next/server";
import { z } from "zod";
import { getBearerToken } from "@/lib/auth";
import { recordPilotEvent } from "@/lib/pilot-analytics";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase";

const onboardSchema = z.object({
  name: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type IdRow = { id: string };
type UserProfileRow = { id: string; company_id: string | null };

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Accounts are temporarily unavailable.",
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
    return NextResponse.json({ connected: true, error: "Add your name and company name to continue.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existingData, error: existingError } = await supabase
    .from("users")
    .select("id,company_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const existing = existingData as UserProfileRow | null;

  if (existingError) {
    return NextResponse.json({ connected: true, error: "We could not load your account. Please try again." }, { status: 500 });
  }

  if (existing?.company_id) {
    return NextResponse.json({
      connected: true,
      profile: {
        id: userData.user.id,
        email: userData.user.email,
      name: parsed.data.name.trim(),
      role: "owner",
      companyId: existing.company_id,
      companyName: parsed.data.companyName.trim(),
        phone: parsed.data.phone ?? "",
        address: parsed.data.address ?? "",
        vatRegistered: false,
        vatRate: 0.15,
      },
    });
  }

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.companyName.trim(),
      phone: parsed.data.phone || null,
      email: userData.user.email,
      address: parsed.data.address || null,
    })
    .select("id")
    .single();
  const company = companyData as IdRow;

  if (companyError) {
    return NextResponse.json({ connected: true, error: "We could not create your company profile. Please try again." }, { status: 500 });
  }

  const { error: profileError } = await supabase.from("users").upsert({
    id: userData.user.id,
    email: userData.user.email ?? "",
    name: parsed.data.name.trim(),
    role: "owner",
    company_id: company.id,
  });

  if (profileError) {
    return NextResponse.json({ connected: true, error: "We could not create your company profile. Please try again." }, { status: 500 });
  }

  await recordPilotEvent(supabase, company.id, userData.user.id, "sign_up");
  await recordPilotEvent(supabase, company.id, userData.user.id, "company_created");

  return NextResponse.json({
    connected: true,
    profile: {
      id: userData.user.id,
      email: userData.user.email,
      name: parsed.data.name.trim(),
      role: "owner",
      companyId: company.id,
      companyName: parsed.data.companyName.trim(),
      phone: parsed.data.phone ?? "",
      address: parsed.data.address ?? "",
      vatRegistered: false,
      vatRate: 0.15,
    },
  });
}
