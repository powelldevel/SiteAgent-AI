import type { getSupabaseServerClient } from "@/lib/supabase";

export const pilotEventNames = [
  "sign_up",
  "company_created",
  "pricing_configured",
  "quote_generated",
  "job_saved",
  "quote_exported",
  "invoice_exported",
  "feedback_submitted",
  "pilot_feedback",
  "payment_request_copied",
  "payment_recorded",
] as const;

export type PilotEventName = (typeof pilotEventNames)[number];

export type AnalyticsFunnelStep = {
  id: Exclude<PilotEventName, "pilot_feedback" | "payment_request_copied" | "payment_recorded">;
  label: string;
  count: number;
  conversionRate: number;
  dropOff: number;
  dropOffRate: number;
};

export type AnalyticsSummary = {
  mode: "pilot" | "workspace";
  totalUsers: number;
  activeUsers: number;
  activeWindowDays: number;
  completedUsers: number;
  biggestDropOff: string | null;
};

export type AnalyticsEvent = {
  task_type: string;
  created_at: string;
};

export type FailureSummary = {
  total: number;
  last24Hours: number;
  frontendErrors: number;
  apiErrors: number;
  authFailures: number;
  aiFailures: number;
  saveFailures: number;
  exportFailures: number;
};

export type FailureEvent = {
  action: string;
  status: string;
  route: string;
  message: string | null;
  created_at: string;
};

type AnalyticsClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

type FunnelUser = {
  id: string;
  company_id: string | null;
};

type FunnelEvent = {
  company_id: string;
  task_type: string;
  input: unknown;
};

const funnelStages: Array<{ id: AnalyticsFunnelStep["id"]; label: string }> = [
  { id: "sign_up", label: "Signed up" },
  { id: "company_created", label: "Created company" },
  { id: "pricing_configured", label: "Configured pricing" },
  { id: "quote_generated", label: "Generated quote" },
  { id: "job_saved", label: "Saved quote and job" },
  { id: "quote_exported", label: "Exported quote" },
  { id: "invoice_exported", label: "Exported invoice" },
  { id: "feedback_submitted", label: "Submitted feedback" },
];

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function eventUserId(input: unknown) {
  if (!input || typeof input !== "object" || !("userId" in input)) return null;
  const value = (input as { userId?: unknown }).userId;
  return typeof value === "string" && value ? value : null;
}

export function buildPilotFunnel(users: FunnelUser[], pricedCompanyIds: Set<string>, events: FunnelEvent[]) {
  const allUsers = new Set(users.map((user) => user.id));
  const companyUsers = new Map<string, Set<string>>();

  for (const user of users) {
    if (!user.company_id) continue;
    const members = companyUsers.get(user.company_id) ?? new Set<string>();
    members.add(user.id);
    companyUsers.set(user.company_id, members);
  }

  const actorsByStage = new Map<AnalyticsFunnelStep["id"], Set<string>>();
  for (const stage of funnelStages) actorsByStage.set(stage.id, new Set<string>());

  for (const user of users) {
    actorsByStage.get("sign_up")?.add(user.id);
    if (user.company_id) actorsByStage.get("company_created")?.add(user.id);
    if (user.company_id && pricedCompanyIds.has(user.company_id)) {
      actorsByStage.get("pricing_configured")?.add(user.id);
    }
  }

  for (const event of events) {
    const normalizedEvent = event.task_type === "pilot_feedback" ? "feedback_submitted" : event.task_type;
    if (!actorsByStage.has(normalizedEvent as AnalyticsFunnelStep["id"])) continue;

    const actors = actorsByStage.get(normalizedEvent as AnalyticsFunnelStep["id"]);
    const userId = eventUserId(event.input);

    if (userId && allUsers.has(userId)) {
      actors?.add(userId);
      continue;
    }

    for (const companyUserId of companyUsers.get(event.company_id) ?? []) {
      actors?.add(companyUserId);
    }
  }

  let eligibleActors = new Set(allUsers);
  let previousCount = users.length;

  return funnelStages.map((stage) => {
    const stageActors = actorsByStage.get(stage.id) ?? new Set<string>();
    eligibleActors = new Set([...eligibleActors].filter((actor) => stageActors.has(actor)));
    const count = eligibleActors.size;
    const dropOff = Math.max(previousCount - count, 0);
    const dropOffRate = percentage(dropOff, previousCount);
    previousCount = count;

    return {
      ...stage,
      count,
      conversionRate: percentage(count, users.length),
      dropOff,
      dropOffRate,
    };
  });
}

export async function recordPilotEvent(
  client: AnalyticsClient,
  companyId: string,
  userId: string,
  event: PilotEventName,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  const { error } = await client.from("ai_tasks").insert({
    company_id: companyId,
    task_type: event,
    input: { ...metadata, userId },
    output: { recorded: true },
    status: "completed",
  });

  if (error) {
    console.error(`Could not record ${event} analytics event`, error);
    return false;
  }

  return true;
}

export function isPilotAdmin(email: string) {
  const configured = (process.env.SITEGENT_PILOT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(email.trim().toLowerCase());
}
