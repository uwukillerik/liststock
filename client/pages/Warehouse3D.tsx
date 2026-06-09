import React, { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchWarehouseLayout, fetchWarehouseMap, fetchExpiryAlerts } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Box, RotateCcw, Maximize2, Minimize2, Package, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { WarehouseGuide } from "@/components/warehouse/WarehouseGuide";

const Scene = React.lazy(() =>
  import("@/components/warehouse/Warehouse3DScene").then((m) => ({ default: m.Warehouse3DScene }))
);

export default function Warehouse3DPage() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [camKey, setCamKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const layoutQ = useQuery({ queryKey: ["warehouse-layout"], queryFn: fetchWarehouseLayout });
  const mapQ = useQuery({ queryKey: ["warehouse-map"], queryFn: fetchWarehouseMap });
  const expiryQ = useQuery({ queryKey: ["expiry-alerts"], queryFn: fetchExpiryAlerts });

  const cells = useMemo(() => {
    const map = new Map<
      string,
      { totalQty: number; productCount: number; products: string[] }
    >();

    for (const zone of mapQ.data?.zones ?? []) {
      for (const cell of zone.cells) {
        const key = `${cell.location}|${cell.cell}`;
        map.set(key, {
          totalQty: cell.totalQuantity,
          productCount: cell.products.length,
          products: cell.products.map((p) => p.name),
        });
      }
    }
    for (const cell of mapQ.data?.unassigned ?? []) {
      const key = `${cell.location}|${cell.cell}`;
      map.set(key, {
        totalQty: cell.totalQuantity,
        productCount: cell.products.length,
        products: cell.products.map((p) => p.name),
      });
    }

    const urgentCells = new Set<string>();
    for (const group of ["expired", "today", "tomorrow"] as const) {
      for (const item of expiryQ.data?.[group] ?? []) {
        if (item.location && item.cell) {
          urgentCells.add(`${item.location}|${item.cell}`);
        }
      }
    }

    return (layoutQ.data ?? []).map((l) => {
      const key = `${l.location}|${l.cell}`;
      const info = map.get(key);
      return {
        ...l,
        key,
        totalQty: info?.totalQty ?? 0,
        productCount: info?.productCount ?? l.productCount ?? 0,
        products: info?.products ?? [],
        hasExpiryAlert: urgentCells.has(key),
      };
    });
  }, [layoutQ.data, mapQ.data, expiryQ.data]);

  const selected = cells.find((c) => c.key === selectedKey);

  const stats = useMemo(
    () => ({
      cells: cells.length,
      units: cells.reduce((s, c) => s + c.totalQty, 0),
      alerts: cells.filter((c) => c.hasExpiryAlert).length,
      low: cells.filter((c) => !c.hasExpiryAlert && c.totalQty < 5).length,
    }),
    [cells]
  );

  const loading = layoutQ.isLoading || mapQ.isLoading;

  return (
    <div
      className={cn(
        "min-h-full bg-gradient-to-b from-slate-950/10 via-background to-background",
        fullscreen && "fixed inset-0 z-50 bg-background overflow-auto"
      )}
    >
      <div className={cn("mx-auto px-4 pt-6 pb-28 md:pb-10", fullscreen ? "max-w-none" : "max-w-6xl")}>
        {!fullscreen && (
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
            <Link to="/warehouse">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Ячейки и зоны
            </Link>
          </Button>
        )}

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Box className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Только просмотр</span>
            </div>
            <h1 className="text-2xl font-semibold">3D-обзор склада</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Наглядная картинка ваших ячеек. Стеллажи и коробки — декорация; данные берутся из
              каталога. Менять зоны и товары здесь нельзя.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link to="/warehouse/plan">2D-план</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  Свернуть
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  На весь экран
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSelectedKey(null);
                setCamKey((k) => k + 1);
                setWebglError(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Сбросить вид
            </Button>
          </div>
        </header>

        {!fullscreen && <WarehouseGuide mode="3d" />}

        <Card className="mb-3 border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
            <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong className="text-foreground">Что показывает 3D:</strong> каждый стеллаж = одна
                ячейка с каталога. Подпись — код ячейки и остаток. Цвет пола под стеллажом: бирюзовый —
                норма, жёлтый — мало, красный пульсирует — срок годности.
              </p>
              <p>
                <strong className="text-foreground">Управление:</strong> зажмите ЛКМ и вращайте ·
                колёсико — приблизить · ПКМ — сдвинуть · клик по стеллажу — детали внизу · клик по полу
                — снять выбор.
              </p>
              <p>
                <strong className="text-foreground">Расположение стеллажей</strong> задаётся в{" "}
                <Link to="/warehouse/plan" className="text-primary hover:underline">
                  2D-плане
                </Link>
                . Перемещать товары — в{" "}
                <Link to="/warehouse" className="text-primary hover:underline">
                  ячейках и зонах
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Ячеек", value: stats.cells },
            { label: "Единиц", value: stats.units },
            { label: "Срок годн.", value: stats.alerts, warn: stats.alerts > 0 },
            { label: "Мало остатка", value: stats.low, warn: stats.low > 0 },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                "rounded-xl border px-3 py-2 bg-card/80 backdrop-blur-sm",
                s.warn && "border-amber-500/40"
              )}
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={cn("text-xl font-bold tabular-nums", s.warn && "text-amber-600")}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden border-border/70 shadow-2xl ring-1 ring-white/5">
          <div
            className={cn(
              "relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
              fullscreen ? "h-[calc(100vh-12rem)]" : "h-[min(72vh,560px)]"
            )}
          >
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 max-w-[90%]">
              {[
                { color: "bg-teal-400", label: "В норме" },
                { color: "bg-amber-400", label: "Мало" },
                { color: "bg-red-400 animate-pulse", label: "Срок" },
                { color: "bg-slate-500", label: "Пустая ячейка" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-slate-200 backdrop-blur-md"
                >
                  <span className={cn("h-2 w-2 rounded-full", item.color)} />
                  {item.label}
                </span>
              ))}
            </div>

            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <p className="text-sm">Загрузка 3D-сцены…</p>
              </div>
            ) : cells.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm gap-2 px-6 text-center">
                <Package className="h-10 w-10 opacity-30" />
                <p>Нет ячеек. Сначала добавьте ячейки и напитки в каталоге.</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/warehouse">Карта ячеек</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/inventory">Каталог</Link>
                  </Button>
                </div>
              </div>
            ) : webglError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm gap-3 px-6 text-center">
                <p>Графика браузера перегружена. Используйте карту ячеек — там те же данные.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setWebglError(false);
                    setCamKey((k) => k + 1);
                  }}
                >
                  Попробовать снова
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/warehouse">Открыть карту ячеек</Link>
                </Button>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                    <p className="text-sm">Инициализация WebGL…</p>
                  </div>
                }
              >
                <Scene
                  key={camKey}
                  cells={cells}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  onWebglLost={() => setWebglError(true)}
                />
              </Suspense>
            )}
          </div>
        </Card>

        {selected && (
          <Card className="mt-4 p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Зона: {selected.location}</p>
                <p className="font-mono font-bold text-xl tracking-tight">Ячейка {selected.cell}</p>
              </div>
              {selected.hasExpiryAlert ? (
                <span className="text-xs font-semibold text-red-600 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full animate-pulse">
                  Срок годности
                </span>
              ) : selected.totalQty < 5 && selected.productCount > 0 ? (
                <span className="text-xs font-semibold text-amber-700 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                  Мало остатка
                </span>
              ) : selected.productCount === 0 ? (
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border">
                  Пустая
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  В норме
                </span>
              )}
            </div>
            <p className="text-sm mt-2 font-medium">
              {selected.productCount} позиций · {selected.totalQty} единиц
            </p>
            {selected.products.length > 0 ? (
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                {selected.products.slice(0, 10).map((name) => (
                  <li key={name} className="truncate rounded-md bg-muted/40 px-2 py-1">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                В ячейке пока нет напитков — назначьте её в каталоге при добавлении товара.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" asChild>
                <Link
                  to={`/inventory-count?location=${encodeURIComponent(selected.location)}&cell=${encodeURIComponent(selected.cell)}`}
                >
                  Инвентаризация
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/warehouse">Карта ячеек</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedKey(null)}>
                Закрыть
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export type Warehouse3DCell = {
  key: string;
  location: string;
  cell: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  zoneColor: string;
  totalQty: number;
  productCount: number;
  products: string[];
  hasExpiryAlert: boolean;
};
