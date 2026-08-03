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
const userLimit = Number(process.env.AI_EXTRACT_USER_LIMIT ?? 20);
const companyLimit = Number(process.env.AI_EXTRACT_COMPANY_LIMIT ?? 100);
const windowSeconds = Number(process.env.AI_EXTRACT_WINDOW_SECONDS ?? 3600);
const timestamp = Date.now();
const password = "SiteGentSecurity12345!";
const message = "Please quote a plumbing call-out in Pretoria tomorrow. Call 082 555 0142.";
const extractionRouteSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "ai", "extract", "route.ts"),
  "utf8",
);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("AI security checks require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

if (!Number.isSafeInteger(userLimit) || !Number.isSafeInteger(companyLimit) || !Number.isSafeInteger(windowSeconds)) {
  throw new Error("AI extraction limits must be integers.");
}

if (companyLimit <= userLimit) {
  throw new Error("AI_EXTRACT_COMPANY_LIMIT must be greater than AI_EXTRACT_USER_LIMIT for this check.");
}

function assertOpenAiRunsAfterAuthorization() {
  const authCheckPosition = extractionRouteSource.indexOf(
    "const authResult = await getAuthContext(request);",
  );
  const authFailureReturnPosition = extractionRouteSource.indexOf(
    "return authResult.response;",
    authCheckPosition,
  );
  const openAiClientPosition = extractionRouteSource.indexOf("const client = new OpenAI");

  if (
    authCheckPosition < 0
    || authFailureReturnPosition < authCheckPosition
    || openAiClientPosition < authFailureReturnPosition
  ) {
    throw new Error("OpenAI client creation must remain after the authentication failure return.");
  }
}

assertOpenAiRunsAfterAuthorization();

const server = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function authHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

let companyUserId;
let companyId;
let noCompanyUserId;

try {
  const unauthenticated = await request("/api/ai/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (unauthenticated.response.status !== 401) {
    throw new Error(`Unauthenticated extraction returned ${unauthenticated.response.status}, expected 401.`);
  }

  const signup = await request("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `sitegent-ai-security-${timestamp}@example.com`,
      password,
      name: "AI Security Tester",
      companyName: `AI Security Test ${timestamp}`,
      phone: "+27000000000",
      address: "Pilot test address",
    }),
  });

  if (!signup.response.ok || !signup.body.session?.access_token || !signup.body.profile?.companyId) {
    throw new Error(`Could not create authenticated test user: ${JSON.stringify(signup.body)}`);
  }

  companyUserId = signup.body.user.id;
  companyId = signup.body.profile.companyId;
  const accessToken = signup.body.session.access_token;

  const noCompanyEmail = `sitegent-ai-no-company-${timestamp}@example.com`;
  const { data: noCompanyData, error: noCompanyCreateError } = await server.auth.admin.createUser({
    email: noCompanyEmail,
    password,
    email_confirm: true,
  });

  if (noCompanyCreateError || !noCompanyData.user) {
    throw new Error(`Could not create no-company test user: ${noCompanyCreateError?.message ?? "unknown error"}`);
  }

  noCompanyUserId = noCompanyData.user.id;
  const noCompanySignin = await request("/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: noCompanyEmail, password }),
  });

  if (!noCompanySignin.response.ok || !noCompanySignin.body.session?.access_token) {
    throw new Error(`Could not sign in no-company test user: ${JSON.stringify(noCompanySignin.body)}`);
  }

  const noCompanyExtraction = await request("/api/ai/extract", {
    method: "POST",
    headers: authHeaders(noCompanySignin.body.session.access_token),
    body: JSON.stringify({ message }),
  });

  if (noCompanyExtraction.response.status !== 403) {
    throw new Error(`No-company extraction returned ${noCompanyExtraction.response.status}, expected 403.`);
  }

  const { count: rejectedUsageCount, error: rejectedUsageError } = await server
    .from("ai_extraction_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", noCompanyUserId);

  if (rejectedUsageError || rejectedUsageCount !== 0) {
    throw new Error(
      `Rejected extraction consumed quota: ${rejectedUsageError?.message ?? rejectedUsageCount}`,
    );
  }

  const authenticated = await request("/api/ai/extract", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message }),
  });

  if (!authenticated.response.ok || !authenticated.body.job?.title) {
    throw new Error(`Authenticated extraction failed: ${JSON.stringify(authenticated.body)}`);
  }

  for (let count = 1; count < userLimit; count += 1) {
    const { data, error } = await server.rpc("consume_ai_extraction_quota", {
      p_user_id: companyUserId,
      p_company_id: companyId,
      p_user_limit: userLimit,
      p_company_limit: companyLimit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data?.allowed) {
      throw new Error(`Could not prepare rate-limit test: ${error?.message ?? JSON.stringify(data)}`);
    }
  }

  const limited = await request("/api/ai/extract", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message }),
  });

  if (limited.response.status !== 429 || !limited.response.headers.get("retry-after")) {
    throw new Error(`Rate-limited extraction returned ${limited.response.status}, expected 429 with Retry-After.`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    unauthenticatedRequest: "blocked",
    authenticatedExtraction: "passed",
    noCompanyRequest: "blocked",
    openAiSkippedForAuthFailures: "passed",
    databaseRateLimit: "passed",
    userLimit,
    companyLimit,
    windowSeconds,
  }, null, 2));
} finally {
  if (noCompanyUserId) await server.auth.admin.deleteUser(noCompanyUserId);
  if (companyUserId) await server.auth.admin.deleteUser(companyUserId);
  if (companyId) await server.from("companies").delete().eq("id", companyId);
}
