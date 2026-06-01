const baseUrl = process.env.SITEGENT_URL ?? "http://127.0.0.1:3000";

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function optionalJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok && response.status !== 401) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return { status: response.status, body };
}

const message =
  "Thabo here from Modimolle. Need 6 cubes river sand and 2 cubes 19mm stone delivered before Friday. Please quote me on 082 555 0142.";

const home = await fetch(baseUrl);
if (!home.ok) {
  throw new Error(`Home page returned ${home.status}`);
}

const extraction = await request("/api/ai/extract", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message }),
});

if (!extraction.job?.title || !Array.isArray(extraction.job.quoteItems) || extraction.job.quoteItems.length === 0) {
  throw new Error("Extraction did not return a complete job with quote items.");
}

const configStatus = await request("/api/config/status");
const savedJobs = await optionalJson("/api/saved-jobs");
const quote = await fetch(`${baseUrl}/api/documents/quote?id=quote-ai`);
const invoice = await fetch(`${baseUrl}/api/documents/invoice?id=invoice-ai`);

if (!quote.ok) {
  throw new Error(`Quote document returned ${quote.status}`);
}

if (!invoice.ok) {
  throw new Error(`Invoice document returned ${invoice.status}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      extractionMode: extraction.mode,
      extractedTitle: extraction.job.title,
      openAiConfigured: Boolean(configStatus.openai?.configured),
      savedJobsStatus: savedJobs.status,
      savedJobsConnected: Boolean(savedJobs.body?.connected),
      supabaseConfigured: Boolean(configStatus.supabase?.configured),
      quoteStatus: quote.status,
      invoiceStatus: invoice.status,
    },
    null,
    2,
  ),
);
