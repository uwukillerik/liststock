import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, HelpCircle, MapPin, Grid3X3, LayoutGrid, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type GuideMode = "map" | "plan" | "3d";

const MODE_INTRO: Record<GuideMode, string> = {
  map: "Здесь вы видите, что лежит в каждой ячейке, и можете перемещать напитки между ячейками.",
  plan: "Здесь администратор расставляет ячейки на схеме склада — это влияет на вид в 3D-обзоре.",
  "3d": "Здесь только наглядный обзор: стеллажи нарисованы для красоты, менять их нельзя.",
};

export function WarehouseGuide({ mode = "map" }: { mode?: GuideMode }) {
  const [open, setOpen] = useState(mode !== "3d");

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          Как устроен склад: зоны, ячейки и разделы
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm border-t border-primary/10 pt-3">
          <p className="text-muted-foreground leading-relaxed">{MODE_INTRO[mode]}</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 bg-card p-3 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Зона
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Крупная часть склада: <strong className="text-foreground">Холодильник</strong>,{" "}
                <strong className="text-foreground">Сухой склад</strong>,{" "}
                <strong className="text-foreground">Экспедиция</strong>. Одна зона — много ячеек.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-3 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Grid3X3 className="h-3.5 w-3.5 text-primary" />
                Ячейка
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Конкретное место: код вроде <strong className="text-foreground font-mono">А-01-12</strong>.
                В одной ячейке может быть несколько напитков.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            Пример: зона «Холодильник» → ячейка «Х-12-03» → там лежит «Кола 0,5 л» — 18 ящиков
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Три раздела — зачем каждый
            </p>
            <ul className="space-y-2 text-xs">
              <li className={cn("flex gap-2 rounded-lg p-2", mode === "map" && "bg-primary/10 border border-primary/20")}>
                <LayoutGrid className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <Link to="/warehouse" className="font-semibold text-primary hover:underline">
                    Ячейки и зоны
                  </Link>
                  {" — "}
                  список по зонам, что внутри, перемещение, инвентаризация ячейки, добавление пустых ячеек.
                </span>
              </li>
              <li className={cn("flex gap-2 rounded-lg p-2", mode === "plan" && "bg-primary/10 border border-primary/20")}>
                <LayoutGrid className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <Link to="/warehouse/plan" className="font-semibold text-primary hover:underline">
                    2D-план
                  </Link>
                  {" — "}
                  схема: админ перетаскивает ячейки мышкой (где стоят на плане). На учёт товаров не влияет.
                </span>
              </li>
              <li className={cn("flex gap-2 rounded-lg p-2", mode === "3d" && "bg-primary/10 border border-primary/20")}>
                <Box className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <Link to="/warehouse/3d" className="font-semibold text-primary hover:underline">
                    3D-обзор
                  </Link>
                  {" — "}
                  только смотреть: вращать камеру, кликнуть стеллаж — увидеть детали. Редактировать нельзя.
                </span>
              </li>
            </ul>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Где менять зону и ячейку товара:</strong> каталог →
              добавить/изменить напиток → блок «Место на складе», или «Переместить» в карточке товара.
            </p>
            <p>
              <strong className="text-foreground">Где создать пустую ячейку:</strong> кнопка «Добавить ячейку»
              на этой странице или в форме товара.
            </p>
          </div>

          {mode === "3d" && (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
              <Link to="/warehouse">Перейти к рабочей карте ячеек</Link>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
