import React, { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shift } from "@shared/api";
import { useAuth } from "./AuthContext";
import {
  closeShiftRequest,
  fetchActiveShift,
  openShiftRequest,
} from "@/lib/api";

interface ShiftContextType {
  activeShift: Shift | null;
  shiftLoading: boolean;
  openShift: (note?: string) => Promise<void>;
  closeShift: (note?: string) => Promise<void>;
  refetchShift: () => void;
  hasOpenShift: boolean;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["shift", "active"],
    queryFn: fetchActiveShift,
    enabled: isLoggedIn,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shift"] });
    queryClient.invalidateQueries({ queryKey: ["movements"] });
  };

  const openMut = useMutation({
    mutationFn: (note?: string) => openShiftRequest(note),
    onSuccess: invalidate,
  });

  const closeMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      closeShiftRequest(id, note),
    onSuccess: invalidate,
  });

  const activeShift = q.data ?? null;

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        shiftLoading: q.isLoading,
        hasOpenShift: !!activeShift,
        openShift: async (note) => {
          await openMut.mutateAsync(note);
        },
        closeShift: async (note) => {
          if (!activeShift) return;
          await closeMut.mutateAsync({ id: activeShift.id, note });
        },
        refetchShift: () => {
          void q.refetch();
        },
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used within ShiftProvider");
  return ctx;
}

/** Кладовщик должен иметь открытую смену; админ — нет. */
export function useCanOperateStock() {
  const { user } = useAuth();
  const { hasOpenShift } = useShift();
  if (user?.role === "admin") return true;
  return hasOpenShift;
}
