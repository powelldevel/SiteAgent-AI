import { z } from "zod";
import type { ExtractedJob, PriceItem, QuoteItem, Urgency } from "./types";

export const extractedJobSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().min(1),
  location: z.string().min(1),
  jobType: z.enum(["Plumbing", "Electrical", "Building", "Renovation", "HVAC", "Delivery", "Maintenance"]),
  title: z.string().min(1),
  materials: z.array(z.string()),
  estimatedDate: z.string().min(1),
  urgency: z.enum(["low", "medium", "high"]),
  missingDetails: z.array(z.string()),
  summary: z.string().min(1),
  quoteItems: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      total: z.number().nonnegative(),
    }),
  ),
  followUpMessage: z.string().min(1),
});

const currencyHints: Record<string, number> = {
  plumbing: 1450,
  electrical: 1650,
  building: 2200,
  renovation: 2400,
  hvac: 1850,
  delivery: 2400,
  maintenance: 1250,
};

export function inferJobFromMessage(message: string): ExtractedJob {
  const body = message.trim();
  const lower = body.toLowerCase();
  const phoneMatch = body.match(/(?:\+27|0)\s?\d{2}\s?\d{3}\s?\d{4}/);
  const location =
    ["modimolle", "bela-bela", "mokopane", "polokwane", "gauteng", "pretoria", "johannesburg", "extension 8"].find(
      (place) => lower.includes(place),
    ) ?? "Location to confirm";
  const jobType = lower.includes("deliver") || lower.includes("sand") || lower.includes("stone")
    ? "Delivery"
    : lower.includes("leak") || lower.includes("pipe") || lower.includes("plumb") || lower.includes("shower")
    ? "Plumbing"
    : lower.includes("db") || lower.includes("electric") || lower.includes("breaker")
      ? "Electrical"
      : lower.includes("renovate") || lower.includes("renovation") || lower.includes("drywall") || lower.includes("paint")
        ? "Renovation"
        : lower.includes("wall") || lower.includes("brick") || lower.includes("tile") || lower.includes("slab")
          ? "Building"
          : "Maintenance";
  const urgency: Urgency = lower.includes("urgent") || lower.includes("badly") || lower.includes("asap") || lower.includes("starts saturday")
    ? "high"
    : lower.includes("tomorrow") || lower.includes("today") || lower.includes("friday")
      ? "medium"
      : "low";
  const estimatedDate = lower.includes("friday")
    ? "Before Friday"
    : lower.includes("saturday")
      ? "Before Saturday"
      : lower.includes("tomorrow")
    ? "Tomorrow morning"
    : lower.includes("today")
      ? "Today"
      : "Date to confirm";
  const possibleName =
    body.match(/^([A-Z][a-z]+)\s+(?:here|from)/)?.[1] ??
    body.match(/(?:it's|its|name is|this is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ??
    body.match(/([A-Z][a-z]+)\s+here\s+from/)?.[1] ??
    "Customer";
  const materials = [
    lower.includes("tile") ? "Replacement tiles" : "",
    lower.includes("sealant") ? "Sealant" : "",
    lower.includes("fitting") ? "Fittings" : "",
    lower.includes("river sand") ? "River sand" : lower.includes("sand") ? "Sand" : "",
    lower.includes("19mm stone") ? "19mm stone" : lower.includes("stone") ? "Stone" : "",
    lower.includes("breaker") ? "Breaker" : "",
    lower.includes("drywall") ? "Drywall materials" : "",
    lower.includes("paint") ? "Paint" : "",
  ].filter(Boolean);
  const base = currencyHints[jobType.toLowerCase()] ?? 1350;
  const sandCubes = Number(lower.match(/(\d+)\s*cubes?\s+(?:river\s+)?sand/)?.[1] ?? 0);
  const stoneCubes = Number(lower.match(/(\d+)\s*cubes?\s+(?:19mm\s+)?stone/)?.[1] ?? 0);
  const quoteItems: QuoteItem[] =
    jobType === "Delivery"
      ? [
          {
            description: `${sandCubes || 4} cubes river sand`,
            quantity: sandCubes || 4,
            unitPrice: 650,
            total: (sandCubes || 4) * 650,
          },
          {
            description: `${stoneCubes || 1} cubes 19mm stone`,
            quantity: stoneCubes || 1,
            unitPrice: 760,
            total: (stoneCubes || 1) * 760,
          },
          { description: "Tipper delivery and diesel", quantity: 1, unitPrice: base, total: base },
        ]
      : [
          { description: `${jobType} labour`, quantity: 1, unitPrice: base, total: base },
          {
            description: materials.length ? `${materials.join(", ")} allowance` : "Materials allowance",
            quantity: 1,
            unitPrice: materials.length ? 1250 : 650,
            total: materials.length ? 1250 : 650,
          },
          { description: "Call-out and transport", quantity: 1, unitPrice: 550, total: 550 },
        ];
  const title = `${jobType} job in ${titleCase(location)}`;

  return {
    customerName: possibleName,
    phone: phoneMatch?.[0] ?? "Phone to confirm",
    location: titleCase(location),
    jobType,
    title,
    materials,
    estimatedDate,
    urgency,
    missingDetails: [
      phoneMatch ? "" : "Customer phone number",
      location === "Location to confirm" ? "Exact site address" : "",
      "Site photos before arrival",
    ].filter(Boolean),
    summary: body.length > 190 ? `${body.slice(0, 190)}...` : body,
    quoteItems,
    followUpMessage: `Hi ${possibleName}, thanks for the request. We can help with the ${jobType.toLowerCase()} work in ${titleCase(
      location,
    )}. Please confirm the exact address and send photos so we can finalize your quote.`,
  };
}

export function applyCompanyPriceList(job: ExtractedJob, priceItems: PriceItem[]): ExtractedJob {
  const activePrices = priceItems.filter((item) => item.active);

  return {
    ...job,
    quoteItems: job.quoteItems.map((quoteItem) => {
      const match = findPriceMatch(quoteItem.description, activePrices);

      if (!match) {
        const hasUsablePrice = Number.isFinite(quoteItem.unitPrice) && quoteItem.unitPrice > 0;

        return {
          ...quoteItem,
          pricingSource: "ai_estimate",
          confidence: hasUsablePrice ? "medium" : "low",
          pricingStatus: hasUsablePrice ? "estimated" : "needs_review",
        };
      }

      const total = Number((quoteItem.quantity * match.unitPrice).toFixed(2));

      return {
        ...quoteItem,
        description: `${quoteItem.description} (${match.name})`,
        unitPrice: match.unitPrice,
        total,
        pricingSource: "company_price_list",
        confidence: "high",
        pricingStatus: "matched",
      };
    }),
  };
}

function findPriceMatch(description: string, priceItems: PriceItem[]) {
  const haystack = normalize(description);

  return priceItems.find((item) => {
    const terms = [item.name, ...item.aliases].map(normalize).filter((term) => term.length >= 3);

    return terms.some((term) => phraseMatches(haystack, term));
  });
}

function phraseMatches(haystack: string, term: string) {
  return ` ${haystack} `.includes(` ${term} `);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}
