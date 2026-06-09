import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleMe } from "./routes/auth";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProduct,
  transferProduct,
} from "./routes/products";
import { getAnalytics } from "./routes/analytics";
import { listMovements } from "./routes/movements";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  changeOwnPassword,
} from "./routes/users";
import {
  getActiveShift,
  listShifts,
  openShift,
  closeShift,
} from "./routes/shifts";
import { getWarehouseMap, listWarehouseCells, createWarehouseCell } from "./routes/warehouse";
import {
  startInventorySession,
  startMassInventorySession,
  getActiveInventorySession,
  getInventorySession,
  updateInventoryLine,
  completeInventorySession,
  cancelInventorySession,
  listInventorySessions,
} from "./routes/inventory-count";
import {
  listBatches,
  getExpiryAlerts,
  createBatch,
  updateBatch,
  deleteBatch,
  writeOffExpired,
} from "./routes/batches";
import { getWarehouseLayout, saveWarehouseLayout } from "./routes/warehouse-layout";

export function createServer() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ok";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/me", ...handleMe);
  app.post("/api/auth/change-password", ...changeOwnPassword);

  app.get("/api/products", ...listProducts);
  app.post("/api/products", ...createProduct);
  app.patch("/api/products/:id", ...updateProduct);
  app.post("/api/products/:id/adjust", ...adjustProduct);
  app.post("/api/products/:id/transfer", ...transferProduct);
  app.delete("/api/products/:id", ...deleteProduct);

  app.get("/api/analytics", ...getAnalytics);
  app.get("/api/movements", ...listMovements);

  app.get("/api/users", ...listUsers);
  app.post("/api/users", ...createUser);
  app.patch("/api/users/:id", ...updateUser);
  app.delete("/api/users/:id", ...deleteUser);

  app.get("/api/shifts/active", ...getActiveShift);
  app.get("/api/shifts", ...listShifts);
  app.post("/api/shifts/open", ...openShift);
  app.post("/api/shifts/:id/close", ...closeShift);

  app.get("/api/warehouse/map", ...getWarehouseMap);
  app.get("/api/warehouse/cells", ...listWarehouseCells);
  app.post("/api/warehouse/cells", ...createWarehouseCell);
  app.get("/api/warehouse/layout", ...getWarehouseLayout);
  app.put("/api/warehouse/layout", ...saveWarehouseLayout);

  app.get("/api/batches", ...listBatches);
  app.get("/api/batches/expiry-alerts", ...getExpiryAlerts);
  app.post("/api/batches", ...createBatch);
  app.patch("/api/batches/:id", ...updateBatch);
  app.delete("/api/batches/:id", ...deleteBatch);
  app.post("/api/batches/write-off-expired", ...writeOffExpired);

  app.get("/api/inventory/sessions", ...listInventorySessions);
  app.get("/api/inventory/sessions/active", ...getActiveInventorySession);
  app.post("/api/inventory/sessions/mass", ...startMassInventorySession);
  app.post("/api/inventory/sessions", ...startInventorySession);
  app.get("/api/inventory/sessions/:id", ...getInventorySession);
  app.patch("/api/inventory/sessions/:id/lines/:productId", ...updateInventoryLine);
  app.post("/api/inventory/sessions/:id/complete", ...completeInventorySession);
  app.post("/api/inventory/sessions/:id/cancel", ...cancelInventorySession);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return app;
}
