import assert from "node:assert/strict";
import { parsePriceList, parsePriceListLine } from "../src/lib/price-list-parser.ts";

const rows = parsePriceList("Labour R950/day\nCallout R450\nPVC Pipe R85/m\nSealant R120");

assert.deepEqual(
  rows.map(({ name, category, currency, unit, unitPrice, error }) => ({ name, category, currency, unit, unitPrice, error })),
  [
    { name: "Labour", category: "labour", currency: "ZAR", unit: "day", unitPrice: 950, error: null },
    { name: "Callout", category: "fee", currency: "ZAR", unit: "each", unitPrice: 450, error: null },
    { name: "PVC Pipe", category: "material", currency: "ZAR", unit: "metre", unitPrice: 85, error: null },
    { name: "Sealant", category: "material", currency: "ZAR", unit: "each", unitPrice: 120, error: null },
  ],
);

assert.equal(parsePriceListLine("Delivery ZAR 1,250 per load").unitPrice, 1250);
assert.equal(parsePriceListLine("Technician R850/hour").category, "labour");
assert.match(parsePriceListLine("PVC Pipe $85/m").error ?? "", /not supported/);
assert.match(parsePriceListLine("Broken row").error ?? "", /Add a price/);
assert.match(parsePriceListLine("R450/day").error ?? "", /item name/);
assert.equal(parsePriceList("\n\nLabour R950/day\n").length, 1);
assert.equal(parsePriceList(Array.from({ length: 60 }, (_, index) => `Item ${index} R10`).join("\n")).length, 50);

console.log("Price list parser checks passed.");
