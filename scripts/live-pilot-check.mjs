import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

loadEnvFile(".env.local");

const baseUrl = process.env.SITEGENT_URL ?? "https://sitegent.vercel.app";
const timestamp = Date.now();
const defaultPassword = "SiteGentTest12345!";

const users = [
  {
    email: process.env.PILOT_A_EMAIL ?? `sitegent-pilot-a-${timestamp}@example.com`,
    password: process.env.PILOT_A_PASSWORD ?? defaultPassword,
    name: "Pilot A Owner",
    companyName: `Pilot A ${timestamp}`,
  },
  {
    email: process.env.PILOT_B_EMAIL ?? `sitegent-pilot-b-${timestamp}@example.com`,
    password: process.env.PILOT_B_PASSWORD ?? defaultPassword,
    name: "Pilot B Owner",
    companyName: `Pilot B ${timestamp}`,
  },
];

async function jsonRequest(path, options = {}) {
  const result = await rawJsonRequest(path, options);

  if (!result.response.ok) {
    throw new Error(`${path} returned ${result.response.status}: ${JSON.stringify(result.body)}`);
  }

  return result.body;
}

async function rawJsonRequest(path, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    const fetchOptions = { ...options };
    delete fetchOptions.timeoutMs;
    response = await fetch(`${baseUrl}${path}`, { ...fetchOptions, signal: options.signal ?? controller.signal });
  } catch (error) {
    throw new Error(`${path} did not respond within ${Math.round(timeoutMs / 1000)} seconds: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  return { response, body };
}

function authHeaders(session) {
  return {
    authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
  };
}

async function signUpWithCompany(user) {
  const data = await jsonRequest("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
      companyName: user.companyName,
      phone: "+27000000000",
      address: "Pilot test address",
    }),
  });

  if (!data.session?.access_token || !data.profile?.companyId) {
    throw new Error(`Signup did not return a session and company profile for ${user.email}.`);
  }

  return data.session;
}

async function addPrice(session) {
  return jsonRequest("/api/pricing", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      name: "River sand",
      category: "material",
      unit: "per cube",
      unitPrice: 450,
      vatRate: 0.15,
      aliases: ["sand", "river sand", "cubes river sand"],
      active: true,
    }),
  });
}

async function enableVat(session) {
  return jsonRequest("/api/auth/me", {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ vatRegistered: true, vatRate: 0.15 }),
  });
}

async function importPriceList(session) {
  const imported = await jsonRequest("/api/pricing", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      items: [
        { name: "Labour", category: "labour", unit: "day", unitPrice: 950, vatRate: 0.15, aliases: [], notes: null, active: true },
        { name: "Callout", category: "fee", unit: "each", unitPrice: 450, vatRate: 0.15, aliases: [], notes: null, active: true },
        { name: "PVC Pipe", category: "material", unit: "metre", unitPrice: 85, vatRate: 0.15, aliases: [], notes: null, active: true },
        { name: "Sealant", category: "material", unit: "each", unitPrice: 120, vatRate: 0.15, aliases: [], notes: null, active: true },
      ],
    }),
  });

  if (imported.imported !== 4 || imported.priceItems?.length !== 4) {
    throw new Error("Bulk price-list import did not create all previewed rows.");
  }
}

async function buildPack(session, marker) {
  const message = `Pilot isolation test ${marker}. Need 6 cubes river sand delivered before Friday in Modimolle. Call 082 555 0142.`;
  const extraction = await jsonRequest("/api/ai/extract", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ message }),
    timeoutMs: 90_000,
  });
  const subtotal = extraction.job.quoteItems.reduce((sum, item) => sum + item.total, 0);
  const quote = {
    quoteNumber: "SG-Q-DRAFT-001",
    subtotal,
    tax: subtotal * 0.15,
    total: subtotal * 1.15,
    items: extraction.job.quoteItems,
  };

  return {
    originalMessage: message,
    extractionMode: extraction.mode,
    job: extraction.job,
    quote,
  };
}

async function savePack(session, body) {
  const saved = await jsonRequest("/api/operations/save", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(body),
  });

  return saved;
}

async function savedJobs(session) {
  return jsonRequest("/api/saved-jobs?limit=50", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
}

async function invoices(session) {
  return jsonRequest("/api/invoices", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
}

async function updateInvoice(session, id, status) {
  return jsonRequest("/api/invoices", {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ id, status }),
  });
}

async function exportInvoice(session, id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch(`${baseUrl}/api/documents/invoice?id=${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${session.access_token}` },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`/api/documents/invoice returned ${response.status}: ${html}`);
  }

  if (!html.includes("<h1>Invoice</h1>")) {
    throw new Error("Invoice export did not return invoice HTML.");
  }

  return html;
}

async function exportQuote(session, id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch(`${baseUrl}/api/documents/quote?id=${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${session.access_token}` },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`/api/documents/quote returned ${response.status}: ${html}`);
  }

  if (!html.includes("<h1>Quote</h1>")) {
    throw new Error("Quote export did not return quote HTML.");
  }

  return html;
}

async function recordPayment(session, invoiceId, amount) {
  return jsonRequest("/api/payments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ invoiceId, amount, status: "paid" }),
  });
}

async function sendFeedback(session) {
  return jsonRequest("/api/feedback", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({
      rating: "ok",
      message: "Pilot check feedback: quote flow works, keep pricing easy to review.",
    }),
  });
}

async function analytics(session) {
  return jsonRequest("/api/analytics", {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
}

const sessions = [];
for (const user of users) {
  const session = await signUpWithCompany(user);
  sessions.push(session);
}

await addPrice(sessions[0]);
await importPriceList(sessions[0]);
await enableVat(sessions[0]);

const marker = `sitegent-${timestamp}`;
const basePackBody = await buildPack(sessions[0], marker);
const savedPacks = [];

for (let index = 0; index < 5; index += 1) {
  const sequence = index + 1;
  const packBody = {
    ...basePackBody,
    originalMessage: `${basePackBody.originalMessage} Sequential save ${sequence}.`,
    job: {
      ...basePackBody.job,
      title: `${basePackBody.job.title} #${sequence}`,
      summary: `${basePackBody.job.summary} Sequential save ${sequence}.`,
    },
  };
  const saved = await savePack(sessions[0], packBody);

  if (!saved.records?.jobId || !saved.records?.quoteNumber || !saved.records?.invoiceNumber) {
    throw new Error(`Sequential save ${sequence} did not return complete records and document numbers.`);
  }

  savedPacks.push(saved);
}

const savedPack = savedPacks[0];
const savedJobId = savedPack.records?.jobId;

if (!savedJobId) {
  throw new Error("Save did not return a job id.");
}

const quoteNumbers = savedPacks.map((saved) => saved.records.quoteNumber);
const invoiceNumbers = savedPacks.map((saved) => saved.records.invoiceNumber);
const quotePattern = /^SG-Q-(\d{4})-(\d{6})$/;
const invoicePattern = /^SG-I-(\d{4})-(\d{6})$/;

for (let index = 0; index < savedPacks.length; index += 1) {
  const quoteMatch = quoteNumbers[index].match(quotePattern);
  const invoiceMatch = invoiceNumbers[index].match(invoicePattern);

  if (!quoteMatch || !invoiceMatch) {
    throw new Error(`Sequential save ${index + 1} returned an invalid document number format.`);
  }

  if (quoteMatch[1] !== invoiceMatch[1] || quoteMatch[2] !== invoiceMatch[2]) {
    throw new Error(`Sequential save ${index + 1} returned mismatched quote and invoice numbers.`);
  }

  if (index > 0) {
    const previousSequence = Number(quoteNumbers[index - 1].slice(-6));
    const currentSequence = Number(quoteMatch[2]);

    if (currentSequence !== previousSequence + 1) {
      throw new Error("Server-generated document numbers are not consecutive.");
    }
  }
}

const jobsA = await savedJobs(sessions[0]);
const jobsB = await savedJobs(sessions[1]);
const invoicesA = await invoices(sessions[0]);
const invoicesB = await invoices(sessions[1]);
const savedJobIds = new Set(savedPacks.map((saved) => saved.records.jobId));
const savedInvoiceIds = new Set(savedPacks.map((saved) => saved.records.invoiceId));
const userAHasSavedJob = jobsA.jobs.some((job) => job.id === savedJobId);
const userBHasSavedJob = jobsB.jobs.some((job) => job.id === savedJobId);
const savedInvoice = invoicesA.invoices.find((invoice) => invoice.id === savedPack.records?.invoiceId);
const savedQuote = jobsA.jobs.find((job) => job.id === savedJobId)?.quotes?.find((quote) => quote.id === savedPack.records?.quoteId);
const userBHasSavedInvoice = invoicesB.invoices.some((invoice) => invoice.id === savedPack.records?.invoiceId);

if (!userAHasSavedJob) {
  throw new Error("Pilot A could not see its saved operation pack.");
}

if (jobsA.jobs.filter((job) => savedJobIds.has(job.id)).length !== 5) {
  throw new Error("Pilot A could not see all five sequentially saved jobs.");
}

if (userBHasSavedJob) {
  throw new Error("Tenant isolation failed: Pilot B can see Pilot A's saved operation pack.");
}

if (!savedInvoice) {
  throw new Error("Pilot A could not see its saved invoice.");
}

if (invoicesA.invoices.filter((invoice) => savedInvoiceIds.has(invoice.id)).length !== 5) {
  throw new Error("Pilot A could not see all five sequentially created invoices.");
}

if (userBHasSavedInvoice) {
  throw new Error("Tenant isolation failed: Pilot B can see Pilot A's invoice.");
}

if (!savedQuote) {
  throw new Error("Pilot A could not see its saved quote.");
}

if (
  Number(savedQuote.tax) !== Number((Number(savedQuote.subtotal) * 0.15).toFixed(2))
  || Number(savedQuote.total) !== Number((Number(savedQuote.subtotal) + Number(savedQuote.tax)).toFixed(2))
) {
  throw new Error("Saved quote did not respect the company's 15% VAT setting.");
}

await exportQuote(sessions[0], savedQuote.id);
await exportInvoice(sessions[0], savedInvoice.id);
await updateInvoice(sessions[0], savedInvoice.id, "sent");
await recordPayment(sessions[0], savedInvoice.id, savedInvoice.total);
await sendFeedback(sessions[0]);
const analyticsA = await analytics(sessions[0]);
const paidInvoices = await invoices(sessions[0]);
const paidInvoice = paidInvoices.invoices.find((invoice) => invoice.id === savedInvoice.id);

if (paidInvoice?.status !== "paid") {
  throw new Error("Invoice status did not update to paid.");
}

const expectedFunnelSteps = [
  "sign_up",
  "company_created",
  "pricing_configured",
  "quote_generated",
  "job_saved",
  "quote_exported",
  "invoice_exported",
  "feedback_submitted",
];
const missingFunnelStep = expectedFunnelSteps.find(
  (step) => (analyticsA.funnel?.find((item) => item.id === step)?.count ?? 0) < 1,
);

if ((analyticsA.counts?.payment_recorded ?? 0) < 1 || (analyticsA.counts?.feedback_submitted ?? 0) < 1) {
  throw new Error("Analytics did not record payment and feedback events.");
}

if (!analyticsA.failures || !Array.isArray(analyticsA.recentFailures)) {
  throw new Error(
    `Pilot support dashboard did not return failure visibility. Keys: ${Object.keys(analyticsA).join(", ")}`,
  );
}

if (missingFunnelStep) {
  throw new Error(`Analytics funnel did not record ${missingFunnelStep}.`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      marker,
      savedJobId,
      sequentialSaves: savedPacks.length,
      quoteNumbers,
      invoiceNumbers,
      savedInvoiceId: savedInvoice.id,
      savedQuoteId: savedQuote.id,
      invoiceStatus: paidInvoice.status,
      feedbackEvents: analyticsA.counts?.feedback_submitted ?? 0,
      funnelSteps: analyticsA.funnel?.length ?? 0,
      paymentEvents: analyticsA.counts?.payment_recorded ?? 0,
      pilotAJobs: jobsA.jobs.length,
      pilotBJobs: jobsB.jobs.length,
      pilotAInvoices: invoicesA.invoices.length,
      pilotBInvoices: invoicesB.invoices.length,
      tenantIsolation: "passed",
      serverGeneratedNumbering: "passed",
      priceListImport: "passed",
      companyVat: "passed",
      observabilityDashboard: "passed",
    },
    null,
    2,
  ),
);
