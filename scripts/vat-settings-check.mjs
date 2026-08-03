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
const password = "SiteGentVat12345!";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("VAT checks require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const server = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUsers = [];
const createdCompanies = [];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function headers(token) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function createCompany(label) {
  const result = await request("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `sitegent-vat-${label}-${timestamp}@example.com`,
      password,
      name: `${label} VAT Tester`,
      companyName: `${label} VAT Company ${timestamp}`,
    }),
  });

  if (!result.session?.access_token || !result.user?.id || !result.profile?.companyId) {
    throw new Error(`Could not create ${label} VAT test company.`);
  }

  createdUsers.push(result.user.id);
  createdCompanies.push(result.profile.companyId);
  return {
    token: result.session.access_token,
    companyId: result.profile.companyId,
  };
}

async function setVat(token, vatRegistered, vatRate = 0.15) {
  return request("/api/auth/me", {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify({ vatRegistered, vatRate }),
  });
}

function operationPack(label) {
  const item = {
    description: `${label} labour`,
    quantity: 2,
    unitPrice: 500,
    total: 1,
    pricingSource: "manual",
  };

  return {
    originalMessage: `${label} VAT test job`,
    extractionMode: "vat-check",
    job: {
      customerName: `${label} Customer`,
      phone: "0820000000",
      location: "Pretoria",
      jobType: "Service",
      title: `${label} VAT job`,
      materials: [],
      estimatedDate: "Tomorrow",
      urgency: "medium",
      missingDetails: [],
      summary: "VAT settings integration test.",
      quoteItems: [item],
      followUpMessage: "Thanks, your quote is ready.",
    },
    quote: {
      subtotal: 1,
      tax: 999,
      total: 1000,
      items: [item],
    },
  };
}

async function save(token, label) {
  return request("/api/operations/save", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(operationPack(label)),
  });
}

async function exportQuote(token, quoteId) {
  return request(`/api/documents/quote?id=${encodeURIComponent(quoteId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

try {
  const nonVat = await createCompany("NonRegistered");
  const vat = await createCompany("Registered");

  await setVat(nonVat.token, false);
  await setVat(vat.token, true, 0.15);

  const nonVatSave = await save(nonVat.token, "NonRegistered");
  const vatSave = await save(vat.token, "Registered");

  if (
    nonVatSave.records.subtotal !== 1000
    || nonVatSave.records.tax !== 0
    || nonVatSave.records.total !== 1000
    || nonVatSave.records.vatRegistered !== false
  ) {
    throw new Error(`Non-VAT totals are wrong: ${JSON.stringify(nonVatSave.records)}`);
  }

  if (
    vatSave.records.subtotal !== 1000
    || vatSave.records.tax !== 150
    || vatSave.records.total !== 1150
    || vatSave.records.vatRegistered !== true
    || vatSave.records.vatRate !== 0.15
  ) {
    throw new Error(`VAT-registered totals are wrong: ${JSON.stringify(vatSave.records)}`);
  }

  const nonVatExportBefore = await exportQuote(nonVat.token, nonVatSave.records.quoteId);
  const vatExport = await exportQuote(vat.token, vatSave.records.quoteId);

  if (!nonVatExportBefore.includes("Not charged") || nonVatExportBefore.includes("VAT 15%")) {
    throw new Error("Non-VAT export incorrectly shows VAT as charged.");
  }

  if (!vatExport.includes("VAT 15%") || !vatExport.includes("R150.00")) {
    throw new Error("VAT-registered export does not show the configured VAT clearly.");
  }

  await setVat(nonVat.token, true, 0.15);
  const nonVatExportAfter = await exportQuote(nonVat.token, nonVatSave.records.quoteId);

  if (!nonVatExportAfter.includes("Not charged")) {
    throw new Error("Changing company settings rewrote the VAT treatment of an existing quote.");
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    nonVatRegistered: {
      subtotal: nonVatSave.records.subtotal,
      tax: nonVatSave.records.tax,
      total: nonVatSave.records.total,
      export: "VAT not charged",
    },
    vatRegistered: {
      subtotal: vatSave.records.subtotal,
      tax: vatSave.records.tax,
      total: vatSave.records.total,
      vatRate: vatSave.records.vatRate,
      export: "VAT 15% shown",
    },
    manipulatedClientTotals: "ignored",
    historicalQuoteSnapshot: "preserved",
  }, null, 2));
} finally {
  for (const userId of createdUsers) {
    await server.auth.admin.deleteUser(userId);
  }
  for (const companyId of createdCompanies) {
    await server.from("companies").delete().eq("id", companyId);
  }
}
