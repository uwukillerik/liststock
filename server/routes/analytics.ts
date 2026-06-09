import type { RequestHandler } from "express";
import { query } from "../db";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { AnalyticsSummary } from "@shared/api";

export const getAnalytics: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { rows: prodRows } = await query<{
      n: string;
      cnt: string;
      qty: string;
    }>(
      `SELECT category AS n, COUNT(*)::text AS cnt, COALESCE(SUM(quantity),0)::text AS qty
       FROM products GROUP BY category ORDER BY category`
    );

    const { rows: locRows } = await query<{
      n: string;
      kinds: string;
      qty: string;
    }>(
      `SELECT location AS n, COUNT(*)::text AS kinds, COALESCE(SUM(quantity),0)::text AS qty
       FROM products GROUP BY location ORDER BY location`
    );

    const { rows: stockRows } = await query<{ level: string; c: string }>(
      `SELECT
         CASE
           WHEN quantity > 50 THEN 'ok'
           WHEN quantity >= 10 THEN 'low'
           ELSE 'critical'
         END AS level,
         COUNT(*)::text AS c
       FROM products
       GROUP BY 1`
    );

    const { rows: moveRows } = await query<{
      product_id: string | number;
      name: string;
      activity: string;
    }>(
      `SELECT p.id AS product_id, p.name, COALESCE(SUM(ABS(m.delta)),0)::text AS activity
       FROM products p
       LEFT JOIN stock_movements m ON m.product_id = p.id AND m.created_at > now() - interval '30 days'
       GROUP BY p.id, p.name
       ORDER BY COALESCE(SUM(ABS(m.delta)),0) DESC NULLS LAST
       LIMIT 10`
    );

    const { rows: totalRow } = await query<{
      total_kinds: string;
      total_units: string;
      stock_value: string;
    }>(
      `SELECT COUNT(*)::text AS total_kinds,
              COALESCE(SUM(quantity),0)::text AS total_units,
              COALESCE(SUM(quantity * COALESCE(cost_price,0)),0)::text AS stock_value
       FROM products`
    );

    const summary: AnalyticsSummary = {
      categories: prodRows.map((r) => ({
        name: r.n || "Без категории",
        count: Number(r.cnt),
        quantity: Number(r.qty),
      })),
      locations: locRows.map((r) => ({
        name: r.n || "Не указано",
        kinds: Number(r.kinds),
        quantity: Number(r.qty),
      })),
      stockLevels: {
        ok: Number(stockRows.find((s) => s.level === "ok")?.c ?? 0),
        low: Number(stockRows.find((s) => s.level === "low")?.c ?? 0),
        critical: Number(stockRows.find((s) => s.level === "critical")?.c ?? 0),
      },
      movementActivity: moveRows.map((r) => ({
        productId: String(r.product_id),
        name: r.name,
        unitsMoved: Number(r.activity),
      })),
      totals: {
        kinds: Number(totalRow[0]?.total_kinds ?? 0),
        units: Number(totalRow[0]?.total_units ?? 0),
        stockValue: parseFloat(totalRow[0]?.stock_value ?? "0"),
      },
    };

    res.json(summary);
  },
];
