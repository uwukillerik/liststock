import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInventory } from "@/context/InventoryContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ProductEditorShell,
  ProductFormFields,
  emptyForm,
  productToForm,
  type ProductFormState,
} from "@/components/inventory/ProductEditor";
import {
  Search,
  Pencil,
  Trash2,
  Plus,
  FileDown,
  Printer,
  TrendingUp,
  X,
  ScanBarcode,
  Barcode,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { openInventoryPrintReport, downloadInventoryPdfLatin } from "@/lib/reports";
import { TransferDialog } from "@/components/inventory/TransferDialog";
import { useCanOperateStock } from "@/context/ShiftContext";
import {
  BarcodeScanner,
  matchProductByCode,
  parseBarcode,
} from "@/components/scanner/BarcodeScanner";
import { createBatchRequest } from "@/lib/api";
import {
  LOW_STOCK_THRESHOLD,
  CRITICAL_STOCK_THRESHOLD,
  REASON_OPTIONS,
  formatPrice,
  isLowStock,
  isCriticalStock,
  buildCategoryFilterList,
  normalizeCategory,
  categoryDisplayName,
} from "@/lib/beverage";
import { cn } from "@/lib/utils";
import { ExpiryBadge } from "@/components/inventory/ExpiryBadge";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Product } from "@shared/api";

function AdjustDialog({
  product,
  open,
  onClose,
  onAdjust,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdjust: (
    delta: number,
    reason: string,
    note: string,
    opts?: { expiryDate?: string; batchCode?: string }
  ) => Promise<void>;
}) {
  const [delta, setDelta] = useState("");
  const [direction, setDirection] = useState<"+" | "-">("+");
  const [reason, setReason] = useState("receipt");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (open) {
      setDelta("");
      setDirection("+");
      setReason("receipt");
      setNote("");
      setExpiryDate("");
      setBatchCode("");
    }
  }, [open]);

  async function submit() {
    const n = parseInt(delta, 10);
    if (!n || n <= 0) {
      toast.error("Укажите количество");
      return;
    }
    if (direction === "+" && reason === "receipt" && !expiryDate) {
      toast.error("Укажите срок годности при приёмке товара");
      return;
    }
    setLoading(true);
    try {
      await onAdjust(direction === "+" ? n : -n, reason, note, {
        expiryDate: direction === "+" ? expiryDate : undefined,
        batchCode: direction === "+" ? batchCode || undefined : undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const Content = (
    <div className="space-y-4 py-2">
      {product && (
        <div className="rounded-xl bg-muted/40 px-4 py-3">
          <p className="font-semibold text-sm">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Текущий остаток:{" "}
            <span className="font-bold text-foreground">
              {product.quantity} {product.unit}
            </span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Направление и количество</Label>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-input overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setDirection("+")}
              className={cn(
                "px-4 py-2.5 text-sm font-bold transition-colors",
                direction === "+"
                  ? "bg-emerald-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setDirection("-")}
              className={cn(
                "px-4 py-2.5 text-sm font-bold transition-colors",
                direction === "-"
                  ? "bg-red-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              −
            </button>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="Количество"
            className="min-h-11 flex-1"
          />
        </div>
        {product && delta && parseInt(delta, 10) > 0 && (
          <p className="text-xs text-muted-foreground">
            Станет:{" "}
            <span className="font-semibold text-foreground">
              {Math.max(0, product.quantity + (direction === "+" ? parseInt(delta, 10) : -parseInt(delta, 10)))}{" "}
              {product.unit}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Причина</Label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {REASON_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {direction === "+" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
          <p className="text-xs font-medium text-primary">
            Партия при приходе{reason === "receipt" ? " *" : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Срок годности</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="min-h-10 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Код партии</Label>
              <Input
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Необяз."
                className="min-h-10 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Комментарий (необязательно)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Накладная, примечание…"
          className="min-h-11"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1 min-h-11">
          Отмена
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={loading}
          className={cn(
            "flex-1 min-h-11",
            direction === "-" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {loading
            ? "…"
            : direction === "+"
            ? "Добавить"
            : "Списать"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl h-auto overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Корректировка остатка</SheetTitle>
          </SheetHeader>
          {Content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Корректировка остатка</DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const {
    products,
    productsLoading,
    addProduct,
    updateProduct,
    adjustProduct,
    deleteProduct,
    refetchProducts,
  } = useInventory();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormState>(emptyForm);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [transferringProduct, setTransferringProduct] = useState<Product | null>(null);

  const canEdit = user?.role === "admin";
  const canOperate = useCanOperateStock();

  const categories = useMemo(() => buildCategoryFilterList(products), [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory)
      list = list.filter((p) => normalizeCategory(p.category) === activeCategory);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.supplier ?? "").toLowerCase().includes(q)
    );
  }, [products, searchQuery, activeCategory]);

  useEffect(() => {
    if (searchParams.get("action") === "add" && canEdit) {
      setEditorMode("add");
      setEditingId(null);
      setFormData(emptyForm());
      setEditorOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canEdit, setSearchParams]);

  function openAdd() {
    setEditorMode("add");
    setEditingId(null);
    setFormData(emptyForm());
    setEditorOpen(true);
  }

  function openEdit(p: Product) {
    setEditorMode("edit");
    setEditingId(p.id);
    setFormData(productToForm(p));
    setEditorOpen(true);
  }

  async function submitForm() {
    if (!formData.name.trim() || !formData.sku.trim()) {
      toast.error("Укажите название и артикул");
      return;
    }
    if (!normalizeCategory(formData.category)) {
      toast.error("Выберите категорию напитка");
      return;
    }
    const qty = parseInt(formData.quantity, 10) || 0;
    if (qty > 0 && !formData.expiryDate.trim()) {
      toast.error("Укажите срок годности — без даты партия не создаётся");
      return;
    }
    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      category: normalizeCategory(formData.category).toString(),
      quantity: qty,
      unit: formData.unit,
      location: formData.location.trim(),
      cell: formData.cell.trim(),
      description: formData.description.trim(),
      barcode: formData.barcode.trim() || undefined,
      supplier: formData.supplier.trim() || undefined,
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      salePrice: formData.salePrice ? parseFloat(formData.salePrice) : undefined,
      imageUrl: formData.imageUrl.trim() || undefined,
      minQuantity: formData.minQuantity ? parseInt(formData.minQuantity, 10) : undefined,
      expiryDate: formData.expiryDate || undefined,
      batchCode: formData.batchCode.trim() || undefined,
    };
    try {
      if (editorMode === "add") {
        await addProduct(payload);
        toast.success("Позиция добавлена");
      } else if (editingId) {
        const old = products.find((p) => p.id === editingId);
        const { expiryDate, batchCode, ...productPatch } = payload;
        await updateProduct(editingId, productPatch);
        if (expiryDate && old && qty > old.quantity) {
          await createBatchRequest({
            productId: editingId,
            quantity: qty - old.quantity,
            expiryDate,
            batchCode,
            addToStock: false,
          });
        } else if (expiryDate && qty > 0 && !old?.batchCount) {
          await createBatchRequest({
            productId: editingId,
            quantity: qty,
            expiryDate,
            batchCode,
            addToStock: false,
          });
        }
        toast.success("Сохранено");
      }
      setEditorOpen(false);
      setFormData(emptyForm());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  }

  async function handleAdjust(
    delta: number,
    reason: string,
    note: string,
    opts?: { expiryDate?: string; batchCode?: string }
  ) {
    if (!adjustingProduct) return;
    try {
      await adjustProduct(adjustingProduct.id, delta, reason, note || undefined, opts);
      toast.success(delta > 0 ? `+${delta} ${adjustingProduct.unit}` : `${delta} ${adjustingProduct.unit}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      throw e;
    }
  }

  function handlePrintReport() {
    try {
      openInventoryPrintReport(filteredProducts.length ? filteredProducts : products);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось открыть отчёт");
    }
  }

  async function handlePdfLatin() {
    try {
      await downloadInventoryPdfLatin(filteredProducts.length ? filteredProducts : products);
      toast.success("Файл скачан");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка PDF");
    }
  }

  function handleBarcodeScan(raw: string) {
    const parsed = parseBarcode(raw);
    const searchCode = parsed.gtin ?? raw.replace(/\s/g, "");
    setSearchQuery(searchCode);
    const found = matchProductByCode(products, raw) as Product | undefined;
    if (found) {
      toast.success(`Найден: ${found.name}`);
      if (canOperate) {
        setAdjustingProduct(found);
        if (parsed.expiryDate) {
          toast.info(`Срок из кода: ${parsed.expiryDate}`);
        }
      }
    } else if (canEdit) {
      toast.info("Товар не найден — открыта форма добавления");
      setEditorMode("add");
      setEditingId(null);
      setFormData({
        ...emptyForm(),
        barcode: parsed.gtin ?? searchCode,
        expiryDate: parsed.expiryDate ?? "",
        batchCode: parsed.batchCode ?? "",
      });
      setEditorOpen(true);
    } else {
      toast.info(`Поиск по коду: ${searchCode.slice(0, 20)}…`);
    }
  }

  const stockBadge = (p: Product) => {
    const qty = p.quantity;
    const unit = p.unit;
    if (isCriticalStock({ quantity: qty }))
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-300">
          {qty} {unit}
        </span>
      );
    if (isLowStock({ quantity: qty, minQuantity: p.minQuantity }))
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200">
          {qty} {unit}
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
        {qty} {unit}
      </span>
    );
  };

  const editorFooter = (
    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-end">
      <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setEditorOpen(false)}>
        Отмена
      </Button>
      <Button type="button" className="min-h-11 sm:min-h-9" onClick={() => void submitForm()}>
        {editorMode === "add" ? "Добавить на склад" : "Сохранить"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-28 md:pb-10 md:pt-8 md:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Каталог напитков
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {productsLoading
                ? "Загрузка…"
                : `${products.length} позиций · вода, соки, газировка, пиво и др.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-9" onClick={handlePrintReport}>
              <Printer className="h-3.5 w-3.5" />
              Печать
            </Button>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => void handlePdfLatin()}
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
            )}
            {canEdit && (
              <Button type="button" size="sm" className="gap-1.5 h-9 shadow-sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Добавить
              </Button>
            )}
          </div>
        </header>

        {/* Search */}
        <Card className="p-2.5 sm:p-3 mb-3 border-border/70 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
            <Input
              placeholder="Поиск: кола, NAP-, 4601234…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm min-h-10 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 h-9 gap-1.5 px-3"
              onClick={() => setScannerOpen(true)}
            >
              <ScanBarcode className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">Скан</span>
            </Button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </Card>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-muted/40 hover:bg-muted text-muted-foreground"
              )}
            >
              Все
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-muted/40 hover:bg-muted text-muted-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Desktop table */}
        <Card className="hidden md:block overflow-hidden border-border/70 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Наименование</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Артикул</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Категория</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Остаток</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Срок</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Зона / ячейка</th>
                  {(canEdit || canOperate) && (
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-right w-36">
                      Действия
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canEdit || canOperate ? 7 : 6}
                      className="px-4 py-16 text-center text-muted-foreground text-sm"
                    >
                      Ничего не найдено. Измените запрос или добавьте позицию.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-muted/25 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border shrink-0" />
                          )}
                          <div>
                            <div className="font-medium">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.supplier && (
                            <span className="text-[11px] text-muted-foreground">{p.supplier}</span>
                          )}
                          {p.barcode && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Barcode className="h-3 w-3" />
                              {p.barcode}
                            </span>
                          )}
                        </div>
                        {p.costPrice != null && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatPrice(p.costPrice)} / {p.salePrice ? formatPrice(p.salePrice) : "—"}
                          </div>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 text-sm">{categoryDisplayName(p.category)}</td>
                      <td className="px-4 py-3">{stockBadge(p)}</td>
                      <td className="px-4 py-3">
                        <ExpiryBadge expiryDate={p.nearestExpiry ?? p.expiryDate} />
                        {!p.nearestExpiry && !p.expiryDate && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-foreground">{p.location}</span>
                        {p.cell && (
                          <span className="block text-xs text-muted-foreground">яч. {p.cell}</span>
                        )}
                      </td>
                      {(canEdit || canOperate) && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canOperate && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10"
                                title="Переместить"
                                onClick={() => setTransferringProduct(p)}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canOperate && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                title="Движение"
                                onClick={() => setAdjustingProduct(p)}
                              >
                                <TrendingUp className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canEdit && (
                              <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEdit(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeletingProduct(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {filteredProducts.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed text-sm">
              Пусто по этому запросу
            </Card>
          ) : (
            filteredProducts.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  "p-4 shadow-sm border transition-transform active:scale-[0.99]",
                  p.quantity < CRITICAL_STOCK_THRESHOLD
                    ? "border-red-500/20"
                    : p.quantity < LOW_STOCK_THRESHOLD
                    ? "border-amber-500/20"
                    : "border-border/70"
                )}
              >
                <div className="flex justify-between gap-3">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover border shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base leading-snug">{p.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{p.sku}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {categoryDisplayName(p.category)}
                      {p.location ? ` · ${p.location}` : ""}
                      {p.cell ? ` · ${p.cell}` : ""}
                    </p>
                    {p.supplier && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.supplier}</p>
                    )}
                    {p.costPrice != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Закуп: {formatPrice(p.costPrice)}
                        {p.salePrice ? ` · Продажа: ${formatPrice(p.salePrice)}` : ""}
                      </p>
                    )}
                    <div className="mt-1.5">
                      <ExpiryBadge expiryDate={p.nearestExpiry ?? p.expiryDate} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "text-xl font-bold tabular-nums",
                        p.quantity < CRITICAL_STOCK_THRESHOLD
                          ? "text-red-600 dark:text-red-400"
                          : p.quantity < LOW_STOCK_THRESHOLD
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-primary"
                      )}
                    >
                      {p.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.unit}</div>
                  </div>
                </div>
                {(canEdit || canOperate) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    {canOperate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 h-9 gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 border-0"
                      onClick={() => setAdjustingProduct(p)}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Движение
                    </Button>
                    )}
                    {canEdit && (
                    <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Изменить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2.5 text-destructive border-destructive/30"
                      onClick={() => setDeletingProduct(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    </>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* FAB mobile: scan + add */}
      <div className="md:hidden fixed z-30 flex flex-col gap-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom)+14px)] right-4">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className={cn(
            "liquid-glass flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[1.15rem]",
            "text-primary active:scale-95 transition-all duration-300"
          )}
          aria-label="Сканер"
        >
          <ScanBarcode className="h-5 w-5" strokeWidth={2} />
        </button>
        {canEdit && (
        <button
          type="button"
          onClick={openAdd}
          className={cn(
            "relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-[1.35rem]",
            "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground",
            "shadow-[0_4px_20px_hsl(var(--primary)/0.4),inset_0_1px_0_hsl(0_0%_100%/0.25)]",
            "ring-2 ring-primary/25 active:scale-95 transition-all duration-300"
          )}
          aria-label="Добавить позицию"
        >
          <Plus className="h-7 w-7" strokeWidth={2.25} />
        </button>
        )}
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      <TransferDialog
        product={transferringProduct}
        open={!!transferringProduct}
        onClose={() => setTransferringProduct(null)}
        onDone={() => refetchProducts()}
      />

      <ProductEditorShell
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editorMode === "add" ? "Новая позиция" : "Редактирование"}
        footer={editorFooter}
      >
        <ProductFormFields
          form={formData}
          setForm={setFormData}
          idPrefix="m"
          editingProductId={editorMode === "edit" ? editingId : null}
        />
      </ProductEditorShell>

      <AdjustDialog
        product={adjustingProduct}
        open={!!adjustingProduct}
        onClose={() => setAdjustingProduct(null)}
        onAdjust={handleAdjust}
      />

      <AlertDialog
        open={!!deletingProduct}
        onOpenChange={(o) => !o && setDeletingProduct(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
          <AlertDialogDescription>
            Данные будут удалены из каталога. Действие необратимо.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = deletingProduct;
                if (!id) return;
                void (async () => {
                  try {
                    await deleteProduct(id);
                    toast.success("Удалено");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Ошибка удаления");
                  } finally {
                    setDeletingProduct(null);
                  }
                })();
              }}
            >
              Удалить
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
