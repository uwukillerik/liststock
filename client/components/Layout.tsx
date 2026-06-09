import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Wine,
  LayoutGrid,
  BarChart3,
  LogOut,
  Home,
  History,
  Users,
  Moon,
  Sun,
  ChevronRight,
  Shield,
  User2,
  Lock,
  Map,
  Clock,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { changePasswordRequest, fetchExpiryAlerts } from "@/lib/api";
import { useShift } from "@/context/ShiftContext";

function ThemeToggle({ variant = "sidebar" }: { variant?: "sidebar" | "profile" }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "profile") {
    return (
      <div className="profile-theme-pill">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "profile-theme-btn",
            !isDark ? "profile-theme-btn-active" : "profile-theme-btn-inactive"
          )}
          title="Светлая тема"
        >
          <Sun className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "profile-theme-btn",
            isDark ? "profile-theme-btn-active" : "profile-theme-btn-inactive"
          )}
          title="Тёмная тема"
        >
          <Moon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground"
      title="Сменить тему"
    >
      <Sun className="h-4 w-4 hidden dark:block" />
      <Moon className="h-4 w-4 block dark:hidden" />
    </button>
  );
}

function ProfileMenuRow({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link to={to} onClick={onClick} className="profile-menu-row group">
      <span className="profile-icon-wrap">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-active:translate-x-0.5" />
    </Link>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cur || !next) return;
    if (next.length < 4) {
      toast.error("Новый пароль — минимум 4 символа");
      return;
    }
    setLoading(true);
    try {
      await changePasswordRequest(cur, next);
      toast.success("Пароль изменён");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Текущий пароль</Label>
        <Input
          type="password"
          value={cur}
          onChange={(e) => setCur(e.target.value)}
          className="h-11 glass-inset border-0 bg-white/70 shadow-none focus-visible:ring-primary/30 dark:bg-transparent"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Новый пароль</Label>
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="h-11 glass-inset border-0 bg-white/70 shadow-none focus-visible:ring-primary/30 dark:bg-transparent"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        className="h-10 w-full rounded-xl shadow-[0_2px_12px_hsl(var(--primary)/0.25)]"
        disabled={loading}
      >
        {loading ? "Сохранение…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { hasOpenShift, activeShift } = useShift();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const expiryQ = useQuery({
    queryKey: ["expiry-alerts"],
    queryFn: fetchExpiryAlerts,
    refetchInterval: 120_000,
  });

  const expiryUrgent =
    (expiryQ.data?.counts.expired ?? 0) +
    (expiryQ.data?.counts.today ?? 0) +
    (expiryQ.data?.counts.tomorrow ?? 0);

  const isActive = (path: string) =>
    path === "/warehouse/plan"
      ? location.pathname === path
      : location.pathname === path;

  const navItems = [
    { path: "/", label: "Главная", icon: Home },
    { path: "/inventory", label: "Каталог", icon: LayoutGrid },
    { path: "/warehouse", label: "Карта", icon: Map },
    { path: "/expiry", label: "Сроки", icon: CalendarClock, badge: expiryUrgent },
    { path: "/movements", label: "Движение", icon: History },
    { path: "/shifts", label: "Смены", icon: Clock },
    ...(user?.role === "admin"
      ? [
          { path: "/analytics", label: "Отчёты", icon: BarChart3 },
          { path: "/users", label: "Сотрудники", icon: Users },
        ]
      : []),
  ];

  const mobileNavItems = [
    navItems[0],
    navItems[1],
    navItems[2],
    navItems[3],
  ];

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:bg-sidebar md:text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-inner shrink-0">
            <Wine className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm tracking-tight leading-tight truncate">
              ListStock
            </div>
            <div className="text-[11px] text-sidebar-foreground/60 truncate">
              складской учёт
            </div>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
                {"badge" in item && (item.badge ?? 0) > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0 min-w-[1.25rem] text-center">
                    {item.badge}
                  </span>
                )}
                {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2 space-y-1.5">
          <div className="rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sm font-semibold text-sidebar-primary shrink-0">
                {(user?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
                  {user?.role === "admin" ? (
                    <><Shield className="h-3 w-3" /> Администратор</>
                  ) : (
                    <><User2 className="h-3 w-3" /> Кладовщик</>
                  )}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPwOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            Сменить пароль
          </button>
          {pwOpen && (
            <div className="px-1 pb-1">
              <ChangePasswordForm onDone={() => setPwOpen(false)} />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="w-full justify-center gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {expiryUrgent > 0 && !location.pathname.startsWith("/expiry") && (
          <div className="shrink-0 bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-orange-600 shrink-0" />
            <span className="flex-1 text-orange-900 dark:text-orange-200 text-xs sm:text-sm">
              {expiryQ.data?.counts.expired
                ? `${expiryQ.data.counts.expired} просрочено`
                : ""}
              {expiryQ.data?.counts.expired && expiryQ.data?.counts.today ? " · " : ""}
              {expiryQ.data?.counts.today
                ? `${expiryQ.data.counts.today} истекает сегодня`
                : ""}
              {!expiryQ.data?.counts.expired && !expiryQ.data?.counts.today && expiryQ.data?.counts.tomorrow
                ? `${expiryQ.data.counts.tomorrow} партий — срок завтра`
                : ""}
            </span>
            <Link to="/expiry" className="font-semibold text-primary whitespace-nowrap text-xs sm:text-sm">
              Подробнее →
            </Link>
          </div>
        )}
        {user?.role === "worker" && !hasOpenShift && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="flex-1 text-amber-900 dark:text-amber-200">
              Смена не открыта — операции со складом недоступны
            </span>
            <Link to="/shifts" className="font-semibold text-primary whitespace-nowrap">
              Открыть →
            </Link>
          </div>
        )}
        {user?.role === "worker" && hasOpenShift && activeShift && (
          <div className="shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
            <Clock className="h-3.5 w-3.5" />
            Смена активна · {activeShift.movementCount ?? 0} операций
            <Link to="/shifts" className="ml-auto font-medium text-primary">Подробнее</Link>
          </div>
        )}
        <div
          className={cn(
            "flex-1 overflow-auto",
            "pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0"
          )}
        >
          {children}
        </div>

        {/* Mobile bottom bar — Liquid Glass floating pill */}
        <nav
          aria-label="Основная навигация"
          className={cn(
            "md:hidden fixed bottom-0 left-0 right-0 z-40",
            "px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
            "pointer-events-none"
          )}
        >
          <div className="relative mx-auto max-w-lg">
            <div className="liquid-glass-glow" aria-hidden />
            <div
              className={cn(
                "liquid-glass liquid-glass-nav pointer-events-auto",
                "flex h-[3.75rem] items-stretch gap-1 rounded-[2rem] px-2"
              )}
            >
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const badge = "badge" in item ? (item.badge ?? 0) : 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "mobile-nav-item min-h-11",
                    active
                      ? "mobile-nav-item-active"
                      : "text-muted-foreground active:scale-[0.97]"
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn(
                        "h-[1.35rem] w-[1.35rem] transition-transform duration-200",
                        active && "scale-110 stroke-[2.5]"
                      )}
                    />
                    {badge > 0 && (
                      <span className="mobile-nav-badge">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  <span className={cn("leading-none", active && "font-semibold")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "mobile-nav-item min-h-11",
                    profileOpen
                      ? "mobile-nav-item-active"
                      : "text-muted-foreground active:scale-[0.97]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300",
                      profileOpen
                        ? "bg-primary text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/0.35)] ring-2 ring-primary/30"
                        : "bg-primary/12 text-primary ring-1 ring-primary/25 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]"
                    )}
                  >
                    {(user?.name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="leading-none">Профиль</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                hideClose
                overlayClassName="bg-foreground/15 backdrop-blur-[3px] dark:bg-black/50"
                className={cn(
                  "liquid-glass-sheet gap-0 border-0 bg-transparent p-0",
                  "max-h-[min(92vh,720px)] overflow-y-auto",
                  "rounded-t-[1.75rem] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                )}
              >
                <div className="sticky top-0 z-10 bg-gradient-to-b from-white/95 via-white/80 to-transparent px-5 pb-3 pt-3 backdrop-blur-md dark:from-[hsl(var(--card)/0.9)] dark:via-[hsl(var(--card)/0.65)]">
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/15 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6)] dark:bg-foreground/25" />
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-primary to-primary/75 text-2xl font-bold text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.25)]">
                      {(user?.name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold leading-tight">{user?.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        {user?.role === "admin" ? (
                          <>
                            <Shield className="h-3.5 w-3.5 text-primary" />
                            Администратор
                          </>
                        ) : (
                          <>
                            <User2 className="h-3.5 w-3.5 text-primary" />
                            Кладовщик
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/80">@{user?.username}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 px-5 pt-2">
                  <div className="space-y-2">
                    {user?.role === "admin" && (
                      <ProfileMenuRow
                        to="/users"
                        icon={Users}
                        label="Управление сотрудниками"
                        onClick={() => setProfileOpen(false)}
                      />
                    )}
                    <ProfileMenuRow
                      to="/shifts"
                      icon={Clock}
                      label="Смены"
                      onClick={() => setProfileOpen(false)}
                    />
                  </div>

                  <div className="glass-inset space-y-3 rounded-2xl p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="profile-icon-wrap h-8 w-8">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                      Сменить пароль
                    </p>
                    <ChangePasswordForm onDone={() => setProfileOpen(false)} />
                  </div>

                  <div className="profile-menu-row cursor-default active:scale-100">
                    <span className="profile-icon-wrap">
                      <Sun className="h-4 w-4 dark:hidden" />
                      <Moon className="hidden h-4 w-4 dark:block" />
                    </span>
                    <span className="flex-1 text-foreground">Тема оформления</span>
                    <ThemeToggle variant="profile" />
                  </div>

                  <button
                    type="button"
                    onClick={() => logout()}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition-all duration-200",
                      "border border-destructive/25 bg-destructive/8 text-destructive",
                      "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2)] active:scale-[0.98]",
                      "hover:bg-destructive/12"
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти из системы
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
