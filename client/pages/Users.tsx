import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchUsers, createUserRequest, updateUserRequest, deleteUserRequest } from "@/lib/api";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  User2,
  Users,
  AlertCircle,
} from "lucide-react";
import type { UserManagementEntry } from "@shared/api";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface UserForm {
  username: string;
  displayName: string;
  password: string;
  role: "admin" | "worker";
}

const emptyUserForm = (): UserForm => ({
  username: "",
  displayName: "",
  password: "",
  role: "worker",
});

function UserDialog({
  open,
  onClose,
  mode,
  editUser,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  editUser?: UserManagementEntry;
  onSubmit: (form: UserForm) => Promise<void>;
}) {
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (mode === "edit" && editUser) {
        setForm({
          username: editUser.username,
          displayName: editUser.displayName,
          password: "",
          role: editUser.role,
        });
      } else {
        setForm(emptyUserForm());
      }
    }
  }, [open, mode, editUser]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim()) {
      toast.error("Укажите имя");
      return;
    }
    if (mode === "add" && (!form.username.trim() || !form.password)) {
      toast.error("Укажите логин и пароль");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Новый сотрудник" : "Редактирование"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-1">
          {mode === "add" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Логин *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="ivanov"
                className="h-11"
                autoComplete="off"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Имя (отображается в системе) *</Label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Иван Иванов"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {mode === "edit" ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль *"}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="h-11"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Роль</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: "worker" }))}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  form.role === "worker"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <User2 className="h-4 w-4" />
                Кладовщик
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: "admin" }))}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  form.role === "admin"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                )}
              >
                <Shield className="h-4 w-4" />
                Администратор
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11">
              {loading ? "…" : mode === "add" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: currentUser?.role === "admin",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingUser, setEditingUser] = useState<UserManagementEntry | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const createMut = useMutation({ mutationFn: createUserRequest, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateUserRequest>[1] }) =>
      updateUserRequest(id, patch),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({ mutationFn: deleteUserRequest, onSuccess: invalidate });

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex-1 overflow-auto min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md shadow-sm">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Доступ ограничен</h2>
          <p className="text-sm text-muted-foreground">
            Управление сотрудниками доступно только администратору.
          </p>
        </Card>
      </div>
    );
  }

  async function handleSubmit(form: UserForm) {
    if (dialogMode === "add") {
      await createMut.mutateAsync({
        username: form.username.trim().toLowerCase(),
        displayName: form.displayName.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success("Сотрудник создан");
    } else if (editingUser) {
      const patch: Parameters<typeof updateUserRequest>[1] = {
        displayName: form.displayName.trim(),
        role: form.role,
      };
      if (form.password) patch.password = form.password;
      await updateMut.mutateAsync({ id: editingUser.id, patch });
      toast.success("Сохранено");
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-10 md:pt-8 md:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Сотрудники</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Загрузка…" : `${users.length} учётных записей`}
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 h-9 shadow-sm shrink-0"
            onClick={() => {
              setDialogMode("add");
              setEditingUser(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить сотрудника
          </Button>
        </div>

        {/* Desktop table */}
        <Card className="hidden md:block overflow-hidden border-border/70 shadow-sm mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Имя / Логин
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Роль
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Создан
                </th>
                <th className="px-4 py-3 text-right w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    Нет сотрудников
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.displayName}</p>
                      <p className="text-xs font-mono text-muted-foreground">@{u.username}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1",
                          u.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {u.role === "admin" ? (
                          <><Shield className="h-3 w-3" /> Администратор</>
                        ) : (
                          <><User2 className="h-3 w-3" /> Кладовщик</>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(u.createdAt), "dd MMM yyyy", { locale: ru })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingUser(u);
                            setDialogMode("edit");
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeletingId(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {isLoading ? (
            <Card className="p-10 text-center text-muted-foreground">Загрузка…</Card>
          ) : users.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Нет сотрудников</p>
            </Card>
          ) : (
            users.map((u) => (
              <Card key={u.id} className="p-4 border-border/70 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
                      {u.displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{u.displayName}</p>
                      <p className="text-xs font-mono text-muted-foreground">@{u.username}</p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 mt-1",
                          u.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {u.role === "admin" ? (
                          <><Shield className="h-3 w-3" /> Администратор</>
                        ) : (
                          <><User2 className="h-3 w-3" /> Кладовщик</>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => {
                        setEditingUser(u);
                        setDialogMode("edit");
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUser?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive"
                        onClick={() => setDeletingId(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        editUser={editingUser}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
          <AlertDialogDescription>
            Учётная запись будет удалена. Это действие необратимо.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = deletingId;
                if (!id) return;
                void (async () => {
                  try {
                    await deleteMut.mutateAsync(id);
                    toast.success("Удалено");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Ошибка");
                  } finally {
                    setDeletingId(null);
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
