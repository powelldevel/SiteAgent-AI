import assert from "node:assert/strict";
import { buildPilotFunnel } from "../src/lib/pilot-analytics.ts";

const users = [
  { id: "user-a", company_id: "company-a" },
  { id: "user-b", company_id: "company-b" },
  { id: "user-c", company_id: "company-c" },
];
const funnel = buildPilotFunnel(users, new Set(["company-a", "company-b"]), [
  { company_id: "company-a", task_type: "quote_generated", input: { userId: "user-a" } },
  { company_id: "company-b", task_type: "quote_generated", input: {} },
  { company_id: "company-a", task_type: "job_saved", input: { userId: "user-a" } },
  { company_id: "company-a", task_type: "quote_exported", input: { userId: "user-a" } },
  { company_id: "company-a", task_type: "invoice_exported", input: { userId: "user-a" } },
  { company_id: "company-a", task_type: "pilot_feedback", input: { userId: "user-a" } },
]);

assert.equal(funnel.find((step) => step.id === "sign_up")?.count, 3);
assert.equal(funnel.find((step) => step.id === "pricing_configured")?.count, 2);
assert.equal(funnel.find((step) => step.id === "quote_generated")?.count, 2);
assert.equal(funnel.find((step) => step.id === "job_saved")?.count, 1);
assert.equal(funnel.find((step) => step.id === "feedback_submitted")?.count, 1);
assert.equal(funnel.find((step) => step.id === "job_saved")?.dropOff, 1);
assert.equal(funnel.find((step) => step.id === "pricing_configured")?.conversionRate, 67);

console.log("Pilot analytics checks passed.");
