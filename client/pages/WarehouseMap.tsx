import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchWarehouseMap } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryContext";
import { useCanOperateStock } from "@/context/ShiftContext";
import { TransferDialog } from "@/components/inventory/TransferDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Map,
  Package,
  Search,
  ChevronRight,
  Grid3X3,
  AlertCircle,
  ClipboardList,
  ArrowRightLeft,
  Plus,
} from "lucide-react";
import { CellPicker } from "@/components/inventory/CellPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WarehouseGuide } from "@/components/warehouse/WarehouseGuide";
import { cn } from "@/lib/utils";
import type { Product, WarehouseCell } from "@shared/api";
import { isCriticalStock, isLowStock } from "@/lib/beverage";

function CellCard({
  cell,
  selected,
  onClick,
}: {
  cell: WarehouseCell;
  selected: boolean;
  onClick: () => void;
}) {
  const isEmpty = cell.products.length === 0;
  const hasLow = cell.products.some((p) => isLowStock({ quantity: p.quantity }));
  const hasCritical = cell.products.some((p) => isCriticalStock({ quantity: p.quantity }));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-all hover:shadow-md active:scale-[0.98]",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border/70 bg-card hover:border-primary/40",
        isEmpty && !selected && "border-dashed bg-muted/20",
        hasCritical && !selected && "border-red-500/30",
        hasLow && !hasCritical && !selected && "border-amber-500/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm font-mono">{cell.cell}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
            {cell.location}
          </p>
        </div>
        <div className="text-right shrink-0">
          {isEmpty ? (
            <p className="text-xs text-muted-foreground font-medium">пусто</p>
          ) : (
            <>
              <p className="text-lg font-bold text-primary tabular-nums">{cell.products.length}</p>
              <p className="text-[10px] text-muted-foreground">поз.</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {isEmpty && (
          <span className="text-[9px] text-muted-foreground">Готова к размещению</span>
        )}
        {cell.products.slice(0, 3).map((p) => (
          <span
            key={p.id}
            className="text-[9px] bg-muted/60 rounded px-1.5 py-0.5 truncate max-w-full"
          >
            {p.name.slice(0, 18)}
            {p.name.length > 18 ? "…" : ""}
          </span>
        ))}
        {cell.products.length > 3 && (
          <span className="text-[9px] text-muted-foreground">+{cell.products.length - 3}</span>
        )}
      </div>
    </button>
  );
}

export default function WarehouseMap() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { products, refetchProducts } = useInventory();
  const canOperate = useCanOperateStock();
  const canEdit = user?.role === "admin";
  const [addCellOpen, setAddCellOpen] = useState(false);
  const [newLoc, setNewLoc] = useState("");
  const [newCell, setNewCell] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse-map"],
    queryFn: fetchWarehouseMap,
  });

  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<WarehouseCell | null>(null);
  const [search, setSearch] = useState("");
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);

  const zones = data?.zones ?? [];

  const filteredZones = useMemo(() => {
    if (!search.trim()) return zones;
    const q = search.toLowerCase();
    return zones
      .map((z) => ({
        ...z,
        cells: z.cells.filter(
          (c) =>
            c.cell.toLowerCase().includes(q) ||
            c.location.toLowerCase().includes(q) ||
            c.products.some(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            )
        ),
      }))
      .filter((z) => z.cells.length > 0);
  }, [zones, search]);

  const currentZone = filteredZones.find((z) => z.name === activeZone) ?? filteredZones[0];

  React.useEffect(() => {
    if (filteredZones.length && !activeZone) {
      setActiveZone(filteredZones[0].name);
    }
  }, [filteredZones, activeZone]);

  const totalCells = zones.reduce((s, z) => s + z.cells.length, 0);
  const totalProducts = zones.reduce((s, z) => s + z.productCount, 0);

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-28 md:pb-10 md:pt-8 md:px-8">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Map className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Карта склада</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Ячейки и зоны
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading
                ? "Загрузка…"
                : `${totalCells} ячеек в ${zones.length} зонах · ${totalProducts} позиций`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {canEdit && (
              <Button variant="default" size="sm" className="gap-1.5" onClick={() => setAddCellOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Добавить ячейку
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/warehouse/plan">2D-план</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/warehouse/3d">3D-обзор</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/inventory-count">Инвентаризация</Link>
            </Button>
          </div>
        </header>

        <WarehouseGuide mode="map" />

        {error && (
          <Card className="p-4 mb-4 border-destructive/30 bg-destructive/5 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">Не удалось загрузить карту склада</p>
          </Card>
        )}

        <Card className="p-2.5 mb-4 border-border/70 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
            <Input
              placeholder="Поиск ячейки, зоны или товара…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-10"
            />
          </div>
        </Card>

        <p className="text-xs text-muted-foreground mb-2">
          Вкладки ниже — это <strong className="text-foreground">зоны</strong>. Внутри каждой — список{" "}
          <strong className="text-foreground">ячеек</strong> (мест на стеллажах).
        </p>

        {/* Zone tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {filteredZones.map((z) => (
            <button
              key={z.name}
              type="button"
              onClick={() => {
                setActiveZone(z.name);
                setSelectedCell(null);
              }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                currentZone?.name === z.name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              {z.name}
              <span className="ml-1.5 opacity-70 text-xs">({z.cells.length})</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          {/* Cell grid */}
          <div>
            {currentZone ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-primary" />
                    {currentZone.name}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {currentZone.totalQuantity.toLocaleString("ru-RU")} ед.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {currentZone.cells.map((cell) => (
                    <CellCard
                      key={`${cell.location}-${cell.cell}`}
                      cell={cell}
                      selected={
                        selectedCell?.cell === cell.cell &&
                        selectedCell?.location === cell.location
                      }
                      onClick={() => setSelectedCell(cell)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Card className="p-12 text-center text-muted-foreground border-dashed space-y-3">
                <p>Нет ячеек на карте.</p>
                {canEdit && (
                  <Button size="sm" className="gap-1.5" onClick={() => setAddCellOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Создать первую ячейку
                  </Button>
                )}
              </Card>
            )}
          </div>

          {/* Detail panel */}
          <Card className="h-fit border-border/70 shadow-sm overflow-hidden lg:sticky lg:top-4">
            {selectedCell ? (
              <>
                <div className="bg-gradient-to-r from-primary/10 to-accent/5 px-4 py-3 border-b">
                  <p className="text-xs text-muted-foreground">{selectedCell.location}</p>
                  <p className="text-xl font-bold font-mono">{selectedCell.cell}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedCell.products.length} поз. · {selectedCell.totalQuantity} ед.
                  </p>
                </div>
                <ul className="divide-y max-h-[60vh] overflow-y-auto">
                  {selectedCell.products.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Ячейка пустая. Добавьте товар в каталоге и укажите эту зону и ячейку.
                    </li>
                  )}
                  {selectedCell.products.map((p) => (
                    <li key={p.id} className="px-4 py-3 flex gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover border shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm leading-snug">{p.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                        <p
                          className={cn(
                            "text-sm font-bold mt-1 tabular-nums",
                            isCriticalStock({ quantity: p.quantity })
                              ? "text-red-600"
                              : isLowStock({ quantity: p.quantity })
                              ? "text-amber-600"
                              : "text-primary"
                          )}
                        >
                          {p.quantity} {p.unit}
                        </p>
                        {canOperate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 mt-1 px-2 text-xs gap-1"
                            onClick={() => {
                              const full = products.find((x) => x.id === p.id);
                              if (full) setTransferProduct(full);
                            }}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            Переместить
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="p-3 border-t space-y-2">
                  {canOperate && selectedCell.cell !== "—" && (
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() =>
                        navigate(
                          `/inventory-count?location=${encodeURIComponent(selectedCell.location)}&cell=${encodeURIComponent(selectedCell.cell)}`
                        )
                      }
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Инвентаризация ячейки
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                    <Link to={`/inventory?q=${encodeURIComponent(selectedCell.cell)}`}>
                      Открыть в каталоге
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                Выберите ячейку на карте
              </div>
            )}
          </Card>
        </div>
      </div>

      <TransferDialog
        product={transferProduct}
        open={!!transferProduct}
        onClose={() => setTransferProduct(null)}
        onDone={() => {
          void refetchProducts();
          void queryClient.invalidateQueries({ queryKey: ["warehouse-map"] });
        }}
      />

      <Dialog open={addCellOpen} onOpenChange={setAddCellOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новая ячейка склада</DialogTitle>
            <DialogDescription>
              Укажите зону (например, Холодильник) и код ячейки (например, Х-01-05). Пустая ячейка
              появится на карте — потом привяжите к ней напиток в каталоге.
            </DialogDescription>
          </DialogHeader>
          <CellPicker
            location={newLoc}
            cell={newCell}
            onLocationChange={setNewLoc}
            onCellChange={setNewCell}
            idPrefix="wh-new"
          />
          <Button variant="outline" className="w-full" onClick={() => setAddCellOpen(false)}>
            Готово
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
