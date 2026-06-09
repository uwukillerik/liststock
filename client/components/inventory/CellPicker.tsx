import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchWarehouseCells, createWarehouseCellRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { WAREHOUSE_ZONE_PRESETS } from "@/lib/beverage";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

interface CellPickerProps {
  location: string;
  cell: string;
  onLocationChange: (v: string) => void;
  onCellChange: (v: string) => void;
  idPrefix?: string;
  allowCreate?: boolean;
}

export function CellPicker({
  location,
  cell,
  onLocationChange,
  onCellChange,
  idPrefix = "",
  allowCreate = true,
}: CellPickerProps) {
  const pf = (s: string) => (idPrefix ? `${idPrefix}-${s}` : s);
  const queryClient = useQueryClient();
  const [showNewCell, setShowNewCell] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [newCell, setNewCell] = useState("");
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ["warehouse-cells"],
    queryFn: fetchWarehouseCells,
  });

  const locations = data?.locations ?? [];
  const cells = data?.cells ?? [];

  const cellsInZone = useMemo(() => {
    if (!location.trim()) return cells;
    const loc = location.trim().toLowerCase();
    return cells.filter((c) => c.location.toLowerCase() === loc);
  }, [cells, location]);

  async function handleCreateCell() {
    const loc = (newLocation || location).trim();
    const c = newCell.trim();
    if (!loc || !c) {
      toast.error("Укажите зону и номер ячейки");
      return;
    }
    setCreating(true);
    try {
      await createWarehouseCellRequest({ location: loc, cell: c });
      await queryClient.invalidateQueries({ queryKey: ["warehouse-cells"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse-map"] });
      onLocationChange(loc);
      onCellChange(c);
      setShowNewCell(false);
      setNewLocation("");
      setNewCell("");
      toast.success(`Ячейка ${c} добавлена`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать ячейку");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary" />
        Место на складе
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WAREHOUSE_ZONE_PRESETS.map((loc) => (
          <button
            key={`preset-${loc}`}
            type="button"
            onClick={() => {
              onLocationChange(loc);
              onCellChange("");
            }}
            className={cn(
              "rounded-full border border-dashed px-3 py-1 text-xs font-medium transition-colors",
              location === loc
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/80 text-muted-foreground hover:bg-muted"
            )}
          >
            {loc}
          </button>
        ))}
      </div>

      {locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {locations.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                onLocationChange(loc);
                onCellChange("");
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                location === loc
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 hover:bg-muted"
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("loc")} className="text-sm">
            Зона / проход
          </Label>
          <Input
            id={pf("loc")}
            list={pf("loc-list")}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Холодильный зал А"
            className="min-h-11 text-sm"
          />
          <datalist id={pf("loc-list")}>
            {locations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor={pf("cell")} className="text-sm">
            Ячейка / стеллаж
          </Label>
          <Input
            id={pf("cell")}
            list={pf("cell-list")}
            value={cell}
            onChange={(e) => onCellChange(e.target.value)}
            placeholder="Х-12-03"
            className="min-h-11 text-sm font-mono"
          />
          <datalist id={pf("cell-list")}>
            {cellsInZone.map((c) => (
              <option key={`${c.location}-${c.cell}`} value={c.cell}>
                {c.isEmpty ? "(пустая)" : `${c.productCount} поз.`}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      {cellsInZone.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">
            {location ? `Ячейки в «${location}»:` : "Все ячейки:"}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {cellsInZone.slice(0, 24).map((c) => (
              <button
                key={`${c.location}-${c.cell}`}
                type="button"
                onClick={() => {
                  onLocationChange(c.location);
                  onCellChange(c.cell);
                }}
                className={cn(
                  "text-[10px] rounded-full border px-2.5 py-1 transition-colors font-mono",
                  cell === c.cell && location === c.location
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                  c.isEmpty && "border-dashed text-muted-foreground"
                )}
              >
                {c.cell}
                {c.isEmpty ? " ∅" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {allowCreate && (
        <>
          {!showNewCell ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-9 text-xs"
              onClick={() => {
                setShowNewCell(true);
                setNewLocation(location);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить новую ячейку
            </Button>
          ) : (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-primary">Новая ячейка на карте</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Зона"
                  className="h-9 text-sm"
                />
                <Input
                  value={newCell}
                  onChange={(e) => setNewCell(e.target.value)}
                  placeholder="Х-01-01"
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-8"
                  onClick={() => setShowNewCell(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 h-8"
                  disabled={creating}
                  onClick={() => void handleCreateCell()}
                >
                  {creating ? "…" : "Создать"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
