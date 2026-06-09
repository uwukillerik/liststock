import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelInventorySession,
  completeInventorySession,
  fetchActiveInventorySession,
  fetchInventorySession,
  startInventorySession,
  startMassInventorySession,
  updateInventoryLineRequest,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { InventoryCountLine } from "@shared/api";

function CountLineRow({
  line,
  onSave,
}: {
  line: InventoryCountLine;
  onSave: (qty: number) => Promise<void>;
}) {
  const [val, setVal] = useState(
    line.countedQty != null ? String(line.countedQty) : String(line.expectedQty)
  );
  const [saving, setSaving] = useState(false);
  const diff = parseInt(val, 10) - line.expectedQty;
  const hasDiff = line.countedQty != null && line.countedQty !== line.expectedQty;

  async function save() {
    const n = parseInt(val, 10);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Укажите корректное количество");
      return;
    }
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border",
        hasDiff ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 bg-card"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{line.productName}</p>
        <p className="text-xs font-mono text-muted-foreground">{line.productSku}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          В системе: <span className="font-semibold text-foreground">{line.expectedQty}</span>{" "}
          {line.unit}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-24 min-h-11 text-center font-bold"
        />
        <Button size="sm" className="min-h-11" disabled={saving} onClick={() => void save()}>
          {saving ? "…" : "OK"}
        </Button>
      </div>
      {!Number.isNaN(diff) && diff !== 0 && (
        <span
          className={cn(
            "text-xs font-bold sm:ml-auto",
            diff > 0 ? "text-emerald-600" : "text-red-600"
          )}
        >
          {diff > 0 ? "+" : ""}
          {diff}
        </span>
      )}
    </div>
  );
}

export default function InventoryCountPage() {
  const { sessionId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const locParam = searchParams.get("location") ?? "";
  const cellParam = searchParams.get("cell") ?? "";

  const activeQ = useQuery({
    queryKey: ["inventory-session", "active"],
    queryFn: fetchActiveInventorySession,
    enabled: !paramId,
  });

  const sessionId = paramId ?? activeQ.data?.id ?? null;

  const sessionQ = useQuery({
    queryKey: ["inventory-session", sessionId],
    queryFn: () => fetchInventorySession(sessionId!),
    enabled: !!sessionId,
  });

  const session = sessionQ.data?.session;
  const lines = sessionQ.data?.lines ?? [];

  const [starting, setStarting] = useState(false);
  const [startingMass, setStartingMass] = useState(false);
  const [loc, setLoc] = useState(locParam);
  const [cell, setCell] = useState(cellParam);

  useEffect(() => {
    if (locParam) setLoc(locParam);
    if (cellParam) setCell(cellParam);
  }, [locParam, cellParam]);

  async function handleStartMass() {
    setStartingMass(true);
    try {
      const s = await startMassInventorySession();
      toast.success("Массовая инвентаризация всего склада");
      await queryClient.invalidateQueries({ queryKey: ["inventory-session"] });
      navigate(`/inventory-count/${s.id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStartingMass(false);
    }
  }

  async function handleStart() {
    if (!loc.trim() || !cell.trim()) {
      toast.error("Укажите зону и ячейку");
      return;
    }
    setStarting(true);
    try {
      const s = await startInventorySession({ location: loc.trim(), cell: cell.trim() });
      toast.success(`Инвентаризация: ${s.cell}`);
      await queryClient.invalidateQueries({ queryKey: ["inventory-session"] });
      navigate(`/inventory-count/${s.id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    if (!sessionId) return;
    try {
      const r = await completeInventorySession(sessionId);
      toast.success(
        r.adjusted > 0
          ? `Готово: скорректировано ${r.adjusted} из ${r.total} позиций`
          : "Расхождений нет — остатки подтверждены"
      );
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse-map"] });
      navigate("/warehouse");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleCancel() {
    if (!sessionId) return;
    try {
      await cancelInventorySession(sessionId);
      toast.info("Инвентаризация отменена");
      navigate("/warehouse");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const countedAll = lines.length > 0 && lines.every((l) => l.countedQty != null);
  const diffCount = lines.filter(
    (l) => l.countedQty != null && l.countedQty !== l.expectedQty
  ).length;

  if (!sessionId) {
    return (
      <div className="min-h-full bg-gradient-to-b from-muted/20 to-background">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-10">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <header className="mb-6">
            <div className="flex items-center gap-2 text-primary mb-1">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Инвентаризация</span>
            </div>
            <h1 className="text-2xl font-semibold">Инвентаризация</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Пересчёт одной ячейки или всего склада
            </p>
          </header>
          <Card className="p-5 space-y-4 border-border/70 mb-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Warehouse className="h-4 w-4 text-primary" />
              Весь склад
            </div>
            <p className="text-xs text-muted-foreground">
              Создаст сессию по всем позициям каталога — удобно для полной сверки
            </p>
            <Button
              variant="secondary"
              className="w-full min-h-12"
              disabled={startingMass}
              onClick={() => void handleStartMass()}
            >
              {startingMass ? "Создание…" : "Массовая инвентаризация"}
            </Button>
          </Card>
          <Card className="p-5 space-y-4 border-border/70">
            <p className="text-sm font-medium">Одна ячейка</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Зона</Label>
                <Input value={loc} onChange={(e) => setLoc(e.target.value)} className="min-h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Ячейка</Label>
                <Input
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  className="min-h-11 font-mono"
                />
              </div>
            </div>
            <Button className="w-full min-h-12" disabled={starting} onClick={() => void handleStart()}>
              {starting ? "Создание…" : "Начать инвентаризацию"}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const isFullSession = session?.sessionType === "full";

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 to-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-10">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/warehouse")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Карта склада
        </Button>

        <header className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {isFullSession ? "Весь склад" : session?.cell}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isFullSession ? "Массовая инвентаризация" : session?.location}
              </p>
            </div>
            <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1 font-medium">
              {lines.length} поз.
            </span>
          </div>
          {diffCount > 0 && (
            <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Расхождений: {diffCount}
            </p>
          )}
        </header>

        {sessionQ.isLoading ? (
          <p className="text-muted-foreground text-sm">Загрузка…</p>
        ) : (
          <>
            {isFullSession && lines.length > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                Позиции по всему складу — введите фактический остаток по каждой.
              </p>
            )}
            {lines.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed mb-4">
                {isFullSession ? "На складе нет товаров" : "В этой ячейке нет товаров — можно завершить сразу"}
              </Card>
            ) : (
              <div className="space-y-2 mb-6">
                {lines.map((line) => (
                  <CountLineRow
                    key={line.id}
                    line={line}
                    onSave={async (qty) => {
                      await updateInventoryLineRequest(sessionId!, line.productId, qty);
                      await sessionQ.refetch();
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1 min-h-11 gap-2" onClick={() => void handleCancel()}>
            <XCircle className="h-4 w-4" />
            Отменить
          </Button>
          <Button
            className="flex-1 min-h-11 gap-2"
            disabled={lines.length > 0 && !countedAll}
            onClick={() => void handleComplete()}
          >
            <CheckCircle2 className="h-4 w-4" />
            Завершить и применить
          </Button>
        </div>
      </div>
    </div>
  );
}
