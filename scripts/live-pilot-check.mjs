import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.SITEGENT_URL ?? "https://sitegent.vercel.app";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const users = [
  {
    email: process.env.PILOT_A_EMAIL,
    password: process.env.PILOT_A_PASSWORD,
    name: "Pilot A Owner",
    companyName: `Pilot A ${Date.now()}`,
  },
  {
    email: process.env.PILOT_B_EMAIL,
    password: process.env.PILOT_B_PASSWORD,
    name: "Pilot B Owner",
    companyName: `Pilot B ${Date.now()}`,
  },
];

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

required("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
required("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey);
users.forEach((user, index) => {
  required(`PILOT_${index === 0 ? "A" : "B"}_EMAIL`, user.email);
  required(`PILOT_${index === 0 ? "A" : "B"}_PASSWORD`, user.password);
});

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function getSessionFor(user) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const signedIn = await supabase.auth.signInWithPassword({ email: user.email, password: user.password });

  if (signedIn.data.session) {
    return signedIn.data.session;
  }

  const signedUp = await supabase.auth.signUp({ email: user.email, password: user.password });

  if (!signedUp.data.session) {
    throw new Error(`No session for ${user.email}. If email confirmation is enabled, confirm the account first and rerun.`);
  }

  return signedUp.data.session;
}

function authHeaders(session) {
  return {
    authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
  };
}

async function onboard(session, user) {
  return jsonRequest("/api/auth/onboard", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      name: user.name,
      companyName: user.companyName,
      phone: "+27000000000",
      address: "Pilot test address",
    }),
  });
}

async function savePack(session, marker) {
  const message = `Pilot isolation test ${marker}. Need 6 cubes river sand delivered before Friday in Modimolle. Call 082 555 0142.`;
  const extraction = await jsonRequest("/api/ai/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const subtotal = extraction.job.quoteItems.reduce((sum, item) => sum + item.total, 0);
  const quote = {
    quoteNumber: `SG-Q-${marker}`,
    subtotal,
    tax: subtotal * 0.15,
    total: subtotal * 1.15,
    items: extraction.job.quoteItems,
  };

  return jsonRequest("/api/operations/save", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      originalMessage: message,
      extractionMode: extraction.mode,
      job: extraction.job,
      quote,
    }),
  });
}

async function savedJobs(session) {
  return jsonRequest("/api/saved-jobs?limit=50", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
}

const sessions = [];
for (const user of users) {
  const session = await getSessionFor(user);
  sessions.push(session);
  await onboard(session, user);
}

const marker = `sitegent-${Date.now()}`;
await savePack(sessions[0], marker);

const jobsA = await savedJobs(sessions[0]);
const jobsB = await savedJobs(sessions[1]);
const userAHasMarker = jobsA.jobs.some((job) => `${job.description ?? ""} ${job.title ?? ""}`.includes(marker));
const userBHasMarker = jobsB.jobs.some((job) => `${job.description ?? ""} ${job.title ?? ""}`.includes(marker));

if (!userAHasMarker) {
  throw new Error("Pilot A could not see its saved operation pack.");
}

if (userBHasMarker) {
  throw new Error("Tenant isolation failed: Pilot B can see Pilot A's saved operation pack.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      marker,
      pilotAJobs: jobsA.jobs.length,
      pilotBJobs: jobsB.jobs.length,
      tenantIsolation: "passed",
    },
    null,
    2,
  ),
);
