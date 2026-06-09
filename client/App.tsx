import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { InventoryProvider } from "./context/InventoryContext";
import { ShiftProvider } from "./context/ShiftContext";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import Analytics from "./pages/Analytics";
import Movements from "./pages/Movements";
import UsersPage from "./pages/Users";
import WarehouseMap from "./pages/WarehouseMap";
import InventoryCountPage from "./pages/InventoryCount";
import ShiftsPage from "./pages/Shifts";
import ExpiryPage from "./pages/Expiry";
import WarehousePlan from "./pages/WarehousePlan";
import Warehouse3D from "./pages/Warehouse3D";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isLoggedIn, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground px-4 text-center">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-foreground">ListStock</p>
        <p className="text-xs text-muted-foreground">Загрузка сессии…</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/warehouse" element={<WarehouseMap />} />
        <Route path="/warehouse/plan" element={<WarehousePlan />} />
        <Route path="/warehouse/3d" element={<Warehouse3D />} />
        <Route path="/expiry" element={<ExpiryPage />} />
        <Route path="/inventory-count" element={<InventoryCountPage />} />
        <Route path="/inventory-count/:sessionId" element={<InventoryCountPage />} />
        <Route path="/movements" element={<Movements />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner richColors />
        <AuthProvider>
          <ShiftProvider>
            <InventoryProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <AppRoutes />
              </BrowserRouter>
            </InventoryProvider>
          </ShiftProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
