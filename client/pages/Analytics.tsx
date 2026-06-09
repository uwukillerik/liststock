import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchAnalytics } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  AlertCircle,
  Package,
  Activity,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openAnalyticsPrintReport } from "@/lib/reports";
import { toast } from "sonner";

export default function Analytics() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    enabled: user?.role === "admin",
    staleTime: 30_000,
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex-1 overflow-auto">
        <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
          <Card className="p-8 text-center max-w-md shadow-sm">
            <div className="p-4 bg-destructive/10 rounded-lg w-fit mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Доступ ограничен
            </h2>
            <p className="text-sm text-muted-foreground">
              Раздел статистики доступен только администратору. Кладовщик может
              искать напитки и смотреть ячейки в каталоге.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
          Загрузка статистики…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <Card className="p-6 max-w-lg mx-auto mt-12 text-center text-sm text-destructive">
          Не удалось загрузить аналитику. Проверьте подключение к серверу.
        </Card>
      </div>
    );
  }

  const stockLevelData = [
    {
      name: "В норме",
      value: data.stockLevels.ok,
      color: "hsl(142, 71%, 45%)",
    },
    {
      name: "Низкий запас",
      value: data.stockLevels.low,
      color: "hsl(38, 92%, 50%)",
    },
    {
      name: "Критический",
      value: data.stockLevels.critical,
      color: "hsl(0, 84%, 60%)",
    },
  ].filter((d) => d.value > 0);

  const topCategories = [...data.categories]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  const totalQuantity = data.totals.units;
  const avgQuantity =
    data.totals.kinds > 0
      ? Math.round(totalQuantity / data.totals.kinds)
      : 0;
  const lowStockCount = data.stockLevels.low + data.stockLevels.critical;

  const movementChart = data.movementActivity
    .filter((m) => m.unitsMoved > 0)
    .slice(0, 8)
    .map((m) => ({
      name:
        m.name.length > 22 ? `${m.name.slice(0, 20)}…` : m.name,
      activity: m.unitsMoved,
    }));

  const COLORS = ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#84cc16"];

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-gradient-to-br from-background to-muted/20 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1">
                ListStock
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                Сводка по складу
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                Категории, зоны хранения, уровни запаса и движение за 30 дней
                (приёмка и корректировки).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2 min-h-11"
              onClick={() => {
                try {
                  openAnalyticsPrintReport(data);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Не удалось открыть отчёт"
                  );
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Печать / PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Позиций в каталоге
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2 tabular-nums">
                    {data.totals.kinds}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                  <Package className="h-6 w-6 text-primary" aria-hidden />
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Единиц на складе
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2 tabular-nums">
                    {totalQuantity}
                  </p>
                </div>
                <div className="p-3 bg-accent/10 rounded-lg shrink-0">
                  <TrendingUp className="h-6 w-6 text-accent" aria-hidden />
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    В среднем на позицию
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2 tabular-nums">
                    {avgQuantity}
                  </p>
                </div>
                <div className="p-3 bg-sky-500/10 rounded-lg shrink-0">
                  <Activity className="h-6 w-6 text-sky-600" aria-hidden />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-amber-500/20 bg-amber-500/[0.03] shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Требуют внимания
                  </p>
                  <p className="text-3xl font-semibold text-foreground mt-2 tabular-nums">
                    {lowStockCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    низкий и критический запас
                  </p>
                </div>
                <div className="p-3 bg-amber-500/15 rounded-lg shrink-0">
                  <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Уровень запаса
              </h2>
              {stockLevelData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  Нет данных для диаграммы
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={stockLevelData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={88}
                        dataKey="value"
                      >
                        {stockLevelData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-2">
                    {stockLevelData.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}: {item.value}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card className="p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Категории по объёму остатков
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topCategories}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="quantity"
                    fill="hsl(217, 91%, 60%)"
                    name="Количество единиц"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {movementChart.length > 0 && (
            <Card className="p-6 mb-8 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Движение за 30 дней
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Сумма модулей изменений по каждой позиции (первичный ввод и
                корректировки количества).
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={movementChart} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="activity"
                    fill="hsl(199, 89%, 48%)"
                    name="Активность"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6">
            <Card className="p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Категории: позиции и остатки
              </h2>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={data.categories}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    fill={COLORS[0]}
                    name="Число позиций"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="quantity"
                    fill={COLORS[1]}
                    name="Единиц на складе"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Зоны хранения
              </h2>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        Место / зона
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        Позиций
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        Единиц
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        Доля
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.locations.map((location) => {
                      const pct =
                        totalQuantity > 0
                          ? ((location.quantity / totalQuantity) * 100).toFixed(
                              1
                            )
                          : "0";
                      return (
                        <tr
                          key={location.name}
                          className="border-b border-border hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {location.name}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {location.kinds}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {location.quantity}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 max-w-[200px]">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-10">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
