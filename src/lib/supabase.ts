import { createClient } from "@supabase/supabase-js";

type SupabaseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type SiteGentDatabase = {
  public: {
    Tables: {
      ai_tasks: SupabaseTable;
      companies: SupabaseTable;
      customers: SupabaseTable;
      invoices: SupabaseTable;
      jobs: SupabaseTable;
      messages: SupabaseTable;
      payments: SupabaseTable;
      quote_items: SupabaseTable;
      quotes: SupabaseTable;
      users: SupabaseTable;
      workers: SupabaseTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let browserClient: ReturnType<typeof createClient<SiteGentDatabase>> | null = null;
let serverClient: ReturnType<typeof createClient<SiteGentDatabase>> | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<SiteGentDatabase>(url, anonKey);
  }

  return browserClient;
}

export function isSupabaseServerConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!serverClient) {
    serverClient = createClient<SiteGentDatabase>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverClient;
}
