import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryContext";
import { fetchExpiryAlerts, fetchMovements } from "@/lib/api";
import { FefoPickList, flattenExpiryItems } from "@/components/inventory/FefoPickList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wine,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  LayoutGrid,
  History,
  Package,
  DollarSign,
  TrendingDown,
  Map,
  Clock,
  ClipboardList,
  CalendarClock,
  LayoutGrid as PlanIcon,
  Box,
} from "lucide-react";
import { LOW_STOCK_THRESHOLD, CRITICAL_STOCK_THRESHOLD, formatPrice } from "@/lib/beverage";
import { cn } from "@/lib/utils";

export default function Index() {
  const { user } = useAuth();
  const { products } = useInventory();

  const expiryQ = useQuery({
    queryKey: ["expiry-alerts"],
    queryFn: fetchExpiryAlerts,
  });

  const movementsQ = useQuery({
    queryKey: ["movements", "recent"],
    queryFn: () => fetchMovements({ limit: 5 }),
  });

  const fefoItems = expiryQ.data ? flattenExpiryItems(expiryQ.data) : [];

  const expiryUrgent = expiryQ.data
    ? expiryQ.data.counts.expired +
      expiryQ.data.counts.today +
      expiryQ.data.counts.tomorrow +
      expiryQ.data.counts.week
    : 0;

  const stats = {
    totalProducts: products.length,
    totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
    categories: new Set(products.map((p) => p.category).filter(Boolean)).size,
    lowStock: products.filter(
      (p) => p.quantity < LOW_STOCK_THRESHOLD && p.quantity >= CRITICAL_STOCK_THRESHOLD
    ).length,
    criticalStock: products.filter((p) => p.quantity < CRITICAL_STOCK_THRESHOLD).length,
    totalStockValue: products.reduce(
      (sum, p) => sum + p.quantity * (p.costPrice ?? 0),
      0
    ),
  };

  const recentProducts = [...products]
    .sort(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    )
    .slice(0, 6);

  const criticalProducts = products
    .filter((p) => p.quantity < CRITICAL_STOCK_THRESHOLD)
    .slice(0, 4);

  return (
    <div className="min-h-full overflow-auto">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.05] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
                ListStock
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                Добро пожаловать, {user?.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
                {user?.role === "admin"
                  ? "Остатки, движения, отчёты и управление сотрудниками — в одном месте."
                  : "Найдите напиток по названию, артикулу или штрихкоду и посмотрите ячейку."}
              </p>
            </div>
            <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <Wine className="h-8 w-8" strokeWidth={1.5} />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="p-4 border-border/70 shadow-sm bg-card/80 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Позиций</p>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1">{stats.totalProducts}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stats.categories} категорий</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/70 shadow-sm bg-card/80 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Единиц на складе</p>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1">{stats.totalQuantity}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">всего</p>
                </div>
                <div className="p-2 bg-sky-500/10 rounded-lg shrink-0">
                  <TrendingUp className="h-4 w-4 text-sky-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 border-amber-500/25 bg-amber-50/50 dark:bg-amber-500/[0.05] shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-amber-800/80 dark:text-amber-200/80">Мало на складе</p>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1 text-amber-700 dark:text-amber-300">
                    {stats.lowStock}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {stats.criticalStock} критических
                  </p>
                </div>
                <div className="p-2 bg-amber-500/15 rounded-lg shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </Card>

            {user?.role === "admin" ? (
              <Card className="p-4 border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-500/[0.05] shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/80">
                      Стоимость склада
                    </p>
                    <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-emerald-700 dark:text-emerald-300">
                      {stats.totalStockValue > 0
                        ? formatPrice(stats.totalStockValue)
                        : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">по закупочным ценам</p>
                  </div>
                  <div className="p-2 bg-emerald-500/15 rounded-lg shrink-0">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4 border-border/70 shadow-sm bg-card/80 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Категорий</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1">{stats.categories}</p>
                  </div>
                  <div className="p-2 bg-violet-500/10 rounded-lg shrink-0">
                    <LayoutGrid className="h-4 w-4 text-violet-600" />
                  </div>
                </div>
              </Card>
            )}
          </div>

          {expiryUrgent > 0 && (
            <Card className="mb-6 p-4 border-orange-500/30 bg-orange-50/40 dark:bg-orange-500/[0.06] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <CalendarClock className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                      Срок годности: {expiryUrgent} партий требуют внимания
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {expiryQ.data?.counts.expired
                        ? `${expiryQ.data.counts.expired} уже просрочено · `
                        : ""}
                      {expiryQ.data?.counts.today
                        ? `${expiryQ.data.counts.today} сегодня · `
                        : ""}
                      {expiryQ.data?.counts.tomorrow
                        ? `${expiryQ.data.counts.tomorrow} завтра`
                        : ""}
                    </p>
                  </div>
                </div>
                <Link to="/expiry">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto border-orange-500/30">
                    Открыть сроки →
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Quick actions */}
            <Card className="p-4 lg:col-span-1 border-border/70 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Быстрые действия
              </h2>
              <div className="space-y-2">
                <Link to="/warehouse" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <Map className="h-4 w-4" />
                    Карта склада
                  </Button>
                </Link>
                <Link to="/inventory-count" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <ClipboardList className="h-4 w-4" />
                    Инвентаризация
                  </Button>
                </Link>
                <Link to="/expiry" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <CalendarClock className="h-4 w-4" />
                    Сроки годности
                    {expiryUrgent > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 text-white text-[10px] px-1.5 font-bold">
                        {expiryUrgent}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/warehouse/plan" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <PlanIcon className="h-4 w-4" />
                    2D-план склада
                  </Button>
                </Link>
                <Link to="/warehouse/3d" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <Box className="h-4 w-4" />
                    3D-обзор склада
                  </Button>
                </Link>
                <Link to="/shifts" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <Clock className="h-4 w-4" />
                    Смены кладовщиков
                  </Button>
                </Link>
                <Link to="/inventory" className="block">
                  <Button className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <LayoutGrid className="h-4 w-4" />
                    Каталог напитков
                  </Button>
                </Link>
                <Link to="/movements" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-10 text-sm" size="sm">
                    <History className="h-4 w-4" />
                    История движений
                  </Button>
                </Link>
                {user?.role === "admin" && (
                  <>
                    <Link to="/inventory?action=add" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-10 text-sm border-primary/25"
                        size="sm"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Приёмка / новая позиция
                      </Button>
                    </Link>
                    <Link to="/analytics" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-10 text-sm"
                        size="sm"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Сводка и отчёты
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </Card>

            {/* Recent changes */}
            <Card className="p-4 lg:col-span-2 border-border/70 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Недавние изменения
                </h2>
                <Link
                  to="/inventory"
                  className="text-xs font-medium text-primary inline-flex items-center gap-1"
                >
                  Весь каталог
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1.5">
                {recentProducts.length > 0 ? (
                  recentProducts.map((product) => (
                    <div
                      key={product.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                        product.quantity < CRITICAL_STOCK_THRESHOLD
                          ? "border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.05]"
                          : product.quantity < LOW_STOCK_THRESHOLD
                          ? "border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.05]"
                          : "border-border/50 bg-muted/20"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.sku}
                          {product.cell ? ` · ${product.cell}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            "font-bold tabular-nums",
                            product.quantity < CRITICAL_STOCK_THRESHOLD
                              ? "text-red-600 dark:text-red-400"
                              : product.quantity < LOW_STOCK_THRESHOLD
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-primary"
                          )}
                        >
                          {product.quantity}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{product.unit}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Каталог пуст — добавьте первую позицию.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Critical stock alert */}
          {fefoItems.length > 0 && (
            <div className="mt-5">
              <FefoPickList items={fefoItems} limit={5} />
            </div>
          )}

          {(movementsQ.data?.movements.length ?? 0) > 0 && (
            <Card className="mt-5 p-4 border-border/70 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Последние движения
                </h2>
                <Link to="/movements" className="text-xs font-medium text-primary">
                  Вся история →
                </Link>
              </div>
              <div className="space-y-1.5">
                {movementsQ.data!.movements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 text-sm rounded-lg border border-border/40 px-3 py-2 bg-muted/20"
                  >
                    <span className="truncate font-medium">{m.productName}</span>
                    <span
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        m.delta > 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {criticalProducts.length > 0 && (
            <Card className="mt-5 p-4 border-red-500/30 bg-red-50/40 dark:bg-red-500/[0.06] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
                <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Критический остаток — срочно пополнить
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {criticalProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 text-sm border border-red-500/20 rounded-lg px-3 py-2 bg-background/50"
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 font-bold text-red-600 dark:text-red-400 tabular-nums">
                      {p.quantity} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
