import React, { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Camera, Keyboard, ScanLine, X } from "lucide-react";
import { cn } from "@/lib/utils";

export { extractGtinFromChestnyZnak, parseBarcode, matchProductByCode } from "@/lib/barcode";
export type { ParsedBarcode } from "@/lib/barcode";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  hint?: string;
  submitLabel?: string;
}

const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
];

export function BarcodeScanner({
  open,
  onClose,
  onScan,
  title = "Сканер штрихкода / QR",
  hint = "Поддерживается «Честный знак» (DataMatrix), EAN-13 и QR-коды",
  submitLabel = "Применить",
}: BarcodeScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
  };

  const handleDecoded = (decoded: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScan(decoded.trim());
    void stopCamera();
    onClose();
  };

  const startCamera = async () => {
    setError(null);
    setStarting(true);
    scannedRef.current = false;
    await stopCamera();
    try {
      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdge * 0.75);
            return { width: size, height: Math.floor(size * 0.65) };
          },
          aspectRatio: 1,
          formatsToSupport: SCAN_FORMATS,
          disableFlip: false,
        },
        handleDecoded,
        () => {}
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Камера недоступна. Введите код вручную или разрешите доступ."
      );
      setMode("manual");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open && mode === "camera") {
      void startCamera();
    }
    if (!open) {
      void stopCamera();
      setManualCode("");
      setError(null);
      scannedRef.current = false;
    }
    return () => {
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  function submitManual() {
    const code = manualCode.trim();
    if (!code) return;
    onScan(code);
    setManualCode("");
    onClose();
  }

  const content = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{hint}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "camera" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setMode("camera")}
        >
          <Camera className="h-3.5 w-3.5" />
          Камера
        </Button>
        <Button
          type="button"
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => {
            setMode("manual");
            void stopCamera();
          }}
        >
          <Keyboard className="h-3.5 w-3.5" />
          Вручную
        </Button>
      </div>

      {mode === "camera" && (
        <div className="relative">
          <div
            id={regionId}
            className={cn(
              "overflow-hidden rounded-xl border border-border bg-black/5",
              "min-h-[240px] w-full"
            )}
          />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
              <span className="text-sm text-muted-foreground">Запуск камеры…</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Наведите на DataMatrix «Честный знак» или штрихкод EAN
          </p>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-2">
          <Label htmlFor="manual-barcode">Код маркировки / штрихкод</Label>
          <Input
            id="manual-barcode"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="010460… или 4601234567890"
            className="min-h-12 font-mono text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
          />
          <Button type="button" className="w-full min-h-11" onClick={submitManual}>
            {submitLabel}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              {title}
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
            <ScanLine className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {content}
        <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
