import { getSupabaseServerClient } from "@/lib/supabase";

export type OperationalAction =
  | "frontend_error"
  | "api_error"
  | "auth_failure"
  | "ai_extraction"
  | "save_operations_pack"
  | "document_export";

export type OperationalStatus = "success" | "failed" | "blocked" | "fallback";
export type OperationalLevel = "info" | "warning" | "error";

type OperationalEvent = {
  userId?: string | null;
  companyId?: string | null;
  route: string;
  action: OperationalAction;
  status: OperationalStatus;
  level?: OperationalLevel;
  message?: string;
  metadata?: Record<string, string | number | boolean | null>;
  persist?: boolean;
};

function safeMessage(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 500) || null;
}

export async function recordOperationalEvent(input: OperationalEvent) {
  const timestamp = new Date().toISOString();
  const level = input.level ?? (input.status === "success" ? "info" : "error");
  const event = {
    level,
    user_id: input.userId ?? null,
    company_id: input.companyId ?? null,
    route: input.route,
    action: input.action,
    status: input.status,
    timestamp,
    message: safeMessage(input.message),
    metadata: input.metadata ?? {},
  };

  const output = JSON.stringify(event);
  if (level === "error") console.error(output);
  else if (level === "warning") console.warn(output);
  else console.log(output);

  if (input.persist === false) return true;

  const server = getSupabaseServerClient();
  if (!server) return false;

  const { error } = await server.from("observability_events").insert({
    user_id: event.user_id,
    company_id: event.company_id,
    route: event.route,
    action: event.action,
    status: event.status,
    level: event.level,
    message: event.message,
    metadata: event.metadata,
    created_at: timestamp,
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      route: input.route,
      action: "api_error",
      status: "failed",
      timestamp: new Date().toISOString(),
      message: "Could not persist observability event.",
      metadata: { code: error.code ?? null },
    }));
    return false;
  }

  return true;
}
