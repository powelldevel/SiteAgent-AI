import type { PriceCategory } from "./types";

export type ParsedPriceRow = {
  sourceLine: string;
  name: string;
  category: PriceCategory;
  currency: "ZAR" | "USD" | "EUR" | "GBP" | null;
  unit: string;
  unitPrice: number | null;
  error: string | null;
};

const CURRENCY_PATTERN = /(?:\bZAR\b|R(?=\s*\d)|\bUSD\b|\$|€|\bEUR\b|£|\bGBP\b)/i;

function detectCurrency(value: string): ParsedPriceRow["currency"] {
  const token = value.match(CURRENCY_PATTERN)?.[0]?.toUpperCase();

  if (!token) return null;
  if (token === "R" || token === "ZAR") return "ZAR";
  if (token === "$" || token === "USD") return "USD";
  if (token === "€" || token === "EUR") return "EUR";
  return "GBP";
}

function inferCategory(name: string): PriceCategory {
  const normalized = name.toLowerCase();

  if (/\b(labou?r|workmanship|technician|installer)\b/.test(normalized)) return "labour";
  if (/\b(delivery|transport|courier|travel)\b/.test(normalized)) return "delivery";
  if (/\b(call[\s-]?out|inspection|assessment|site visit)\b/.test(normalized)) return "fee";
  if (/\b(service|repair|installation|maintenance)\b/.test(normalized)) return "service";
  return "material";
}

function normalizeUnit(rawUnit?: string) {
  const value = rawUnit?.trim().replace(/^[/-]+/, "").replace(/^per\s+/i, "") || "each";
  const normalized = value.toLowerCase();
  const aliases: Record<string, string> = {
    d: "day",
    day: "day",
    days: "day",
    hr: "hour",
    hrs: "hour",
    hour: "hour",
    hours: "hour",
    m: "metre",
    meter: "metre",
    meters: "metre",
    metre: "metre",
    metres: "metre",
    ea: "each",
    each: "each",
    item: "each",
    unit: "each",
    kg: "kg",
    l: "litre",
    litre: "litre",
    litres: "litre",
    cube: "cube",
    cubes: "cube",
    sqm: "m2",
    "m²": "m2",
    m2: "m2",
  };

  return aliases[normalized] ?? normalized.slice(0, 40);
}

export function parsePriceListLine(sourceLine: string): ParsedPriceRow {
  const line = sourceLine.trim();
  const currency = detectCurrency(line);
  const priceMatch = line.match(/(?:\bZAR\b|R|\bUSD\b|\$|€|\bEUR\b|£|\bGBP\b)\s*([0-9][0-9\s,.]*)/i);

  if (!line) {
    return { sourceLine, name: "", category: "material", currency: null, unit: "each", unitPrice: null, error: "Empty row." };
  }

  if (!priceMatch || priceMatch.index === undefined) {
    return {
      sourceLine,
      name: line.slice(0, 120),
      category: inferCategory(line),
      currency,
      unit: "each",
      unitPrice: null,
      error: "Add a price using R or ZAR, for example R450.",
    };
  }

  const name = line.slice(0, priceMatch.index).trim().replace(/[-:]+$/, "").trim();
  const amountText = priceMatch[1].replace(/\s/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const unitPrice = Number(amountText);
  const trailingText = line.slice(priceMatch.index + priceMatch[0].length).trim();
  const unitMatch = trailingText.match(/^(?:\/|per\s+)(.+)$/i);
  const unit = normalizeUnit(unitMatch?.[1]);

  let error: string | null = null;
  if (!name) error = "Add an item name before the price.";
  else if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10_000_000) error = "Enter a valid price below R10,000,000.";
  else if (currency !== "ZAR") error = currency ? `${currency} is not supported. Use ZAR prices.` : "Add R or ZAR before the price.";

  return {
    sourceLine,
    name: name.slice(0, 120),
    category: inferCategory(name),
    currency,
    unit,
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
    error,
  };
}

export function parsePriceList(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map(parsePriceListLine);
}
