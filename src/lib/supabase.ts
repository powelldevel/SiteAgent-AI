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
      ai_extraction_usage: SupabaseTable;
      companies: SupabaseTable;
      customers: SupabaseTable;
      invoices: SupabaseTable;
      jobs: SupabaseTable;
      messages: SupabaseTable;
      observability_events: SupabaseTable;
      payments: SupabaseTable;
      price_items: SupabaseTable;
      quote_items: SupabaseTable;
      quotes: SupabaseTable;
      users: SupabaseTable;
      workers: SupabaseTable;
    };
    Views: Record<string, never>;
    Functions: {
      consume_ai_extraction_quota: {
        Args: {
          p_user_id: string;
          p_company_id: string;
          p_user_limit?: number;
          p_company_limit?: number;
          p_window_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          scope: "user" | "company" | null;
          limit: number;
          remaining: number;
          retryAfter: number;
        };
      };
      save_operations_pack: {
        Args: {
          p_original_message: string;
          p_extraction_mode: string;
          p_job: Record<string, unknown>;
          p_quote: Record<string, unknown>;
          p_subtotal: number;
          p_tax: number;
          p_total: number;
          p_scheduled_date: string | null;
          p_due_date: string;
        };
        Returns: {
          customerId: string;
          jobId: string;
          quoteId: string;
          invoiceId: string;
          quoteNumber: string;
          invoiceNumber: string;
          subtotal: number;
          tax: number;
          total: number;
          vatRegistered: boolean;
          vatRate: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let browserClient: ReturnType<typeof createClient<SiteGentDatabase>> | null = null;
let serverClient: ReturnType<typeof createClient<SiteGentDatabase>> | null = null;
let authClient: ReturnType<typeof createClient<SiteGentDatabase>> | null = null;

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

export function isSupabaseUserClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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

export function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!authClient) {
    authClient = createClient<SiteGentDatabase>(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return authClient;
}

export function getSupabaseUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient<SiteGentDatabase>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
