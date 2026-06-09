export type UserRole = "admin" | "worker";

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  cell: string;
  lastUpdated: string;
  description?: string;
  barcode?: string;
  supplier?: string;
  costPrice?: number;
  salePrice?: number;
  imageUrl?: string;
  minQuantity?: number;
  expiryDate?: string;
  nearestExpiry?: string;
  batchCount?: number;
}

export interface ProductBatch {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  unit?: string;
  location?: string;
  cell?: string;
  batchCode: string;
  quantity: number;
  expiryDate: string;
  receivedAt: string;
  note?: string;
}

export type ExpiryAlertStatus = "expired" | "today" | "tomorrow" | "week" | "month" | "ok";

export interface ExpiryAlertItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  batchCode: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  status: ExpiryAlertStatus;
  location?: string;
  cell?: string;
  daysLeft: number;
}

export interface ExpiryAlertsSummary {
  expired: ExpiryAlertItem[];
  today: ExpiryAlertItem[];
  tomorrow: ExpiryAlertItem[];
  week: ExpiryAlertItem[];
  month: ExpiryAlertItem[];
  counts: {
    expired: number;
    today: number;
    tomorrow: number;
    week: number;
    month: number;
    total: number;
  };
}

export interface WarehouseCellLayout {
  id: string;
  location: string;
  cell: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  zoneColor: string;
  productCount?: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  note?: string;
  createdAt: string;
  userName?: string;
  shiftId?: string;
}

export interface WarehouseCell {
  location: string;
  cell: string;
  products: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    category: string;
    imageUrl?: string;
  }[];
  totalQuantity: number;
}

export interface WarehouseCellEntry {
  location: string;
  cell: string;
  productCount?: number;
  isEmpty?: boolean;
}

export interface WarehouseMapSummary {
  zones: {
    name: string;
    cells: WarehouseCell[];
    productCount: number;
    totalQuantity: number;
  }[];
  unassigned: WarehouseCell[];
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  username: string;
  startedAt: string;
  endedAt?: string;
  note?: string;
  status: "open" | "closed";
  movementCount?: number;
}

export interface InventoryCountSession {
  id: string;
  userId: string;
  userName: string;
  location: string;
  cell: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  note?: string;
  lineCount?: number;
  diffCount?: number;
  sessionType?: "cell" | "full";
}

export interface InventoryCountLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  expectedQty: number;
  countedQty?: number;
  note?: string;
}

export interface AnalyticsSummary {
  categories: { name: string; count: number; quantity: number }[];
  locations: { name: string; kinds: number; quantity: number }[];
  stockLevels: { ok: number; low: number; critical: number };
  movementActivity: {
    productId: string;
    name: string;
    unitsMoved: number;
  }[];
  totals: { kinds: number; units: number; stockValue: number };
}

export interface UserManagementEntry {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface DemoResponse {
  message: string;
}
