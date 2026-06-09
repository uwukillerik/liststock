import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMovements } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reasonLabel } from "@/lib/beverage";
import { openMovementsPrintReport } from "@/lib/reports";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  History,
  Printer,
  User2,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export default function Movements() {
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["movements", page],
    queryFn: () =>
      fetchMovements({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    staleTime: 30_000,
  });

  const movements = data?.movements ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-10 md:pt-8 md:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              История движений
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Загрузка…" : `${total} записей · приёмки, продажи, корректировки`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => {
                try {
                  openMovementsPrintReport(movements);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Ошибка печати");
                }
              }}
              disabled={!movements.length}
            >
              <Printer className="h-3.5 w-3.5" />
              Печать
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Обновить
            </Button>
          </div>
        </div>

        {/* Desktop table */}
        <Card className="hidden md:block overflow-hidden border-border/70 shadow-sm mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дата / Время
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Напиток
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Артикул
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Причина
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Кладовщик
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Изменение
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Остаток
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      Движений ещё нет
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(m.createdAt), "dd MMM yyyy, HH:mm", { locale: ru })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium max-w-[200px] truncate">{m.productName}</div>
                        {m.note && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                            {m.note}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {m.productSku}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs rounded-full px-2.5 py-1 bg-muted font-medium">
                          {reasonLabel(m.reason)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {m.userName ? (
                          <span className="inline-flex items-center gap-1">
                            <User2 className="h-3 w-3" />
                            {m.userName}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-bold tabular-nums",
                            m.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {m.delta > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {m.delta > 0 ? `+${m.delta}` : m.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {m.balanceAfter}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <Card className="p-10 text-center text-muted-foreground">Загрузка…</Card>
          ) : movements.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed">
              <History className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Движений ещё нет</p>
            </Card>
          ) : (
            movements.map((m) => (
              <Card key={m.id} className="p-3.5 border-border/70 shadow-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{m.productName}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{m.productSku}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] rounded-full px-2.5 py-0.5 bg-muted font-medium">
                        {reasonLabel(m.reason)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(m.createdAt), "dd.MM.yy HH:mm")}
                      </span>
                    </div>
                    {m.userName && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <User2 className="h-3 w-3" />
                        {m.userName}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "flex items-center justify-end gap-1 font-bold text-base tabular-nums",
                        m.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {m.delta > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">→ {m.balanceAfter}</div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="gap-1.5"
            >
              Вперёд
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
