import type { GroceryCycle } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.length === 3 ? currency : "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Plain amounts in inputs — always two fraction digits (no grouping). */
export function formatAmountField(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

export function parseNumber(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** e.g. “Compra del 30 de Marzo · March 30, 2026” for task selectors. */
export function composeGroceryTaskLabel(c: GroceryCycle): string {
  const d = new Date(`${(c.anchorDate ?? "").trim()}T12:00:00`);
  const datePart = Number.isNaN(d.getTime())
    ? (c.anchorDate ?? "").trim()
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  const lab = c.label.trim();
  if (lab && datePart) return `${lab} · ${datePart}`;
  if (lab) return lab;
  return datePart || c.id;
}
