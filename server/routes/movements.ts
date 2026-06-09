import type { RequestHandler } from "express";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";
import type { StockMovement } from "@shared/api";

function mapMovement(row: {
  id: string | number;
  product_id: string | number;
  product_name: string;
  product_sku: string;
  delta: number;
  balance_after: number;
  reason: string;
  note: string | null;
  created_at: Date;
  user_name: string | null;
  shift_id: string | null;
}): StockMovement {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: row.product_name,
    productSku: row.product_sku,
    delta: row.delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    userName: row.user_name ?? undefined,
    shiftId: row.shift_id ?? undefined,
  };
}

export const listMovements: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500);
    const offset = parseInt(String(req.query.offset ?? "0"), 10);
    const productId = req.query.productId ? String(req.query.productId) : null;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (productId) {
      conditions.push(`m.product_id = $${i++}`);
      params.push(productId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT m.id, m.product_id, p.name AS product_name, p.sku AS product_sku,
              m.delta, m.balance_after, m.reason, m.note, m.created_at,
              u.display_name AS user_name, m.shift_id
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.user_id
       ${where}
       ORDER BY m.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM stock_movements m ${where}`,
      productId ? [productId] : []
    );

    res.json({
      movements: rows.map(mapMovement),
      total: countRows[0]?.total ?? 0,
    });
  },
];
