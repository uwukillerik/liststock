import type {
  AnalyticsSummary,
  AuthResponse,
  InventoryCountLine,
  InventoryCountSession,
  Product,
  Shift,
  StockMovement,
  User,
  UserManagementEntry,
  WarehouseCellEntry,
  WarehouseMapSummary,
} from "@shared/api";

const TOKEN_KEY = "liststock_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof body.error === "string" ? body.error : `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export async function loginRequest(
  username: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function meRequest(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>("/api/auth/me");
}

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchProducts(params?: {
  q?: string;
  category?: string;
  location?: string;
}): Promise<Product[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.category) sp.set("category", params.category);
  if (params?.location) sp.set("location", params.location);
  const qs = sp.toString();
  const r = await apiFetch<{ products: Product[] }>(
    `/api/products${qs ? `?${qs}` : ""}`
  );
  return r.products;
}

export async function createProductRequest(
  body: Omit<Product, "id" | "lastUpdated"> & { expiryDate?: string; batchCode?: string }
): Promise<Product> {
  const r = await apiFetch<{ product: Product }>("/api/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.product;
}

export async function updateProductRequest(
  id: string,
  patch: Partial<Omit<Product, "id" | "lastUpdated">>
): Promise<Product> {
  const r = await apiFetch<{ product: Product }>(`/api/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return r.product;
}

export async function adjustProductRequest(
  id: string,
  delta: number,
  reason: string,
  note?: string,
  opts?: { expiryDate?: string; batchCode?: string }
): Promise<Product> {
  const r = await apiFetch<{ product: Product }>(
    `/api/products/${id}/adjust`,
    {
      method: "POST",
      body: JSON.stringify({
        delta,
        reason,
        note,
        expiryDate: opts?.expiryDate,
        batchCode: opts?.batchCode,
      }),
    }
  );
  return r.product;
}

export async function deleteProductRequest(id: string): Promise<void> {
  await apiFetch<undefined>(`/api/products/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAnalytics(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>("/api/analytics");
}

export async function fetchMovements(params?: {
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ movements: StockMovement[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.productId) sp.set("productId", params.productId);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch<{ movements: StockMovement[]; total: number }>(
    `/api/movements${qs ? `?${qs}` : ""}`
  );
}

export async function fetchUsers(): Promise<UserManagementEntry[]> {
  const r = await apiFetch<{ users: UserManagementEntry[] }>("/api/users");
  return r.users;
}

export async function createUserRequest(body: {
  username: string;
  displayName: string;
  password: string;
  role: "admin" | "worker";
}): Promise<UserManagementEntry> {
  const r = await apiFetch<{ user: UserManagementEntry }>("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.user;
}

export async function updateUserRequest(
  id: string,
  patch: { displayName?: string; role?: "admin" | "worker"; password?: string }
): Promise<UserManagementEntry> {
  const r = await apiFetch<{ user: UserManagementEntry }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return r.user;
}

export async function deleteUserRequest(id: string): Promise<void> {
  await apiFetch<undefined>(`/api/users/${id}`, { method: "DELETE" });
}

export async function fetchActiveShift(): Promise<Shift | null> {
  const r = await apiFetch<{ shift: Shift | null }>("/api/shifts/active");
  return r.shift;
}

export async function fetchShifts(): Promise<Shift[]> {
  const r = await apiFetch<{ shifts: Shift[] }>("/api/shifts");
  return r.shifts;
}

export async function openShiftRequest(note?: string): Promise<Shift> {
  const r = await apiFetch<{ shift: Shift }>("/api/shifts/open", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  return r.shift;
}

export async function closeShiftRequest(id: string, note?: string): Promise<Shift> {
  const r = await apiFetch<{ shift: Shift }>(`/api/shifts/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  return r.shift;
}

export async function fetchWarehouseMap(): Promise<WarehouseMapSummary> {
  return apiFetch<WarehouseMapSummary>("/api/warehouse/map");
}

export async function fetchWarehouseCells(): Promise<{
  cells: WarehouseCellEntry[];
  locations: string[];
}> {
  return apiFetch("/api/warehouse/cells");
}

export async function createWarehouseCellRequest(body: {
  location: string;
  cell: string;
}): Promise<WarehouseCellEntry> {
  const r = await apiFetch<{ cell: WarehouseCellEntry }>("/api/warehouse/cells", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.cell;
}

export async function transferProductRequest(
  id: string,
  body: { toLocation: string; toCell: string; note?: string }
): Promise<Product> {
  const r = await apiFetch<{ product: Product }>(`/api/products/${id}/transfer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.product;
}

export async function fetchActiveInventorySession(): Promise<InventoryCountSession | null> {
  const r = await apiFetch<{ session: InventoryCountSession | null }>(
    "/api/inventory/sessions/active"
  );
  return r.session;
}

export async function startInventorySession(body: {
  location: string;
  cell: string;
  note?: string;
}): Promise<InventoryCountSession> {
  const r = await apiFetch<{ session: InventoryCountSession }>("/api/inventory/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.session;
}

export async function fetchInventorySession(id: string): Promise<{
  session: InventoryCountSession;
  lines: InventoryCountLine[];
}> {
  return apiFetch(`/api/inventory/sessions/${id}`);
}

export async function updateInventoryLineRequest(
  sessionId: string,
  productId: string,
  countedQty: number,
  note?: string
): Promise<void> {
  await apiFetch(`/api/inventory/sessions/${sessionId}/lines/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ countedQty, note }),
  });
}

export async function completeInventorySession(id: string): Promise<{
  adjusted: number;
  total: number;
}> {
  return apiFetch(`/api/inventory/sessions/${id}/complete`, { method: "POST" });
}

export async function cancelInventorySession(id: string): Promise<void> {
  await apiFetch(`/api/inventory/sessions/${id}/cancel`, { method: "POST" });
}

export async function fetchInventorySessions(): Promise<InventoryCountSession[]> {
  const r = await apiFetch<{ sessions: InventoryCountSession[] }>("/api/inventory/sessions");
  return r.sessions;
}

export async function startMassInventorySession(note?: string): Promise<InventoryCountSession> {
  const r = await apiFetch<{ session: InventoryCountSession }>("/api/inventory/sessions/mass", {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  return r.session;
}

export async function fetchExpiryAlerts(): Promise<import("@shared/api").ExpiryAlertsSummary> {
  return apiFetch("/api/batches/expiry-alerts");
}

export async function fetchBatches(productId?: string): Promise<import("@shared/api").ProductBatch[]> {
  const qs = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  const r = await apiFetch<{ batches: import("@shared/api").ProductBatch[] }>(`/api/batches${qs}`);
  return r.batches;
}

export async function createBatchRequest(body: {
  productId: string;
  batchCode?: string;
  quantity: number;
  expiryDate: string;
  note?: string;
  addToStock?: boolean;
}): Promise<import("@shared/api").ProductBatch> {
  const r = await apiFetch<{ batch: import("@shared/api").ProductBatch }>("/api/batches", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return r.batch;
}

export async function deleteBatchRequest(id: string): Promise<void> {
  await apiFetch(`/api/batches/${id}`, { method: "DELETE" });
}

export async function writeOffExpiredBatches(): Promise<{ writtenOff: number }> {
  return apiFetch("/api/batches/write-off-expired", { method: "POST" });
}

export async function fetchWarehouseLayout(): Promise<import("@shared/api").WarehouseCellLayout[]> {
  const r = await apiFetch<{ cells: import("@shared/api").WarehouseCellLayout[] }>(
    "/api/warehouse/layout"
  );
  return r.cells;
}

export async function saveWarehouseLayout(
  cells: {
    location: string;
    cell: string;
    posX: number;
    posY: number;
    width?: number;
    height?: number;
    zoneColor?: string;
  }[]
): Promise<void> {
  await apiFetch("/api/warehouse/layout", {
    method: "PUT",
    body: JSON.stringify({ cells }),
  });
}
