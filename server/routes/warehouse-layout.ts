import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { WarehouseCellLayout } from "@shared/api";

function mapLayout(row: {
  id: string;
  location: string;
  cell: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  zone_color: string;
  product_count?: number;
}): WarehouseCellLayout {
  return {
    id: row.id,
    location: row.location,
    cell: row.cell,
    posX: row.pos_x,
    posY: row.pos_y,
    width: row.width,
    height: row.height,
    zoneColor: row.zone_color,
    productCount: row.product_count,
  };
}

export const getWarehouseLayout: RequestHandler[] = [
  requireAuth,
  async (_req, res) => {
    const { rows: layoutRows } = await query(
      `SELECT l.id, l.location, l.cell, l.pos_x, l.pos_y, l.width, l.height, l.zone_color,
        (SELECT COUNT(*)::int FROM products p
         WHERE trim(coalesce(p.location,'')) = trim(l.location)
           AND trim(coalesce(p.cell,'')) = trim(l.cell)) AS product_count
       FROM warehouse_cell_layout l
       ORDER BY l.location, l.cell`
    );

    if (layoutRows.length === 0) {
      const { rows: cells } = await query<{ location: string; cell: string }>(
        `SELECT DISTINCT trim(location) AS location, trim(cell) AS cell
         FROM products
         WHERE trim(coalesce(location,'')) <> '' AND trim(coalesce(cell,'')) <> ''
         ORDER BY location, cell`
      );
      let x = 20;
      let y = 20;
      const created: WarehouseCellLayout[] = [];
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (i > 0 && i % 5 === 0) {
          x = 20;
          y += 90;
        }
        const { rows: ins } = await query<{ id: string }>(
          `INSERT INTO warehouse_cell_layout (location, cell, pos_x, pos_y)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (location, cell) DO UPDATE SET location = EXCLUDED.location
           RETURNING id`,
          [c.location, c.cell, x, y]
        );
        const posX = x;
        x += 120;
        created.push({
          id: ins[0].id,
          location: c.location,
          cell: c.cell,
          posX,
          posY: y,
          width: 110,
          height: 72,
          zoneColor: "#0d7377",
        });
      }
      return res.json({ cells: created });
    }

    res.json({
      cells: layoutRows.map((r) => mapLayout(r as Parameters<typeof mapLayout>[0])),
    });
  },
];

const layoutPatch = z.object({
  cells: z.array(
    z.object({
      location: z.string(),
      cell: z.string(),
      posX: z.coerce.number().int(),
      posY: z.coerce.number().int(),
      width: z.coerce.number().int().min(60).max(300).optional(),
      height: z.coerce.number().int().min(40).max(200).optional(),
      zoneColor: z.string().max(32).optional(),
    })
  ),
});

export const saveWarehouseLayout: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = layoutPatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные координаты" });
      return;
    }
    for (const c of parsed.data.cells) {
      await query(
        `INSERT INTO warehouse_cell_layout (location, cell, pos_x, pos_y, width, height, zone_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (location, cell) DO UPDATE SET
           pos_x = EXCLUDED.pos_x,
           pos_y = EXCLUDED.pos_y,
           width = COALESCE(EXCLUDED.width, warehouse_cell_layout.width),
           height = COALESCE(EXCLUDED.height, warehouse_cell_layout.height),
           zone_color = COALESCE(EXCLUDED.zone_color, warehouse_cell_layout.zone_color)`,
        [
          c.location.trim(),
          c.cell.trim(),
          c.posX,
          c.posY,
          c.width ?? 110,
          c.height ?? 72,
          c.zoneColor ?? "#0d7377",
        ]
      );
    }
    res.json({ ok: true });
  },
];
