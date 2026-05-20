import { NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      message: "Demo mode: Supabase is not connected yet.",
      jobs: [],
    });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      connected: false,
      message: "Demo mode: Supabase is not connected yet.",
      jobs: [],
    });
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
      quotes(total, status),
      invoices(total, status)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ connected: true, error: error.message, jobs: [] }, { status: 500 });
  }

  return NextResponse.json({ connected: true, jobs: data ?? [] });
}
