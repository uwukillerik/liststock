import React, { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@shared/api";
import { useAuth } from "./AuthContext";
import {
  adjustProductRequest,
  createProductRequest,
  deleteProductRequest,
  fetchProducts,
  updateProductRequest,
} from "@/lib/api";

interface InventoryContextType {
  products: Product[];
  productsLoading: boolean;
  productsError: Error | null;
  addProduct: (product: Omit<Product, "id" | "lastUpdated">) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  adjustProduct: (
    id: string,
    delta: number,
    reason: string,
    note?: string,
    opts?: { expiryDate?: string; batchCode?: string }
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  refetchProducts: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
    enabled: isLoggedIn,
  });

  const products = q.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["movements"] });
  };

  const addMut = useMutation({ mutationFn: createProductRequest, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Product, "id" | "lastUpdated">> }) =>
      updateProductRequest(id, patch),
    onSuccess: invalidate,
  });
  const adjustMut = useMutation({
    mutationFn: ({
      id,
      delta,
      reason,
      note,
      opts,
    }: {
      id: string;
      delta: number;
      reason: string;
      note?: string;
      opts?: { expiryDate?: string; batchCode?: string };
    }) => adjustProductRequest(id, delta, reason, note, opts),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({ mutationFn: deleteProductRequest, onSuccess: invalidate });

  const addProduct = async (
    p: Omit<Product, "id" | "lastUpdated"> & { expiryDate?: string; batchCode?: string }
  ) => {
    await addMut.mutateAsync({
      name: p.name,
      sku: p.sku,
      category: p.category,
      quantity: p.quantity,
      unit: p.unit,
      location: p.location,
      cell: p.cell,
      description: p.description,
      barcode: p.barcode,
      supplier: p.supplier,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      imageUrl: p.imageUrl,
      minQuantity: p.minQuantity,
      expiryDate: p.expiryDate,
      batchCode: p.batchCode,
    } as Omit<Product, "id" | "lastUpdated">);
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const patch: Partial<Omit<Product, "id" | "lastUpdated">> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.sku !== undefined) patch.sku = updates.sku;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.quantity !== undefined) patch.quantity = updates.quantity;
    if (updates.unit !== undefined) patch.unit = updates.unit;
    if (updates.location !== undefined) patch.location = updates.location;
    if (updates.cell !== undefined) patch.cell = updates.cell;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.barcode !== undefined) patch.barcode = updates.barcode;
    if (updates.supplier !== undefined) patch.supplier = updates.supplier;
    if (updates.costPrice !== undefined) patch.costPrice = updates.costPrice;
    if (updates.salePrice !== undefined) patch.salePrice = updates.salePrice;
    if (updates.imageUrl !== undefined) patch.imageUrl = updates.imageUrl;
    if (updates.minQuantity !== undefined) patch.minQuantity = updates.minQuantity;
    await updateMut.mutateAsync({ id, patch });
  };

  const adjustProduct = async (
    id: string,
    delta: number,
    reason: string,
    note?: string,
    opts?: { expiryDate?: string; batchCode?: string }
  ) => {
    await adjustMut.mutateAsync({ id, delta, reason, note, opts });
  };

  const deleteProduct = async (id: string) => {
    await deleteMut.mutateAsync(id);
  };

  const getProduct = (id: string) => products.find((p) => p.id === id);

  const searchProducts = (query: string) => {
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        (p.barcode ?? "").toLowerCase().includes(lowerQuery)
    );
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        productsLoading: q.isLoading,
        productsError: q.error as Error | null,
        addProduct,
        updateProduct,
        adjustProduct,
        deleteProduct,
        getProduct,
        searchProducts,
        refetchProducts: () => { void q.refetch(); },
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used within InventoryProvider");
  return context;
}
