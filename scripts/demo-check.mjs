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

const health = await request("/api/health");
const readiness = await fetch(`${baseUrl}/api/readiness`);
if (![200, 503].includes(readiness.status)) {
  throw new Error(`Readiness returned unexpected status ${readiness.status}`);
}

const extractionResponse = await fetch(`${baseUrl}/api/ai/extract`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message }),
});
const extraction = await extractionResponse.json();

if (extractionResponse.status === 200) {
  if (
    extraction.mode !== "demo"
    || !extraction.job?.title
    || !Array.isArray(extraction.job.quoteItems)
    || extraction.job.quoteItems.length === 0
  ) {
    throw new Error("Anonymous extraction succeeded outside intentional demo mode.");
  }
} else if (extractionResponse.status !== 401) {
  throw new Error(`/api/ai/extract returned unexpected status ${extractionResponse.status}: ${JSON.stringify(extraction)}`);
}

const configStatus = await request("/api/config/status");
const savedJobs = await optionalJson("/api/saved-jobs");

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      healthOk: Boolean(health.ok),
      readinessStatus: readiness.status,
      anonymousExtractionStatus: extractionResponse.status,
      extractionMode: extraction.mode ?? "blocked",
      extractedTitle: extraction.job?.title ?? null,
      openAiConfigured: Boolean(configStatus.openai?.configured),
      savedJobsStatus: savedJobs.status,
      savedJobsConnected: Boolean(savedJobs.body?.connected),
      supabaseConfigured: Boolean(configStatus.supabase?.configured),
    },
    null,
    2,
  ),
);
