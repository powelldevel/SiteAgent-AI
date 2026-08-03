import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Saving is temporarily unavailable.",
      jobs: [],
    });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabaseUserClient(auth.accessToken);

  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      id,
      title,
      description,
      location,
      status,
      urgency,
      scheduled_date,
      created_at,
      customers(name, phone),
      messages(body, ai_summary, created_at),
      quotes(
        id,
        quote_number,
        subtotal,
        tax,
        total,
        vat_registered,
        vat_rate,
        status,
        quote_items(description, quantity, unit_price, total)
      ),
      invoices(id, invoice_number, total, status, due_date, created_at)
    `,
    )
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ connected: true, error: error.message, jobs: [] }, { status: 500 });
  }

  return NextResponse.json({ connected: true, jobs: data ?? [], limit });
}
