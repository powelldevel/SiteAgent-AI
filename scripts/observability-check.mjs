import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile(".env.local");

const baseUrl = process.env.SITEGENT_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const timestamp = Date.now();
const password = "SiteGentObserve12345!";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Observability checks require Supabase environment variables.");
}

const server = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function rawRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

async function request(path, options = {}) {
  const result = await rawRequest(path, options);
  if (!result.response.ok) {
    throw new Error(`${path} returned ${result.response.status}: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

function headers(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

let userId;
let companyId;

try {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `sitegent-observability-${timestamp}@example.com`,
      password,
      name: "Observability Tester",
      companyName: `Observability Company ${timestamp}`,
    }),
  });

  userId = signup.user?.id;
  companyId = signup.profile?.companyId;
  const token = signup.session?.access_token;

  if (!userId || !companyId || !token) {
    throw new Error("Could not create observability test account.");
  }

  await request("/api/observability", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      action: "frontend_error",
      message: "Synthetic pilot frontend error",
      metadata: { source: "observability-check", path: "/pilot-check" },
    }),
  });

  const failedSave = await rawRequest("/api/operations/save", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ incomplete: true }),
  });

  if (failedSave.response.status !== 400) {
    throw new Error(`Invalid save returned ${failedSave.response.status}, expected 400.`);
  }

  const missingExport = await rawRequest(
    "/api/documents/quote?id=00000000-0000-4000-8000-000000000000",
    { headers: { authorization: `Bearer ${token}` } },
  );

  if (missingExport.response.status !== 404) {
    throw new Error(`Missing export returned ${missingExport.response.status}, expected 404.`);
  }

  const userLimit = Number(process.env.AI_EXTRACT_USER_LIMIT ?? 20);
  const companyLimit = Number(process.env.AI_EXTRACT_COMPANY_LIMIT ?? 100);
  const windowSeconds = Number(process.env.AI_EXTRACT_WINDOW_SECONDS ?? 3600);

  for (let count = 0; count < userLimit; count += 1) {
    const { data, error } = await server.rpc("consume_ai_extraction_quota", {
      p_user_id: userId,
      p_company_id: companyId,
      p_user_limit: userLimit,
      p_company_limit: companyLimit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data?.allowed) {
      throw new Error(`Could not prepare AI failure check: ${error?.message ?? JSON.stringify(data)}`);
    }
  }

  const failedExtraction = await rawRequest("/api/ai/extract", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ message: "Please quote a plumbing call-out." }),
  });
  if (failedExtraction.response.status !== 429) {
    throw new Error(`Rate-limited extraction returned ${failedExtraction.response.status}, expected 429.`);
  }

  const failedSignin = await rawRequest("/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `sitegent-observability-${timestamp}@example.com`,
      password: "WrongPassword123!",
    }),
  });
  if (failedSignin.response.status !== 401) {
    throw new Error(`Failed sign-in returned ${failedSignin.response.status}, expected 401.`);
  }

  const dashboard = await request("/api/analytics", {
    headers: { authorization: `Bearer ${token}` },
  });

  if (
    dashboard.failures?.frontendErrors < 1
    || dashboard.failures?.saveFailures < 1
    || dashboard.failures?.exportFailures < 1
    || dashboard.failures?.aiFailures < 1
  ) {
    throw new Error(`Dashboard failure counts are incomplete: ${JSON.stringify(dashboard.failures)}`);
  }

  const { data: companyRows, error: companyRowsError } = await server
    .from("observability_events")
    .select("user_id,company_id,route,action,status,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (companyRowsError) throw companyRowsError;

  const { data: authRows, error: authRowsError } = await server
    .from("observability_events")
    .select("user_id,company_id,route,action,status,created_at")
    .is("company_id", null)
    .eq("action", "auth_failure")
    .gte("created_at", new Date(timestamp).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (authRowsError) throw authRowsError;

  const rows = [...(companyRows ?? []), ...(authRows ?? [])];

  const actions = new Set(rows.map((row) => row.action));
  for (const action of ["frontend_error", "save_operations_pack", "document_export", "auth_failure", "ai_extraction"]) {
    if (!actions.has(action)) throw new Error(`Missing durable ${action} event.`);
  }

  const invalidRow = rows.find(
    (row) => !row.route || !row.action || !row.status || !row.created_at,
  );
  if (invalidRow) {
    throw new Error(`Structured event is incomplete: ${JSON.stringify(invalidRow)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    durableEvents: [...actions].sort(),
    dashboardFailures: dashboard.failures,
    structuredFields: ["user_id", "company_id", "route", "action", "status", "created_at"],
    tenantScopedDashboard: "passed",
  }, null, 2));
} finally {
  if (userId) await server.auth.admin.deleteUser(userId);
  if (companyId) await server.from("companies").delete().eq("id", companyId);
  await server
    .from("observability_events")
    .delete()
    .is("company_id", null)
    .eq("route", "/api/auth/signin")
    .gte("created_at", new Date(timestamp).toISOString());
}
