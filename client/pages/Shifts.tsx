import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { fetchShifts } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  Play,
  Square,
  User2,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

export default function ShiftsPage() {
  const { user } = useAuth();
  const { activeShift, openShift, closeShift, hasOpenShift } = useShift();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["shifts", "list"],
    queryFn: fetchShifts,
  });

  async function handleOpen() {
    setLoading(true);
    try {
      await openShift(note.trim() || undefined);
      toast.success("Смена открыта");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose() {
    setLoading(true);
    try {
      await closeShift(note.trim() || undefined);
      toast.success("Смена закрыта");
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const isWorker = user?.role === "worker";

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-10 md:pt-8 md:px-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Clock className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Смены</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Учёт смен кладовщиков
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isWorker
              ? "Откройте смену перед операциями со складом"
              : "Просмотр смен всех сотрудников"}
          </p>
        </header>

        {/* Active shift card */}
        <Card
          className={cn(
            "p-5 mb-6 border-2 overflow-hidden relative",
            hasOpenShift
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-border/70"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            {hasOpenShift && activeShift ? (
              <>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Смена активна</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Начало:{" "}
                  {new Date(activeShift.startedAt).toLocaleString("ru-RU")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Операций: {activeShift.movementCount ?? 0}
                </p>
                {activeShift.note && (
                  <p className="text-sm mt-2 italic">{activeShift.note}</p>
                )}
                {(isWorker || user?.role === "admin") && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Комментарий при закрытии</Label>
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Итог смены, замечания…"
                        className="min-h-10"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      className="gap-2 min-h-11"
                      disabled={loading}
                      onClick={() => void handleClose()}
                    >
                      <Square className="h-4 w-4" />
                      Закрыть смену
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="font-medium mb-1">Смена не открыта</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {isWorker
                    ? "Кладовщик не может проводить движения без активной смены"
                    : "Администратор может работать без смены"}
                </p>
                {(isWorker || user?.role === "admin") && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Комментарий (необязательно)</Label>
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Утренняя смена, приёмка…"
                        className="min-h-10"
                      />
                    </div>
                    <Button
                      className="gap-2 min-h-11"
                      disabled={loading}
                      onClick={() => void handleOpen()}
                    >
                      <Play className="h-4 w-4" />
                      Открыть смену
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* History */}
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          История смен
        </h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : shifts.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground border-dashed text-sm">
            Смен ещё не было
          </Card>
        ) : (
          <div className="space-y-2">
            {shifts.map((s) => (
              <Card
                key={s.id}
                className="p-4 border-border/70 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      s.status === "open"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <User2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.userName}</p>
                    <p className="text-xs text-muted-foreground">@{s.username}</p>
                  </div>
                </div>
                <div className="text-sm sm:text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.startedAt).toLocaleString("ru-RU")}
                    {s.endedAt && ` — ${new Date(s.endedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                  <p className="text-xs mt-0.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        s.status === "open"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.status === "open" ? "Открыта" : "Закрыта"}
                    </span>
                    {" · "}
                    {s.movementCount ?? 0} оп.
                    {s.status === "open" && (
                      <> · {formatDistanceToNow(new Date(s.startedAt), { locale: ru, addSuffix: false })}</>
                    )}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
