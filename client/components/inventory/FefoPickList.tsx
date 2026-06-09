import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageSearch, ArrowRight } from "lucide-react";
import { formatExpiryDate, expiryBadgeClass, expiryLabel, expiryStatus } from "@/lib/expiry";
import type { ExpiryAlertItem } from "@shared/api";
import { cn } from "@/lib/utils";

/** FEFO — First Expired, First Out: что отгружать в первую очередь */
export function FefoPickList({
  items,
  limit = 5,
  compact,
}: {
  items: ExpiryAlertItem[];
  limit?: number;
  compact?: boolean;
}) {
  const picks = [...items]
    .filter((i) => i.status !== "ok")
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, limit);

  if (picks.length === 0) return null;

  return (
    <Card className={cn("border-violet-500/25 bg-violet-50/30 dark:bg-violet-500/[0.04]", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PackageSearch className="h-4 w-4 text-violet-600 shrink-0" />
          <h2 className={cn("font-semibold text-violet-900 dark:text-violet-200", compact ? "text-sm" : "text-base")}>
            Отгрузить первым (FEFO)
          </h2>
        </div>
        {!compact && (
          <Link to="/expiry" className="text-xs font-medium text-primary inline-flex items-center gap-1">
            Все партии
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="space-y-1.5">
        {picks.map((item, idx) => {
          const status = expiryStatus(item.expiryDate);
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 text-sm rounded-lg border border-border/50 bg-background/60 px-3 py-2"
            >
              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{item.productName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.batchCode} · {item.quantity} {item.unit}
                  {item.cell ? ` · ${item.cell}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={cn(
                    "inline-block text-[10px] font-semibold rounded-full border px-1.5 py-0.5",
                    expiryBadgeClass(status)
                  )}
                >
                  {expiryLabel(status)}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatExpiryDate(item.expiryDate)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {compact && (
        <Button variant="link" size="sm" className="mt-2 h-auto p-0" asChild>
          <Link to="/expiry">Подробнее →</Link>
        </Button>
      )}
    </Card>
  );
}

export function flattenExpiryItems(summary: {
  expired: ExpiryAlertItem[];
  today: ExpiryAlertItem[];
  tomorrow: ExpiryAlertItem[];
  week: ExpiryAlertItem[];
  month: ExpiryAlertItem[];
}): ExpiryAlertItem[] {
  return [
    ...summary.expired,
    ...summary.today,
    ...summary.tomorrow,
    ...summary.week,
    ...summary.month,
  ];
}
