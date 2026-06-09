import { cn } from "@/lib/utils";
import {
  expiryStatus,
  expiryLabel,
  expiryBadgeClass,
  formatExpiryDate,
  daysUntilExpiry,
} from "@/lib/expiry";

export function ExpiryBadge({
  expiryDate,
  className,
  showDate,
}: {
  expiryDate?: string | null;
  className?: string;
  showDate?: boolean;
}) {
  if (!expiryDate) return null;
  const status = expiryStatus(expiryDate);
  if (status === "ok") return null;

  const days = daysUntilExpiry(expiryDate);
  const detail =
    status === "expired"
      ? `просрочено ${Math.abs(days)} дн.`
      : status === "today"
        ? "сегодня"
        : status === "tomorrow"
          ? "завтра"
          : `${days} дн.`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight",
        expiryBadgeClass(status),
        className
      )}
      title={formatExpiryDate(expiryDate)}
    >
      {expiryLabel(status)}
      {showDate && <span className="opacity-80">· {formatExpiryDate(expiryDate)}</span>}
      {!showDate && <span className="opacity-75">({detail})</span>}
    </span>
  );
}
