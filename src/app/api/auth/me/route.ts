import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";
import { DEFAULT_VAT_RATE } from "@/lib/vat";

const companySettingsSchema = z.object({
  vatRegistered: z.boolean(),
  vatRate: z.number().min(0).max(1),
});

type CompanyRow = {
  name: string;
  phone: string | null;
  address: string | null;
  vat_registered: boolean;
  vat_rate: number | string;
};

async function loadCompany(accessToken: string, companyId: string) {
  const supabase = getSupabaseUserClient(accessToken);
  if (!supabase) return null;

  const { data } = await supabase
    .from("companies")
    .select("name,phone,address,vat_registered,vat_rate")
    .eq("id", companyId)
    .maybeSingle();

  return data as CompanyRow | null;
}

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      profile: null,
      message: "Accounts are temporarily unavailable.",
    });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const company = await loadCompany(auth.accessToken, auth.companyId);

  return NextResponse.json({
    connected: true,
    profile: {
      id: auth.userId,
      email: auth.email,
      name: auth.name,
      role: auth.role,
      companyId: auth.companyId,
      companyName: company?.name ?? "",
      phone: company?.phone ?? "",
      address: company?.address ?? "",
      vatRegistered: company?.vat_registered ?? false,
      vatRate: Number(company?.vat_rate ?? DEFAULT_VAT_RATE),
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = companySettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose whether the company is VAT registered and enter a valid VAT percentage." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ error: "Company settings are temporarily unavailable." }, { status: 503 });
  }

  const { error } = await supabase
    .from("companies")
    .update({
      vat_registered: parsed.data.vatRegistered,
      vat_rate: parsed.data.vatRate,
    })
    .eq("id", auth.companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const company = await loadCompany(auth.accessToken, auth.companyId);

  return NextResponse.json({
    connected: true,
    message: parsed.data.vatRegistered
      ? `VAT enabled at ${(parsed.data.vatRate * 100).toFixed(2).replace(/\.?0+$/, "")}%.`
      : "VAT disabled. New quotes and invoices will not charge VAT.",
    company: {
      vatRegistered: company?.vat_registered ?? parsed.data.vatRegistered,
      vatRate: Number(company?.vat_rate ?? parsed.data.vatRate),
    },
  });
}
