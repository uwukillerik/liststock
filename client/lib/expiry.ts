import type { ProductBatch, ExpiryAlertItem, ExpiryAlertsSummary } from "@shared/api";

export type ExpiryStatus =
  | "expired"
  | "today"
  | "tomorrow"
  | "week"
  | "month"
  | "ok";

export function expiryStatus(expiryDateStr: string, now = new Date()): ExpiryStatus {
  const exp = parseDateOnly(expiryDateStr);
  const today = startOfDay(now);
  const diffDays = Math.floor((exp.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return "expired";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "week";
  if (diffDays <= 30) return "month";
  return "ok";
}

export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function expiryLabel(status: ExpiryStatus): string {
  switch (status) {
    case "expired":
      return "Просрочено";
    case "today":
      return "Истекает сегодня";
    case "tomorrow":
      return "Завтра срок";
    case "week":
      return "До 7 дней";
    case "month":
      return "До 30 дней";
    default:
      return "В норме";
  }
}

export function expiryBadgeClass(status: ExpiryStatus): string {
  switch (status) {
    case "expired":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "today":
      return "bg-red-500/20 text-red-800 dark:text-red-200 border-red-500/40 animate-pulse";
    case "tomorrow":
      return "bg-orange-500/15 text-orange-800 dark:text-orange-200 border-orange-500/30";
    case "week":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30";
    case "month":
      return "bg-yellow-500/10 text-yellow-800 dark:text-yellow-200 border-yellow-500/20";
    default:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  }
}

export function formatExpiryDate(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntilExpiry(expiryDateStr: string, now = new Date()): number {
  const exp = parseDateOnly(expiryDateStr);
  const today = startOfDay(now);
  return Math.floor((exp.getTime() - today.getTime()) / 86400000);
}

export function groupAlerts(items: ExpiryAlertItem[]): ExpiryAlertsSummary {
  const summary: ExpiryAlertsSummary = {
    expired: [],
    today: [],
    tomorrow: [],
    week: [],
    month: [],
    counts: { expired: 0, today: 0, tomorrow: 0, week: 0, month: 0, total: items.length },
  };
  for (const item of items) {
    summary.counts[item.status]++;
    summary[item.status].push(item);
  }
  return summary;
}

export function mapBatchToAlert(batch: ProductBatch): ExpiryAlertItem {
  const status = expiryStatus(batch.expiryDate);
  return {
    id: batch.id,
    productId: batch.productId,
    productName: batch.productName ?? "",
    productSku: batch.productSku ?? "",
    batchCode: batch.batchCode,
    quantity: batch.quantity,
    unit: batch.unit ?? "шт",
    expiryDate: batch.expiryDate,
    status,
    location: batch.location,
    cell: batch.cell,
    daysLeft: daysUntilExpiry(batch.expiryDate),
  };
}
