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
const password = "SiteGentNumbering12345!";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Numbering checks require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const server = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

let userId;
let companyId;

try {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `sitegent-numbering-${timestamp}@example.com`,
      password,
      name: "Numbering Test",
      companyName: `Numbering Test ${timestamp}`,
      phone: "+27000000000",
      address: "Numbering test address",
    }),
  });

  if (!signup.session?.access_token || !signup.user?.id || !signup.profile?.companyId) {
    throw new Error("Signup did not return a session and company profile.");
  }

  userId = signup.user.id;
  companyId = signup.profile.companyId;
  const authorization = `Bearer ${signup.session.access_token}`;
  const saved = [];

  for (let index = 0; index < 5; index += 1) {
    const sequence = index + 1;
    const result = await request("/api/operations/save", {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        originalMessage: `Numbering test ${timestamp}, job ${sequence}.`,
        extractionMode: "test",
        job: {
          customerName: `Test Customer ${sequence}`,
          phone: "082 555 0142",
          location: "Pretoria",
          jobType: "Maintenance",
          title: `Numbering test job ${sequence}`,
          materials: [],
          estimatedDate: "Date to confirm",
          urgency: "low",
          missingDetails: [],
          summary: `Numbering test job ${sequence}.`,
          quoteItems: [
            {
              description: "Test labour",
              quantity: 1,
              unitPrice: 100 + sequence,
              total: 100 + sequence,
              pricingSource: "manual",
              confidence: "medium",
              pricingStatus: "estimated",
            },
          ],
          followUpMessage: "This is an automated numbering test.",
        },
        quote: {
          quoteNumber: "CLIENT-SUPPLIED-NUMBER-MUST-BE-IGNORED",
          subtotal: 100 + sequence,
          tax: (100 + sequence) * 0.15,
          total: (100 + sequence) * 1.15,
          items: [
            {
              description: "Test labour",
              quantity: 1,
              unitPrice: 100 + sequence,
              total: 100 + sequence,
              pricingSource: "manual",
              confidence: "medium",
              pricingStatus: "estimated",
            },
          ],
        },
      }),
    });

    saved.push(result.records);
  }

  const quoteNumbers = saved.map((record) => record.quoteNumber);
  const invoiceNumbers = saved.map((record) => record.invoiceNumber);
  const quoteMatches = quoteNumbers.map((number) => number.match(/^SG-Q-(\d{4})-(\d{6})$/));
  const invoiceMatches = invoiceNumbers.map((number) => number.match(/^SG-I-(\d{4})-(\d{6})$/));

  if (new Set(quoteNumbers).size !== 5 || new Set(invoiceNumbers).size !== 5) {
    throw new Error("Document numbers are not unique.");
  }

  for (let index = 0; index < 5; index += 1) {
    const quoteMatch = quoteMatches[index];
    const invoiceMatch = invoiceMatches[index];

    if (!quoteMatch || !invoiceMatch) {
      throw new Error(`Save ${index + 1} returned an invalid document number format.`);
    }

    if (quoteMatch[1] !== invoiceMatch[1] || quoteMatch[2] !== invoiceMatch[2]) {
      throw new Error(`Save ${index + 1} returned mismatched quote and invoice numbers.`);
    }

    if (index > 0 && Number(quoteMatch[2]) !== Number(quoteMatches[index - 1][2]) + 1) {
      throw new Error("Quote and invoice sequences are not consecutive.");
    }
  }

  const { data: quotes, error: quotesError } = await server
    .from("quotes")
    .select("quote_number")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  const { data: invoices, error: invoicesError } = await server
    .from("invoices")
    .select("invoice_number")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (quotesError || invoicesError) {
    throw new Error(`Could not verify persisted numbers: ${quotesError?.message ?? invoicesError?.message}`);
  }

  if (quotes?.length !== 5 || invoices?.length !== 5) {
    throw new Error("The database does not contain all five quotes and invoices.");
  }

  console.log(JSON.stringify({
    ok: true,
    projectRef,
    migrationBehavior: "server-generated numbering active",
    savedJobs: saved.length,
    quoteNumbers,
    invoiceNumbers,
    persistedQuotes: quotes.map((quote) => quote.quote_number),
    persistedInvoices: invoices.map((invoice) => invoice.invoice_number),
  }, null, 2));
} finally {
  if (userId) await server.auth.admin.deleteUser(userId);
  if (companyId) await server.from("companies").delete().eq("id", companyId);
}
