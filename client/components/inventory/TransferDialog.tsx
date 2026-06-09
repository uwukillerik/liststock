import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ArrowRightLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@shared/api";
import { transferProductRequest } from "@/lib/api";
import { CellPicker } from "@/components/inventory/CellPicker";

interface TransferDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function TransferDialog({
  product,
  open,
  onClose,
  onDone,
}: TransferDialogProps) {
  const [toLocation, setToLocation] = useState("");
  const [toCell, setToCell] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  React.useEffect(() => {
    if (open) {
      setToLocation("");
      setToCell("");
      setNote("");
    }
  }, [open, product?.id]);

  async function submit() {
    if (!product) return;
    if (!toLocation.trim() || !toCell.trim()) {
      toast.error("Укажите зону и ячейку назначения");
      return;
    }
    setLoading(true);
    try {
      await transferProductRequest(product.id, {
        toLocation: toLocation.trim(),
        toCell: toCell.trim(),
        note: note.trim() || undefined,
      });
      toast.success(`«${product.name}» перемещён`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка перемещения");
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div className="space-y-4 py-2">
      {product && (
        <div className="rounded-xl bg-muted/40 px-4 py-3">
          <p className="font-semibold text-sm">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{product.sku}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Сейчас: {product.location || "—"} / {product.cell || "—"}
          </p>
        </div>
      )}

      <CellPicker
        location={toLocation}
        cell={toCell}
        onLocationChange={setToLocation}
        onCellChange={setToCell}
        idPrefix="transfer"
        allowCreate={false}
      />

      <div className="space-y-1.5">
        <Label>Комментарий (необязательно)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Причина перемещения…"
          className="min-h-10"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 min-h-11" onClick={onClose}>
          Отмена
        </Button>
        <Button className="flex-1 min-h-11 gap-2" disabled={loading} onClick={() => void submit()}>
          <ArrowRightLeft className="h-4 w-4" />
          {loading ? "…" : "Переместить"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Перемещение
            </SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Перемещение между ячейками
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
