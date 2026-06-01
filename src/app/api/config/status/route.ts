import { NextResponse } from "next/server";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  const openAiConfigured = configured(process.env.OPENAI_API_KEY);
  const supabaseUrlConfigured = configured(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonConfigured = configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseServiceConfigured = configured(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return NextResponse.json({
    openai: {
      configured: openAiConfigured,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
      required: ["OPENAI_API_KEY"],
    },
    supabase: {
      configured: supabaseUrlConfigured && supabaseAnonConfigured && supabaseServiceConfigured,
      urlConfigured: supabaseUrlConfigured,
      anonKeyConfigured: supabaseAnonConfigured,
      serviceRoleKeyConfigured: supabaseServiceConfigured,
      required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    },
  });
}
