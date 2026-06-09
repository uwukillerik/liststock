import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Wine, Lock, User, Sparkles, Shield, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      toast.error("Введите логин и пароль");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      toast.success("Добро пожаловать");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-accent/[0.06]" />
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-[420px]"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/25 ring-4 ring-primary/10"
          >
            <Wine className="h-9 w-9" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            ListStock
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
            Остатки, зоны, сроки годности и инвентаризация
          </p>
        </div>

        <Card className="relative overflow-hidden border-border/50 shadow-2xl shadow-primary/5 backdrop-blur-sm bg-card/95">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-accent" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Вход в систему</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Роль определяется автоматически по учётной записи
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Логин
                </label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Введите логин"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
                  className="min-h-12 text-base pl-4 border-border/80 focus-visible:ring-primary/30"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Пароль
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
                  className="min-h-12 text-base pl-4 border-border/80 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <Button
              onClick={() => void handleLogin()}
              disabled={submitting}
              size="lg"
              className={cn(
                "w-full mt-7 min-h-12 text-base font-semibold",
                "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/80",
                "shadow-lg shadow-primary/20 transition-all duration-200",
                submitting && "opacity-80"
              )}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Вход…
                </span>
              ) : (
                "Войти"
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
