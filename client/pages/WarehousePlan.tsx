import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchWarehouseLayout, saveWarehouseLayout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  GripVertical,
  LayoutGrid,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WarehouseCellLayout } from "@shared/api";
import { WarehouseGuide } from "@/components/warehouse/WarehouseGuide";

type DragState = {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
};

const CANVAS_W = 900;
const CANVAS_H = 600;

export default function WarehousePlanPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const layoutQ = useQuery({
    queryKey: ["warehouse-layout"],
    queryFn: fetchWarehouseLayout,
  });

  const [cells, setCells] = useState<WarehouseCellLayout[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (layoutQ.data) {
      setCells(layoutQ.data);
      setDirty(false);
    }
  }, [layoutQ.data]);

  const moveCell = useCallback((id: string, dx: number, dy: number) => {
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          posX: Math.max(0, Math.min(CANVAS_W - c.width, c.posX + dx)),
          posY: Math.max(0, Math.min(CANVAS_H - c.height, c.posY + dy)),
        };
      })
    );
    setDirty(true);
  }, []);

  useEffect(() => {
    function onMove(clientX: number, clientY: number) {
      const d = dragRef.current;
      const canvas = canvasRef.current;
      if (!d || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const dx = (clientX - d.startX) * scaleX;
      const dy = (clientY - d.startY) * scaleY;
      setCells((prev) =>
        prev.map((c) => {
          if (c.id !== d.id) return c;
          return {
            ...c,
            posX: Math.max(0, Math.min(CANVAS_W - c.width, d.origX + dx)),
            posY: Math.max(0, Math.min(CANVAS_H - c.height, d.origY + dy)),
          };
        })
      );
      setDirty(true);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragRef.current) return;
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    }

    function onPointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function startDrag(e: React.PointerEvent, cell: WarehouseCellLayout) {
    if (!canEdit) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: cell.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: cell.posX,
      origY: cell.posY,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveWarehouseLayout(
        cells.map((c) => ({
          location: c.location,
          cell: c.cell,
          posX: c.posX,
          posY: c.posY,
          width: c.width,
          height: c.height,
          zoneColor: c.zoneColor,
        }))
      );
      toast.success("План сохранён");
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["warehouse-layout"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (layoutQ.data) {
      setCells(layoutQ.data);
      setDirty(false);
    }
  }

  function nudge(id: string, dx: number, dy: number) {
    if (!canEdit) return;
    moveCell(id, dx, dy);
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 to-background">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-10">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/warehouse">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Карта склада
          </Link>
        </Button>

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <LayoutGrid className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">2D-план</span>
            </div>
            <h1 className="text-2xl font-semibold">План помещения</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canEdit
                ? "Перетащите ячейки для расстановки зон склада"
                : "Схема расположения ячеек на складе"}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!dirty}
                onClick={handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сброс
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!dirty || saving}
                onClick={() => void handleSave()}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "…" : "Сохранить"}
              </Button>
            </div>
          )}
        </header>

        <WarehouseGuide mode="plan" />

        {layoutQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка плана…</p>
        ) : cells.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <p className="text-sm text-muted-foreground">
              Нет ячеек — сначала добавьте товары с указанием зоны и ячейки
            </p>
            <Button className="mt-4" size="sm" asChild>
              <Link to="/inventory">Каталог</Link>
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-2 sm:p-4 border-border/70 overflow-hidden">
              <div
                ref={canvasRef}
                className="relative w-full bg-muted/30 rounded-xl border border-dashed border-border/80 overflow-hidden touch-none"
                style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
              >
                <div className="absolute inset-0">
                  {cells.map((cell) => (
                    <div
                      key={cell.id}
                      role="button"
                      tabIndex={canEdit ? 0 : -1}
                      onPointerDown={(e) => startDrag(e, cell)}
                      className={cn(
                        "absolute rounded-lg border-2 shadow-sm select-none flex flex-col justify-center px-2 py-1 transition-shadow",
                        canEdit && "cursor-grab active:cursor-grabbing hover:shadow-md hover:z-10",
                        !canEdit && "cursor-default"
                      )}
                      style={{
                        left: `${(cell.posX / CANVAS_W) * 100}%`,
                        top: `${(cell.posY / CANVAS_H) * 100}%`,
                        width: `${(cell.width / CANVAS_W) * 100}%`,
                        height: `${(cell.height / CANVAS_H) * 100}%`,
                        backgroundColor: `${cell.zoneColor}22`,
                        borderColor: cell.zoneColor,
                      }}
                    >
                      <div className="flex items-center gap-0.5 min-w-0">
                        {canEdit && (
                          <GripVertical className="h-3 w-3 shrink-0 opacity-40" />
                        )}
                        <span className="font-mono text-[10px] sm:text-xs font-bold truncate">
                          {cell.cell}
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                        {cell.location}
                      </span>
                      {(cell.productCount ?? 0) > 0 && (
                        <span className="text-[9px] font-medium mt-auto opacity-80">
                          {cell.productCount} поз.
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              {canEdit
                ? "На телефоне: удерживайте ячейку и перетаскивайте. На ПК — drag-and-drop."
                : "Редактирование доступно администратору"}
            </p>

            {/* Mobile nudge controls */}
            {canEdit && (
              <div className="mt-4 sm:hidden space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Точная подстройка:</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {cells.slice(0, 8).map((cell) => (
                    <div
                      key={cell.id}
                      className="flex items-center gap-1 rounded-lg border px-2 py-1 bg-card text-xs"
                    >
                      <span className="font-mono font-semibold">{cell.cell}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => nudge(cell.id, 0, -8)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => nudge(cell.id, 0, 8)}
                      >
                        ↓
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => nudge(cell.id, -8, 0)}
                      >
                        ←
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => nudge(cell.id, 8, 0)}
                      >
                        →
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
