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
const timestamp = Date.now();
const password = "SiteGentAuth12345!";
const signupEmail = `sitegent-auth-${timestamp}@example.com`;
const onboardingEmail = `sitegent-onboarding-${timestamp}@example.com`;

const server = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let signupUserId = null;
let onboardingUserId = null;

function headers(token) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

async function rawRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function request(path, options = {}) {
  const result = await rawRequest(path, options);
  if (!result.response.ok) {
    throw new Error(`${path} returned ${result.response.status}: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

try {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Auth Test Owner",
      phone: "+27820000000",
      email: signupEmail,
      password,
      companyName: `Auth Test Co ${timestamp}`,
      address: "12 Pilot Street",
    }),
  });

  signupUserId = signup.user?.id;
  if (!signup.session?.access_token || !signup.profile?.companyId) {
    throw new Error(`Signup did not return a ready company workspace: ${JSON.stringify(signup)}`);
  }

  const duplicate = await rawRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Auth Test Owner",
      phone: "+27820000000",
      email: signupEmail,
      password,
      companyName: `Duplicate ${timestamp}`,
    }),
  });

  if (duplicate.response.status !== 409 || duplicate.body.error !== "This email is already registered. Try signing in.") {
    throw new Error(`Existing account error was not clear: ${duplicate.response.status} ${JSON.stringify(duplicate.body)}`);
  }

  const wrongPassword = await rawRequest("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({
      email: signupEmail,
      password: "WrongPassword123!",
    }),
  });

  if (wrongPassword.response.status !== 401 || wrongPassword.body.error !== "Wrong email or password.") {
    throw new Error(`Wrong password error was not clear: ${wrongPassword.response.status} ${JSON.stringify(wrongPassword.body)}`);
  }

  const signin = await request("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({
      email: signupEmail,
      password,
    }),
  });

  if (!signin.session?.access_token) {
    throw new Error(`Signin did not return a session: ${JSON.stringify(signin)}`);
  }

  const { data: onboardingUser, error: createError } = await server.auth.admin.createUser({
    email: onboardingEmail,
    password,
    email_confirm: true,
  });
  if (createError || !onboardingUser.user) throw createError ?? new Error("Could not create onboarding user.");
  onboardingUserId = onboardingUser.user.id;

  const onboardingSignin = await request("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email: onboardingEmail, password }),
  });

  const meBefore = await rawRequest("/api/auth/me", {
    headers: { authorization: `Bearer ${onboardingSignin.session.access_token}` },
  });

  if (meBefore.response.status !== 403 || !meBefore.body.needsOnboarding) {
    throw new Error(`User without company was not guided to onboarding: ${meBefore.response.status} ${JSON.stringify(meBefore.body)}`);
  }

  const onboarded = await request("/api/auth/onboard", {
    method: "POST",
    headers: headers(onboardingSignin.session.access_token),
    body: JSON.stringify({
      name: "Onboarding Test Owner",
      companyName: `Onboarding Test Co ${timestamp}`,
      phone: "+27821111111",
      address: "34 Setup Road",
    }),
  });

  if (!onboarded.profile?.companyId) {
    throw new Error(`Onboarding did not create a company profile: ${JSON.stringify(onboarded)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    signupFlow: "passed",
    signinFlow: "passed",
    onboardingAfterSignup: "passed",
    onboardingWithoutCompany: "passed",
    wrongPasswordError: "passed",
    existingAccountError: "passed",
  }, null, 2));
} finally {
  if (signupUserId) await server.auth.admin.deleteUser(signupUserId);
  if (onboardingUserId) await server.auth.admin.deleteUser(onboardingUserId);
}
