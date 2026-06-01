import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { isSupabaseServerConfigured } from "@/lib/supabase";

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({
      connected: false,
      profile: null,
      message: "Demo mode: Supabase is not connected yet.",
    });
  }

  const auth = await getAuthContext(request);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    connected: true,
    profile: {
      id: auth.userId,
      email: auth.email,
      name: auth.name,
      role: auth.role,
      companyId: auth.companyId,
    },
  });
}
