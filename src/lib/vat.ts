export type VatSettings = {
  vatRegistered: boolean;
  vatRate: number;
};

export const DEFAULT_VAT_RATE = 0.15;

export function normalizeVatRate(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_VAT_RATE;
  return Math.min(1, Math.max(0, value));
}

export function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateVatTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  settings: VatSettings,
) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + roundMoney(item.quantity * item.unitPrice), 0),
  );
  const vatRate = settings.vatRegistered ? normalizeVatRate(settings.vatRate) : 0;
  const tax = roundMoney(subtotal * vatRate);

  return {
    subtotal,
    tax,
    total: roundMoney(subtotal + tax),
    vatRegistered: settings.vatRegistered,
    vatRate,
  };
}
