import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { zodTextFormat } from "openai/helpers/zod";
import { extractedJobSchema, inferJobFromMessage } from "../src/lib/ai.ts";
import {
  EXTRACTION_PROMPT_VERSION,
  buildExtractionInput,
  createOpenAIClient,
  getOpenAIModel,
  responseTelemetry,
} from "../src/lib/llm.ts";

type EvalCase = {
  id: string;
  message: string;
  expected: { jobType: string; urgency: string; phonePresent: boolean };
};

const live = process.argv.includes("--live");
if (live && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(".env.local"); } catch { /* Environment may already be injected. */ }
}

const cases = JSON.parse(
  await readFile(new URL("../evals/sitegent-extraction.json", import.meta.url), "utf8"),
) as EvalCase[];

assert.ok(cases.length >= 5, "Keep a minimum five-case extraction regression set.");
assert.equal(new Set(cases.map((item) => item.id)).size, cases.length, "Eval IDs must be unique.");

const results = [];
for (const item of cases) {
  const startedAt = Date.now();
  let output;
  let telemetry: Record<string, unknown> = {
    model: "deterministic-fallback",
    promptVersion: EXTRACTION_PROMPT_VERSION,
    latencyMs: 0,
  };

  if (live) {
    const response = await createOpenAIClient().responses.create({
      model: getOpenAIModel(),
      reasoning: { effort: "none" },
      store: false,
      safety_identifier: "sitegent-evaluation-suite",
      text: { format: zodTextFormat(extractedJobSchema, "sitegent_job_extraction") },
      input: buildExtractionInput(item.message),
    });
    output = extractedJobSchema.parse(JSON.parse(response.output_text));
    telemetry = responseTelemetry(response, item.message, `eval-${item.id}`, startedAt);
  } else {
    output = inferJobFromMessage(item.message);
    telemetry.latencyMs = Date.now() - startedAt;
  }

  const checks = {
    jobType: output.jobType === item.expected.jobType,
    urgency: output.urgency === item.expected.urgency,
    phonePresence: item.expected.phonePresent
      ? /(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/.test(output.phone)
      : !/(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/.test(output.phone),
    arithmetic: output.quoteItems.every(
      (line: { total: number; quantity: number; unitPrice: number }) =>
        Math.abs(line.total - line.quantity * line.unitPrice) < 0.01,
    ),
  };
  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  results.push({
    id: item.id,
    score,
    checks,
    actual: { jobType: output.jobType, urgency: output.urgency, phonePresent: /\d{7,}/.test(output.phone.replace(/\s/g, "")) },
    telemetry,
  });
}

const averageScore = results.reduce((sum, item) => sum + item.score, 0) / results.length;
const threshold = live ? 0.8 : 1;
const report = {
  mode: live ? "live" : "offline",
  generatedAt: new Date().toISOString(),
  promptVersion: EXTRACTION_PROMPT_VERSION,
  model: live ? getOpenAIModel() : "deterministic-fallback",
  averageScore,
  threshold,
  passed: averageScore >= threshold,
  results,
};

await mkdir(path.resolve("artifacts"), { recursive: true });
await writeFile(
  path.resolve("artifacts", `llm-eval-${live ? "live" : "offline"}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

assert.ok(report.passed, `Extraction eval scored ${averageScore.toFixed(2)} below ${threshold.toFixed(2)}.`);
console.log(`SiteGent ${report.mode} extraction eval passed: ${(averageScore * 100).toFixed(0)}%.`);
