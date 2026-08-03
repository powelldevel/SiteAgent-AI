import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth";
import { recordOperationalEvent } from "@/lib/observability";
import {
  buildPilotFunnel,
  isPilotAdmin,
  pilotEventNames,
  recordPilotEvent,
  type AnalyticsEvent,
  type FailureEvent,
  type FailureSummary,
  type PilotEventName,
} from "@/lib/pilot-analytics";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient, getSupabaseUserClient, isSupabaseServerConfigured } from "@/lib/supabase";

const eventSchema = z.object({
  event: z.enum([
    "quote_generated",
    "job_saved",
    "quote_exported",
    "invoice_exported",
    "payment_request_copied",
    "payment_recorded",
  ]),
  metadata: z.record(z.string(), z.string().or(z.number()).or(z.boolean()).or(z.null())).optional(),
});

type UserRow = {
  id: string;
  company_id: string | null;
};

type CompanyEventRow = {
  company_id: string;
  task_type: string;
  input: unknown;
  created_at: string;
};

type ObservabilityRow = {
  company_id: string | null;
  action: string;
  status: string;
  route: string;
  message: string | null;
  created_at: string;
};

function isTrackedEvent(value: unknown): value is PilotEventName {
  return typeof value === "string" && pilotEventNames.includes(value as PilotEventName);
}

function summarizeCounts(events: CompanyEventRow[]) {
  const counts = Object.fromEntries(pilotEventNames.map((event) => [event, 0])) as Record<PilotEventName, number>;

  for (const event of events) {
    if (isTrackedEvent(event.task_type)) counts[event.task_type] += 1;
  }

  return counts;
}

function biggestDropOffLabel(funnel: ReturnType<typeof buildPilotFunnel>) {
  const biggest = funnel.reduce<(typeof funnel)[number] | null>((current, step) => {
    if (!current || step.dropOff > current.dropOff) return step;
    return current;
  }, null);

  return biggest && biggest.dropOff > 0 ? biggest.label : null;
}

function summarizeFailures(events: ObservabilityRow[]): FailureSummary {
  const last24HoursCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const count = (action: string) => events.filter((event) => event.action === action).length;

  return {
    total: events.length,
    last24Hours: events.filter((event) => new Date(event.created_at).getTime() >= last24HoursCutoff).length,
    frontendErrors: count("frontend_error"),
    apiErrors: count("api_error"),
    authFailures: count("auth_failure"),
    aiFailures: count("ai_extraction"),
    saveFailures: count("save_operations_pack"),
    exportFailures: count("document_export"),
  };
}

export async function GET(request: Request) {
  const limited = rateLimit(`analytics:get:${getRequestKey(request)}`, { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, counts: {}, recent: [], funnel: [], summary: null });
  }

  const auth = await getAuthContext(request);
  if (!auth.ok) return auth.response;

  const server = getSupabaseServerClient();
  if (!server) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/analytics",
      action: "api_error",
      status: "failed",
      message: "Supabase server connection is unavailable.",
      metadata: { httpStatus: 500 },
    });
    return NextResponse.json({ connected: true, error: "Supabase server connection is missing." }, { status: 500 });
  }

  const pilotMode = isPilotAdmin(auth.email);
  const usersQuery = server.from("users").select("id,company_id");
  const pricesQuery = server.from("price_items").select("company_id").eq("active", true);
  const eventsQuery = server
    .from("ai_tasks")
    .select("company_id,task_type,input,created_at")
    .in("task_type", [...pilotEventNames])
    .order("created_at", { ascending: false })
    .limit(5000);
  const failuresQuery = server
    .from("observability_events")
    .select("company_id,action,status,route,message,created_at")
    .neq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (!pilotMode) {
    usersQuery.eq("company_id", auth.companyId);
    pricesQuery.eq("company_id", auth.companyId);
    eventsQuery.eq("company_id", auth.companyId);
    failuresQuery.eq("company_id", auth.companyId);
  }

  const [usersResult, pricesResult, eventsResult, failuresResult] = await Promise.all([
    usersQuery,
    pricesQuery,
    eventsQuery,
    failuresQuery,
  ]);
  const firstError = usersResult.error ?? pricesResult.error ?? eventsResult.error ?? failuresResult.error;

  if (firstError) {
    await recordOperationalEvent({
      userId: auth.userId,
      companyId: auth.companyId,
      route: "/api/analytics",
      action: "api_error",
      status: "failed",
      message: "Pilot dashboard query failed.",
      metadata: { httpStatus: 500, code: firstError.code ?? null },
    });
    return NextResponse.json({ connected: true, error: firstError.message, counts: {}, recent: [], funnel: [] }, { status: 500 });
  }

  const users = (usersResult.data ?? []) as UserRow[];
  const events = (eventsResult.data ?? []) as CompanyEventRow[];
  const failures = (failuresResult.data ?? []) as ObservabilityRow[];
  const pricedCompanyIds = new Set((pricesResult.data ?? []).map((row) => String(row.company_id)));
  const funnel = buildPilotFunnel(users, pricedCompanyIds, events);
  const activeWindowDays = 7;
  const activeCutoff = Date.now() - activeWindowDays * 24 * 60 * 60 * 1000;
  let activeUsers = 0;

  if (pilotMode) {
    const { data: authUsers, error: authUsersError } = await server.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsersError) {
      await recordOperationalEvent({
        userId: auth.userId,
        companyId: auth.companyId,
        route: "/api/analytics",
        action: "api_error",
        status: "failed",
        message: "Pilot active-user query failed.",
        metadata: { httpStatus: 500 },
      });
      return NextResponse.json({ connected: true, error: authUsersError.message, counts: {}, recent: [], funnel: [] }, { status: 500 });
    }

    const profileUserIds = new Set(users.map((user) => user.id));
    activeUsers = authUsers.users.filter(
      (user) =>
        profileUserIds.has(user.id) &&
        Boolean(user.last_sign_in_at) &&
        new Date(user.last_sign_in_at as string).getTime() >= activeCutoff,
    ).length;
  } else {
    const recentUserIds = new Set<string>();
    for (const event of events) {
      if (new Date(event.created_at).getTime() < activeCutoff) continue;
      const input = event.input as { userId?: unknown } | null;
      if (typeof input?.userId === "string") recentUserIds.add(input.userId);
    }
    activeUsers = recentUserIds.size || (events.some((event) => new Date(event.created_at).getTime() >= activeCutoff) ? 1 : 0);
  }

  return NextResponse.json({
    connected: true,
    counts: summarizeCounts(events),
    funnel,
    summary: {
      mode: pilotMode ? "pilot" : "workspace",
      totalUsers: users.length,
      activeUsers,
      activeWindowDays,
      completedUsers: funnel.find((step) => step.id === "feedback_submitted")?.count ?? 0,
      biggestDropOff: biggestDropOffLabel(funnel),
    },
    recent: events.slice(0, 8).map(({ task_type, created_at }) => ({ task_type, created_at })) satisfies AnalyticsEvent[],
    failures: summarizeFailures(failures),
    recentFailures: failures.slice(0, 8).map(
      ({ action, status, route, message, created_at }) => ({ action, status, route, message, created_at }),
    ) satisfies FailureEvent[],
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`analytics:post:${getRequestKey(request)}`, { limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ connected: false, message: "Analytics disabled." });
  }

  const auth = await getAuthContext(request);
  if (!auth.ok) return auth.response;

  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ connected: true, error: "Unknown analytics event." }, { status: 400 });
  }

  const supabase = getSupabaseUserClient(auth.accessToken);
  if (!supabase) {
    return NextResponse.json({ connected: true, error: "Supabase browser key is missing." }, { status: 500 });
  }

  await recordPilotEvent(supabase, auth.companyId, auth.userId, parsed.data.event, parsed.data.metadata);
  return NextResponse.json({ connected: true, message: "Event recorded." });
}
