import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryContext";
import {
  createBatchRequest,
  deleteBatchRequest,
  fetchExpiryAlerts,
  writeOffExpiredBatches,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarClock,
  Plus,
  Trash2,
  PackageX,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  expiryBadgeClass,
  expiryLabel,
  formatExpiryDate,
} from "@/lib/expiry";
import { FefoPickList, flattenExpiryItems } from "@/components/inventory/FefoPickList";
import type { ExpiryAlertItem, ExpiryAlertStatus } from "@shared/api";

const TAB_ORDER: { key: ExpiryAlertStatus; label: string }[] = [
  { key: "expired", label: "Просрочено" },
  { key: "today", label: "Сегодня" },
  { key: "tomorrow", label: "Завтра" },
  { key: "week", label: "7 дней" },
  { key: "month", label: "30 дней" },
];

function AlertRow({
  item,
  canEdit,
  onDelete,
}: {
  item: ExpiryAlertItem;
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border",
        expiryBadgeClass(item.status),
        "bg-opacity-30"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{item.productName}</p>
        <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.productSku}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="font-mono">Партия {item.batchCode}</span>
          <span>
            {item.quantity} {item.unit}
          </span>
          {(item.location || item.cell) && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {item.location}
              {item.cell ? ` · ${item.cell}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-semibold">{formatExpiryDate(item.expiryDate)}</p>
          <p className="text-[11px] text-muted-foreground">{expiryLabel(item.status)}</p>
        </div>
        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddBatchDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { products } = useInventory();
  const [productId, setProductId] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");
  const [addToStock, setAddToStock] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!productId || !expiryDate || Number.isNaN(qty) || qty <= 0) {
      toast.error("Заполните товар, количество и срок годности");
      return;
    }
    setLoading(true);
    try {
      await createBatchRequest({
        productId,
        batchCode: batchCode.trim() || undefined,
        quantity: qty,
        expiryDate,
        note: note.trim() || undefined,
        addToStock,
      });
      toast.success("Партия добавлена");
      onCreated();
      onClose();
      setProductId("");
      setBatchCode("");
      setQuantity("");
      setExpiryDate("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новая партия</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="min-h-10">
                <SelectValue placeholder="Выберите позицию" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Количество</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="min-h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Срок годности</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="min-h-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Код партии (необяз.)</Label>
            <Input
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="LOT-2026-001"
              className="min-h-10 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Примечание</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-10" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addToStock}
              onChange={(e) => setAddToStock(e.target.checked)}
              className="rounded"
            />
            Добавить количество на склад
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpiryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = user?.role === "admin";
  const [addOpen, setAddOpen] = useState(false);
  const [writingOff, setWritingOff] = useState(false);

  const alertsQ = useQuery({
    queryKey: ["expiry-alerts"],
    queryFn: fetchExpiryAlerts,
    refetchInterval: 60_000,
  });

  const summary = alertsQ.data;
  const urgentCount = useMemo(() => {
    if (!summary) return 0;
    return (
      summary.counts.expired +
      summary.counts.today +
      summary.counts.tomorrow +
      summary.counts.week
    );
  }, [summary]);

  const defaultTab = useMemo(() => {
    if (!summary) return "expired";
    for (const t of TAB_ORDER) {
      if (summary[t.key].length > 0) return t.key;
    }
    return "month";
  }, [summary]);

  async function handleWriteOff() {
    setWritingOff(true);
    try {
      const r = await writeOffExpiredBatches();
      toast.success(
        r.writtenOff > 0
          ? `Списано ${r.writtenOff} просроченных партий`
          : "Просроченных партий для списания нет"
      );
      await queryClient.invalidateQueries({ queryKey: ["expiry-alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setWritingOff(false);
    }
  }

  async function handleDeleteBatch(id: string) {
    if (!confirm("Удалить партию? Остаток партии будет уменьшен.")) return;
    try {
      await deleteBatchRequest(id);
      toast.success("Партия удалена");
      await queryClient.invalidateQueries({ queryKey: ["expiry-alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 to-background">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-10">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Главная
          </Link>
        </Button>

        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <CalendarClock className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Срок годности</span>
              </div>
              <h1 className="text-2xl font-semibold">Партии и сроки</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Просроченные, истекающие сегодня, завтра и в ближайшие дни
              </p>
            </div>
            {canEdit && (
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Партия
              </Button>
            )}
          </div>
        </header>

        {urgentCount > 0 && (
          <Card className="p-4 mb-5 border-red-500/30 bg-red-50/50 dark:bg-red-500/[0.06]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-red-800 dark:text-red-200">
                  Требует внимания: {urgentCount} партий
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.counts.expired
                    ? `${summary.counts.expired} уже просрочено · `
                    : ""}
                  {summary?.counts.today ? `${summary.counts.today} истекает сегодня · ` : ""}
                  {summary?.counts.tomorrow
                    ? `${summary.counts.tomorrow} завтра срок`
                    : ""}
                </p>
              </div>
              {canEdit && (summary?.counts.expired ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5 shrink-0"
                  disabled={writingOff}
                  onClick={() => void handleWriteOff()}
                >
                  <PackageX className="h-3.5 w-3.5" />
                  Списать просроч.
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          {TAB_ORDER.map(({ key, label }) => {
            const count = summary?.counts[key] ?? 0;
            return (
              <Card
                key={key}
                className={cn(
                  "p-3 text-center border",
                  count > 0 && key === "expired" && "border-red-500/40 bg-red-500/5",
                  count > 0 && key === "today" && "border-red-500/30 bg-red-500/5",
                  count > 0 && key === "tomorrow" && "border-orange-500/30 bg-orange-500/5"
                )}
              >
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
              </Card>
            );
          })}
        </div>

        {!alertsQ.isLoading && summary && summary.counts.total > 0 && (
          <div className="mb-5">
            <FefoPickList items={flattenExpiryItems(summary)} limit={8} />
          </div>
        )}

        {alertsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !summary || summary.counts.total === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Нет партий с отслеживаемым сроком годности
            </p>
            {canEdit && (
              <Button className="mt-4" size="sm" onClick={() => setAddOpen(true)}>
                Добавить первую партию
              </Button>
            )}
          </Card>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
              {TAB_ORDER.map(({ key, label }) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs flex-1 min-w-[4.5rem]"
                  disabled={(summary[key]?.length ?? 0) === 0}
                >
                  {label}
                  {(summary[key]?.length ?? 0) > 0 && (
                    <span className="ml-1 opacity-70">({summary[key].length})</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {TAB_ORDER.map(({ key }) => (
              <TabsContent key={key} value={key} className="mt-4 space-y-2">
                {summary[key].length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Нет партий</p>
                ) : (
                  summary[key].map((item) => (
                    <AlertRow
                      key={item.id}
                      item={item}
                      canEdit={canEdit}
                      onDelete={(id) => void handleDeleteBatch(id)}
                    />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <AddBatchDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ["expiry-alerts"] })}
      />
    </div>
  );
}
