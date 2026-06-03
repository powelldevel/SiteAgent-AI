import { NextResponse } from "next/server";
import { isSupabaseServerConfigured, isSupabaseUserClientConfigured } from "@/lib/supabase";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  const checks = {
    openai: configured(process.env.OPENAI_API_KEY),
    supabaseServer: isSupabaseServerConfigured(),
    supabaseUserClient: isSupabaseUserClientConfigured(),
  };

  const ready = checks.openai && checks.supabaseServer && checks.supabaseUserClient;

  return NextResponse.json(
    {
      ready,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
