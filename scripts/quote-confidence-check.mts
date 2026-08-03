import assert from "node:assert/strict";
import { applyCompanyPriceList } from "../src/lib/ai.ts";
import { getQuotePricingStatus, quoteConfidenceView } from "../src/lib/quote-confidence.ts";
import type { ExtractedJob, PriceItem, QuoteItem } from "../src/lib/types.ts";

const baseItem: QuoteItem = { description: "PVC pipe", quantity: 2, unitPrice: 85, total: 170 };
assert.equal(getQuotePricingStatus({ ...baseItem, pricingSource: "company_price_list" }), "matched");
assert.equal(getQuotePricingStatus({ ...baseItem, pricingSource: "ai_estimate" }), "estimated");
assert.equal(getQuotePricingStatus({ ...baseItem, unitPrice: 0 }), "needs_review");
assert.equal(getQuotePricingStatus({ ...baseItem, unitPrice: 0, pricingStatus: "estimated" }), "needs_review");
assert.equal(quoteConfidenceView({ ...baseItem, unitPrice: 0 }).label, "Needs review");

const job: ExtractedJob = {
  customerName: "Customer",
  phone: "0820000000",
  location: "Pretoria",
  jobType: "Plumbing",
  title: "Pipe repair",
  materials: ["PVC pipe"],
  estimatedDate: "Tomorrow",
  urgency: "medium",
  missingDetails: [],
  summary: "Replace PVC pipe",
  quoteItems: [
    { description: "2m PVC pipe", quantity: 2, unitPrice: 100, total: 200 },
    { description: "Call-out and transport", quantity: 1, unitPrice: 550, total: 550 },
  ],
  followUpMessage: "Thanks",
};
const prices: PriceItem[] = [
  { id: "1", name: "PVC Pipe", category: "material", unit: "metre", unitPrice: 85, vatRate: 0.15, aliases: [], notes: null, active: true },
];
const priced = applyCompanyPriceList(job, prices);
assert.equal(priced.quoteItems[0].pricingStatus, "matched");
assert.equal(priced.quoteItems[0].unitPrice, 85);
assert.equal(priced.quoteItems[1].pricingStatus, "estimated");

console.log("Quote confidence checks passed.");
