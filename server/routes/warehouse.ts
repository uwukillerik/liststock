import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { WarehouseCell, WarehouseCellEntry, WarehouseMapSummary } from "@shared/api";

export const getWarehouseMap: RequestHandler[] = [
  requireAuth,
  async (_req, res) => {
    const { rows } = await query<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      unit: string;
      category: string;
      location: string;
      cell: string;
      image_url: string | null;
    }>(
      `SELECT id, name, sku, quantity, unit, category, location, cell, image_url
       FROM products
       ORDER BY location, cell, name`
    );

    const zoneMap = new Map<string, Map<string, WarehouseCell>>();
    const unassigned: WarehouseCell[] = [];

    for (const p of rows) {
      const loc = (p.location ?? "").trim();
      const cell = (p.cell ?? "").trim();
      const item = {
        id: String(p.id),
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        unit: p.unit,
        category: p.category,
        imageUrl: p.image_url ?? undefined,
      };

      if (!loc && !cell) {
        let bucket = unassigned.find((u) => u.location === "—" && u.cell === "—");
        if (!bucket) {
          bucket = { location: "—", cell: "—", products: [], totalQuantity: 0 };
          unassigned.push(bucket);
        }
        bucket.products.push(item);
        bucket.totalQuantity += p.quantity;
        continue;
      }

      const zoneKey = loc || "Без зоны";
      const cellKey = cell || "—";

      if (!zoneMap.has(zoneKey)) zoneMap.set(zoneKey, new Map());
      const cells = zoneMap.get(zoneKey)!;
      if (!cells.has(cellKey)) {
        cells.set(cellKey, {
          location: zoneKey,
          cell: cellKey,
          products: [],
          totalQuantity: 0,
        });
      }
      const c = cells.get(cellKey)!;
      c.products.push(item);
      c.totalQuantity += p.quantity;
    }

    const { rows: layoutCells } = await query<{ location: string; cell: string }>(
      `SELECT DISTINCT trim(location) AS location, trim(cell) AS cell
       FROM warehouse_cell_layout
       WHERE trim(coalesce(location,'')) <> '' AND trim(coalesce(cell,'')) <> ''`
    );

    for (const lc of layoutCells) {
      const zoneKey = lc.location || "Без зоны";
      const cellKey = lc.cell || "—";
      if (!zoneMap.has(zoneKey)) zoneMap.set(zoneKey, new Map());
      const cells = zoneMap.get(zoneKey)!;
      if (!cells.has(cellKey)) {
        cells.set(cellKey, {
          location: zoneKey,
          cell: cellKey,
          products: [],
          totalQuantity: 0,
        });
      }
    }

    const zonesWithEmpty = Array.from(zoneMap.entries()).map(([name, cells]) => {
      const cellList = Array.from(cells.values()).sort((a, b) =>
        a.cell.localeCompare(b.cell, "ru")
      );
      return {
        name,
        cells: cellList,
        productCount: cellList.reduce((s, c) => s + c.products.length, 0),
        totalQuantity: cellList.reduce((s, c) => s + c.totalQuantity, 0),
      };
    });

    zonesWithEmpty.sort((a, b) => a.name.localeCompare(b.name, "ru"));

    const body: WarehouseMapSummary = { zones: zonesWithEmpty, unassigned };
    res.json(body);
  },
];

export const listWarehouseCells: RequestHandler[] = [
  requireAuth,
  async (_req, res) => {
    const { rows } = await query<{
      location: string;
      cell: string;
      product_count: number;
    }>(
      `SELECT location, cell, product_count FROM (
         SELECT trim(location) AS location, trim(cell) AS cell,
           (SELECT COUNT(*)::int FROM products p
            WHERE trim(coalesce(p.location,'')) = trim(c.location)
              AND trim(coalesce(p.cell,'')) = trim(c.cell)) AS product_count
         FROM (
           SELECT DISTINCT trim(location) AS location, trim(cell) AS cell
           FROM products
           WHERE trim(coalesce(location,'')) <> '' AND trim(coalesce(cell,'')) <> ''
           UNION
           SELECT trim(location) AS location, trim(cell) AS cell
           FROM warehouse_cell_layout
           WHERE trim(coalesce(location,'')) <> '' AND trim(coalesce(cell,'')) <> ''
         ) c
       ) x
       ORDER BY location, cell`
    );

    const cells: WarehouseCellEntry[] = rows.map((r) => ({
      location: r.location,
      cell: r.cell,
      productCount: r.product_count,
      isEmpty: r.product_count === 0,
    }));

    const locations = Array.from(new Set(cells.map((c) => c.location))).sort((a, b) =>
      a.localeCompare(b, "ru")
    );

    res.json({ cells, locations });
  },
];

const createCellBody = z.object({
  location: z.string().min(1).max(256),
  cell: z.string().min(1).max(256),
});

export const createWarehouseCell: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = createCellBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Укажите зону и номер ячейки" });
      return;
    }
    const location = parsed.data.location.trim();
    const cell = parsed.data.cell.trim();

    const { rows: existing } = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT 1 FROM warehouse_cell_layout WHERE trim(location) = $1 AND trim(cell) = $2
         UNION ALL
         SELECT 1 FROM products WHERE trim(coalesce(location,'')) = $1 AND trim(coalesce(cell,'')) = $2
       ) t`,
      [location, cell]
    );
    if (existing[0]?.n > 0) {
      res.status(409).json({ error: "Такая ячейка уже существует" });
      return;
    }

    const { rows: pos } = await query<{ max_y: number | null }>(
      `SELECT MAX(pos_y) AS max_y FROM warehouse_cell_layout`
    );
    const y = (pos[0]?.max_y ?? 0) + 90;

    await query(
      `INSERT INTO warehouse_cell_layout (location, cell, pos_x, pos_y)
       VALUES ($1, $2, 20, $3)
       ON CONFLICT (location, cell) DO NOTHING`,
      [location, cell, y]
    );

    res.status(201).json({
      cell: { location, cell, productCount: 0, isEmpty: true } satisfies WarehouseCellEntry,
    });
  },
];
