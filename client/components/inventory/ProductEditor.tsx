import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { QUICK_CATEGORIES, UNIT_OPTIONS, normalizeCategory } from "@/lib/beverage";
import type { Product } from "@shared/api";
import { Camera, ScanBarcode, X, Calendar, Package } from "lucide-react";
import { CellPicker } from "@/components/inventory/CellPicker";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { parseBarcode } from "@/lib/barcode";
import { fetchBatches } from "@/lib/api";
import { expiryLabel, expiryStatus } from "@/lib/expiry";

export interface ProductFormState {
  name: string;
  sku: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  cell: string;
  description: string;
  barcode: string;
  supplier: string;
  costPrice: string;
  salePrice: string;
  imageUrl: string;
  minQuantity: string;
  expiryDate: string;
  batchCode: string;
}

export function emptyForm(): ProductFormState {
  return {
    name: "",
    sku: "",
    category: "",
    quantity: "",
    unit: "ящик",
    location: "",
    cell: "",
    description: "",
    barcode: "",
    supplier: "",
    costPrice: "",
    salePrice: "",
    imageUrl: "",
    minQuantity: "",
    expiryDate: "",
    batchCode: "",
  };
}

export function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    sku: p.sku,
    category: normalizeCategory(p.category).toString(),
    quantity: String(p.quantity),
    unit: p.unit,
    location: p.location,
    cell: p.cell,
    description: p.description ?? "",
    barcode: p.barcode ?? "",
    supplier: p.supplier ?? "",
    costPrice: p.costPrice != null ? String(p.costPrice) : "",
    salePrice: p.salePrice != null ? String(p.salePrice) : "",
    imageUrl: p.imageUrl ?? "",
    minQuantity: p.minQuantity != null ? String(p.minQuantity) : "",
    expiryDate: "",
    batchCode: "",
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 pt-2 pb-1">
      {children}
    </p>
  );
}

export function ProductFormFields({
  form,
  setForm,
  idPrefix = "",
  editingProductId,
  allowCreateCell = true,
}: {
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  idPrefix?: string;
  editingProductId?: string | null;
  allowCreateCell?: boolean;
}) {
  const pf = (s: string) => (idPrefix ? `${idPrefix}-${s}` : s);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [existingBatches, setExistingBatches] = useState<
    { id: string; batchCode: string; quantity: number; expiryDate: string }[]
  >([]);

  useEffect(() => {
    if (!editingProductId) {
      setExistingBatches([]);
      return;
    }
    void fetchBatches(editingProductId).then((batches) => {
      setExistingBatches(
        batches.map((b) => ({
          id: b.id,
          batchCode: b.batchCode,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
        }))
      );
    });
  }, [editingProductId]);

  function handleBarcodeScan(raw: string) {
    const parsed = parseBarcode(raw);
    setForm((f) => ({
      ...f,
      barcode: parsed.gtin ?? raw.replace(/\s/g, "").slice(0, 32),
      expiryDate: parsed.expiryDate ?? f.expiryDate,
      batchCode: parsed.batchCode ?? f.batchCode,
    }));
  }

  return (
    <div className="space-y-4 pb-2">
      <SectionLabel>Основное</SectionLabel>

      <div className="space-y-2">
        <span className="text-sm font-medium">Фото товара</span>
        <div className="flex items-start gap-3">
          {form.imageUrl ? (
            <div className="relative shrink-0">
              <img
                src={form.imageUrl}
                alt="Превью"
                className="h-20 w-20 rounded-xl object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors">
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground mt-1">Добавить</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 400_000) {
                    alert("Фото до 400 КБ");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setForm((f) => ({ ...f, imageUrl: String(reader.result) }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            JPEG, PNG или WebP до 400 КБ. Отображается в каталоге и на карте склада.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={pf("name")} className="text-sm font-medium">
          Наименование *
        </Label>
        <Input
          id={pf("name")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Кола 0,5 л ПЭТ"
          className="min-h-11"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("sku")} className="text-sm font-medium">
            Артикул / код *
          </Label>
          <Input
            id={pf("sku")}
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="NAP-COLA-05"
            className="min-h-11 font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={pf("barcode")} className="text-sm font-medium">
            Штрихкод / GTIN
          </Label>
          <div className="flex gap-2">
            <Input
              id={pf("barcode")}
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder="4601234567890"
              className="min-h-11 font-mono text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => setScannerOpen(true)}
              title="Сканировать"
            >
              <ScanBarcode className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Категория напитка</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, category: c }))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                normalizeCategory(form.category) === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/40 hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          id={pf("category")}
          value={normalizeCategory(form.category)}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Выберите категорию</option>
          {QUICK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <SectionLabel>Количество и место</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("qty")} className="text-sm font-medium">
            Количество
          </Label>
          <Input
            id={pf("qty")}
            type="number"
            inputMode="numeric"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="0"
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={pf("minqty")} className="text-sm font-medium">
            Мин. остаток
          </Label>
          <Input
            id={pf("minqty")}
            type="number"
            inputMode="numeric"
            value={form.minQuantity}
            onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
            placeholder="36"
            className="min-h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("unit")} className="text-sm font-medium">
            Единица
          </Label>
          <select
            id={pf("unit")}
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CellPicker
        location={form.location}
        cell={form.cell}
        onLocationChange={(v) => setForm((f) => ({ ...f, location: v }))}
        onCellChange={(v) => setForm((f) => ({ ...f, cell: v }))}
        idPrefix={idPrefix}
        allowCreate={allowCreateCell}
      />

      <SectionLabel>Срок годности и партия</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("expiry")} className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Срок годности
          </Label>
          <Input
            id={pf("expiry")}
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
            className="min-h-11 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            При добавлении товара создаётся партия с этой датой
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={pf("batch")} className="text-sm font-medium flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Код партии
          </Label>
          <Input
            id={pf("batch")}
            value={form.batchCode}
            onChange={(e) => setForm((f) => ({ ...f, batchCode: e.target.value }))}
            placeholder="Необязательно"
            className="min-h-11 text-sm font-mono"
          />
        </div>
      </div>

      {existingBatches.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Текущие партии на складе:</p>
          {existingBatches.map((b) => (
            <div key={b.id} className="flex justify-between text-xs">
              <span className="font-mono">{b.batchCode || "—"}</span>
              <span>
                {b.quantity} шт · {expiryLabel(expiryStatus(b.expiryDate))} ({b.expiryDate})
              </span>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>Поставщик и цены</SectionLabel>

      <div className="space-y-2">
        <Label htmlFor={pf("supplier")} className="text-sm font-medium">
          Поставщик
        </Label>
        <Input
          id={pf("supplier")}
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
          placeholder="ООО «Напитки Плюс»"
          className="min-h-11 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={pf("cost")} className="text-sm font-medium">
            Закупочная цена ₽
          </Label>
          <Input
            id={pf("cost")}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.costPrice}
            onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
            placeholder="0.00"
            className="min-h-11 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={pf("sale")} className="text-sm font-medium">
            Цена продажи ₽
          </Label>
          <Input
            id={pf("sale")}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.salePrice}
            onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
            placeholder="0.00"
            className="min-h-11 text-sm"
          />
        </div>
      </div>

      <SectionLabel>Дополнительно</SectionLabel>

      <div className="space-y-2">
        <Label htmlFor={pf("desc")} className="text-sm font-medium">
          Примечание
        </Label>
        <Textarea
          id={pf("desc")}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Особые условия хранения, примечания…"
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        title="Сканировать штрихкод"
        hint="Наведите на штрихкод EAN или DataMatrix «Честный знак» — GTIN и срок подставятся автоматически"
        submitLabel="Подставить в форму"
      />
    </div>
  );
}

export function ProductEditorShell({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[min(96vh,920px)] overflow-y-auto rounded-t-[1.25rem] border-0 bg-card px-4 pb-safe pt-0 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="sticky top-0 z-10 -mx-4 bg-card px-4 pb-3 pt-3 border-b border-border/60">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-foreground/15 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)]" />
            <SheetHeader className="space-y-0 text-left p-0">
              <SheetTitle className="text-xl font-semibold pr-8">{title}</SheetTitle>
            </SheetHeader>
          </div>
          <div className="pt-4">{children}</div>
          <div className="liquid-glass liquid-glass-flat sticky bottom-0 -mx-4 mt-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-4">{children}</div>
        <DialogFooter className="px-6 pb-5 pt-4 border-t bg-muted/20 flex-col sm:flex-row gap-2 sm:gap-0">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
