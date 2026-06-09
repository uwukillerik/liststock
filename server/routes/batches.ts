import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import type { ExpiryAlertItem, ProductBatch } from "@shared/api";

type BatchRow = {
  id: string;
  product_id: string | number;
  product_name?: string;
  product_sku?: string;
  unit?: string;
  location?: string;
  cell?: string;
  batch_code: string;
  quantity: number;
  expiry_date: Date;
  received_at: Date;
  note: string | null;
};

function mapBatch(row: BatchRow): ProductBatch {
  return {
    id: row.id,
    productId: String(row.product_id),
    productName: row.product_name,
    productSku: row.product_sku,
    unit: row.unit,
    location: row.location,
    cell: row.cell,
    batchCode: row.batch_code,
    quantity: row.quantity,
    expiryDate: row.expiry_date.toISOString().slice(0, 10),
    receivedAt: new Date(row.received_at).toISOString(),
    note: row.note ?? undefined,
  };
}

const BATCH_JOIN = `
  FROM product_batches b
  JOIN products p ON p.id = b.product_id
`;

function sqlExpiryStatus(): string {
  return `
    CASE
      WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN b.expiry_date = CURRENT_DATE THEN 'today'
      WHEN b.expiry_date = CURRENT_DATE + 1 THEN 'tomorrow'
      WHEN b.expiry_date <= CURRENT_DATE + 7 THEN 'week'
      WHEN b.expiry_date <= CURRENT_DATE + 30 THEN 'month'
      ELSE 'ok'
    END
  `;
}

export const listBatches: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const productId = req.query.productId ? String(req.query.productId) : null;
    const params: unknown[] = [];
    let where = "WHERE b.quantity > 0";
    if (productId) {
      where += " AND b.product_id = $1";
      params.push(productId);
    }
    const { rows } = await query<BatchRow>(
      `SELECT b.id, b.product_id, p.name AS product_name, p.sku AS product_sku, p.unit,
              p.location, p.cell, b.batch_code, b.quantity, b.expiry_date, b.received_at, b.note
       ${BATCH_JOIN} ${where}
       ORDER BY b.expiry_date ASC, p.name`,
      params
    );
    res.json({ batches: rows.map(mapBatch) });
  },
];

export const getExpiryAlerts: RequestHandler[] = [
  requireAuth,
  async (_req, res) => {
    const statusSql = sqlExpiryStatus();
    const { rows } = await query<
      BatchRow & { status: string; days_left: number }
    >(
      `SELECT b.id, b.product_id, p.name AS product_name, p.sku AS product_sku, p.unit,
              p.location, p.cell, b.batch_code, b.quantity, b.expiry_date, b.received_at, b.note,
              ${statusSql} AS status,
              (b.expiry_date - CURRENT_DATE)::int AS days_left
       ${BATCH_JOIN}
       WHERE b.quantity > 0 AND b.expiry_date <= CURRENT_DATE + 30
       ORDER BY b.expiry_date ASC, p.name`
    );

    const items: ExpiryAlertItem[] = rows.map((r) => ({
      id: r.id,
      productId: String(r.product_id),
      productName: r.product_name ?? "",
      productSku: r.product_sku ?? "",
      batchCode: r.batch_code,
      quantity: r.quantity,
      unit: r.unit ?? "шт",
      expiryDate: r.expiry_date.toISOString().slice(0, 10),
      status: r.status as ExpiryAlertItem["status"],
      location: r.location,
      cell: r.cell,
      daysLeft: r.days_left,
    }));

    const summary = {
      expired: items.filter((i) => i.status === "expired"),
      today: items.filter((i) => i.status === "today"),
      tomorrow: items.filter((i) => i.status === "tomorrow"),
      week: items.filter((i) => i.status === "week"),
      month: items.filter((i) => i.status === "month"),
      counts: {
        expired: items.filter((i) => i.status === "expired").length,
        today: items.filter((i) => i.status === "today").length,
        tomorrow: items.filter((i) => i.status === "tomorrow").length,
        week: items.filter((i) => i.status === "week").length,
        month: items.filter((i) => i.status === "month").length,
        total: items.length,
      },
    };

    res.json(summary);
  },
];

const batchBody = z.object({
  productId: z.string().min(1),
  batchCode: z.string().max(128).optional().default(""),
  quantity: z.coerce.number().int().min(1),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(512).optional(),
  addToStock: z.boolean().optional().default(true),
});

export const createBatch: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = batchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Проверьте партию и дату (ГГГГ-ММ-ДД)" });
      return;
    }
    const b = parsed.data;
    const { rows } = await query<BatchRow>(
      `INSERT INTO product_batches (product_id, batch_code, quantity, expiry_date, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, batch_code, quantity, expiry_date, received_at, note`,
      [b.productId, b.batchCode.trim(), b.quantity, b.expiryDate, b.note?.trim() || null]
    );
    if (b.addToStock) {
      await query(
        `UPDATE products SET quantity = quantity + $1, updated_at = now() WHERE id = $2`,
        [b.quantity, b.productId]
      );
    }
    const { rows: full } = await query<BatchRow>(
      `SELECT b.id, b.product_id, p.name AS product_name, p.sku AS product_sku, p.unit,
              p.location, p.cell, b.batch_code, b.quantity, b.expiry_date, b.received_at, b.note
       ${BATCH_JOIN} WHERE b.id = $1`,
      [rows[0].id]
    );
    res.status(201).json({ batch: mapBatch(full[0]) });
  },
];

const patchBatch = z.object({
  batchCode: z.string().max(128).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(512).nullable().optional(),
});

export const updateBatch: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = patchBatch.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const { rows: cur } = await query<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM product_batches WHERE id = $1`,
      [id]
    );
    if (!cur[0]) {
      res.status(404).json({ error: "Партия не найдена" });
      return;
    }
    const b = parsed.data;
    if (b.quantity !== undefined && b.quantity !== cur[0].quantity) {
      const delta = b.quantity - cur[0].quantity;
      await query(
        `UPDATE products SET quantity = GREATEST(0, quantity + $1), updated_at = now() WHERE id = $2`,
        [delta, cur[0].product_id]
      );
    }
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (b.batchCode !== undefined) {
      fields.push(`batch_code = $${i++}`);
      vals.push(b.batchCode.trim());
    }
    if (b.quantity !== undefined) {
      fields.push(`quantity = $${i++}`);
      vals.push(b.quantity);
    }
    if (b.expiryDate !== undefined) {
      fields.push(`expiry_date = $${i++}`);
      vals.push(b.expiryDate);
    }
    if (b.note !== undefined) {
      fields.push(`note = $${i++}`);
      vals.push(b.note?.trim() || null);
    }
    if (!fields.length) {
      res.status(400).json({ error: "Нет изменений" });
      return;
    }
    vals.push(id);
    await query(`UPDATE product_batches SET ${fields.join(", ")} WHERE id = $${i}`, vals);
    const { rows: full } = await query<BatchRow>(
      `SELECT b.id, b.product_id, p.name AS product_name, p.sku AS product_sku, p.unit,
              p.location, p.cell, b.batch_code, b.quantity, b.expiry_date, b.received_at, b.note
       ${BATCH_JOIN} WHERE b.id = $1`,
      [id]
    );
    res.json({ batch: mapBatch(full[0]) });
  },
];

export const deleteBatch: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const { rows: cur } = await query<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM product_batches WHERE id = $1`,
      [id]
    );
    if (!cur[0]) {
      res.status(404).json({ error: "Партия не найдена" });
      return;
    }
    await query(
      `UPDATE products SET quantity = GREATEST(0, quantity - $1), updated_at = now() WHERE id = $2`,
      [cur[0].quantity, cur[0].product_id]
    );
    await query(`DELETE FROM product_batches WHERE id = $1`, [id]);
    res.status(204).send();
  },
];

export const writeOffExpired: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { rows } = await query<{ id: string; product_id: string; quantity: number }>(
      `SELECT id, product_id, quantity FROM product_batches
       WHERE quantity > 0 AND expiry_date < CURRENT_DATE`
    );
    let count = 0;
    for (const b of rows) {
      await query(
        `UPDATE products SET quantity = GREATEST(0, quantity - $1), updated_at = now() WHERE id = $2`,
        [b.quantity, b.product_id]
      );
      await query(`UPDATE product_batches SET quantity = 0 WHERE id = $1`, [b.id]);
      count++;
    }
    res.json({ writtenOff: count });
  },
];
