import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";
import type { InventoryCountLine, InventoryCountSession } from "@shared/api";

async function getOpenShiftId(userId: string): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open' LIMIT 1`,
    [userId]
  );
  return rows[0]?.id ?? null;
}

async function logMovement(
  productId: string | number,
  delta: number,
  balanceAfter: number,
  reason: string,
  userId: string,
  note: string | null,
  shiftId: string | null
) {
  await query(
    `INSERT INTO stock_movements (product_id, delta, balance_after, reason, note, user_id, shift_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, delta, balanceAfter, reason, note, userId, shiftId]
  );
}

function mapSession(row: {
  id: string;
  user_id: string;
  user_name: string;
  location: string;
  cell: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  note: string | null;
  session_type?: string;
  line_count?: number;
  diff_count?: number;
}): InventoryCountSession {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    location: row.location,
    cell: row.cell,
    status: row.status as InventoryCountSession["status"],
    sessionType: (row.session_type as "cell" | "full") ?? "cell",
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    note: row.note ?? undefined,
    lineCount: row.line_count,
    diffCount: row.diff_count,
  };
}

const SESSION_SELECT = `
  s.id, s.user_id, u.display_name AS user_name, s.location, s.cell,
  s.status, s.started_at, s.completed_at, s.note, s.session_type
`;

const startBody = z.object({
  location: z.string().min(1).max(256),
  cell: z.string().min(1).max(256),
  note: z.string().max(512).optional(),
});

export const startInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const parsed = startBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Укажите зону и ячейку" });
      return;
    }

    if (req.auth!.role === "worker") {
      const sid = await getOpenShiftId(req.auth!.userId);
      if (!sid) {
        res.status(403).json({ error: "Откройте смену перед инвентаризацией" });
        return;
      }
    }

    const { location, cell, note } = parsed.data;
    const loc = location.trim();
    const c = cell.trim();
    const shiftId = await getOpenShiftId(req.auth!.userId);

    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM inventory_sessions
       WHERE user_id = $1 AND status = 'in_progress' LIMIT 1`,
      [req.auth!.userId]
    );
    if (existing[0]) {
      res.status(409).json({
        error: "У вас уже есть незавершённая инвентаризация",
        sessionId: existing[0].id,
      });
      return;
    }

    const { rows: sessionRows } = await query<{ id: string }>(
      `INSERT INTO inventory_sessions (user_id, shift_id, location, cell, note, status, session_type)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', 'cell')
       RETURNING id`,
      [req.auth!.userId, shiftId, loc, c, note?.trim() || null]
    );
    const sessionId = sessionRows[0].id;

    const { rows: products } = await query<{ id: string | number; quantity: number }>(
      `SELECT id, quantity FROM products
       WHERE trim(coalesce(location,'')) = $1 AND trim(coalesce(cell,'')) = $2`,
      [loc, c]
    );

    for (const p of products) {
      await query(
        `INSERT INTO inventory_lines (session_id, product_id, expected_qty)
         VALUES ($1, $2, $3)`,
        [sessionId, p.id, p.quantity]
      );
    }

    const { rows: full } = await query(
      `SELECT ${SESSION_SELECT},
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id) AS line_count,
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff_count
       FROM inventory_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId]
    );

    res.status(201).json({
      session: mapSession(full[0] as Parameters<typeof mapSession>[0]),
    });
  },
];

export const startMassInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    if (req.auth!.role === "worker") {
      const sid = await getOpenShiftId(req.auth!.userId);
      if (!sid) {
        res.status(403).json({ error: "Откройте смену перед инвентаризацией" });
        return;
      }
    }

    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const shiftId = await getOpenShiftId(req.auth!.userId);

    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM inventory_sessions WHERE user_id = $1 AND status = 'in_progress' LIMIT 1`,
      [req.auth!.userId]
    );
    if (existing[0]) {
      res.status(409).json({
        error: "У вас уже есть незавершённая инвентаризация",
        sessionId: existing[0].id,
      });
      return;
    }

    const { rows: sessionRows } = await query<{ id: string }>(
      `INSERT INTO inventory_sessions (user_id, shift_id, location, cell, note, status, session_type)
       VALUES ($1, $2, 'Весь склад', '*', $3, 'in_progress', 'full')
       RETURNING id`,
      [req.auth!.userId, shiftId, note]
    );
    const sessionId = sessionRows[0].id;

    const { rows: products } = await query<{ id: string | number; quantity: number }>(
      `SELECT id, quantity FROM products ORDER BY name`
    );

    for (const p of products) {
      await query(
        `INSERT INTO inventory_lines (session_id, product_id, expected_qty) VALUES ($1, $2, $3)`,
        [sessionId, p.id, p.quantity]
      );
    }

    const { rows: full } = await query(
      `SELECT ${SESSION_SELECT},
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id) AS line_count,
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff_count
       FROM inventory_sessions s
       JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [sessionId]
    );

    res.status(201).json({
      session: mapSession(full[0] as Parameters<typeof mapSession>[0]),
    });
  },
];

export const getActiveInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const { rows } = await query(
      `SELECT ${SESSION_SELECT},
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id) AS line_count,
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff_count
       FROM inventory_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1 AND s.status = 'in_progress'
       ORDER BY s.started_at DESC LIMIT 1`,
      [req.auth!.userId]
    );
    res.json({
      session: rows[0] ? mapSession(rows[0] as Parameters<typeof mapSession>[0]) : null,
    });
  },
];

export const getInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const sessionId = String(req.params.id);
    const { rows } = await query(
      `SELECT ${SESSION_SELECT},
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id) AS line_count,
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff_count
       FROM inventory_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Сессия не найдена" });
      return;
    }

    const { rows: lines } = await query(
      `SELECT l.id, l.product_id, p.name AS product_name, p.sku AS product_sku, p.unit,
              l.expected_qty, l.counted_qty, l.note
       FROM inventory_lines l
       JOIN products p ON p.id = l.product_id
       WHERE l.session_id = $1
       ORDER BY p.name`,
      [sessionId]
    );

    const mappedLines: InventoryCountLine[] = lines.map((l: {
      id: string;
      product_id: string | number;
      product_name: string;
      product_sku: string;
      unit: string;
      expected_qty: number;
      counted_qty: number | null;
      note: string | null;
    }) => ({
      id: l.id,
      productId: String(l.product_id),
      productName: l.product_name,
      productSku: l.product_sku,
      unit: l.unit,
      expectedQty: l.expected_qty,
      countedQty: l.counted_qty ?? undefined,
      note: l.note ?? undefined,
    }));

    res.json({
      session: mapSession(rows[0] as Parameters<typeof mapSession>[0]),
      lines: mappedLines,
    });
  },
];

const countLineBody = z.object({
  countedQty: z.coerce.number().int().min(0),
  note: z.string().max(256).optional(),
});

export const updateInventoryLine: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const sessionId = String(req.params.id);
    const productId = String(req.params.productId);
    const parsed = countLineBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректное количество" });
      return;
    }

    const { rows: sess } = await query<{ user_id: string; status: string }>(
      `SELECT user_id, status FROM inventory_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!sess[0]) {
      res.status(404).json({ error: "Сессия не найдена" });
      return;
    }
    if (sess[0].status !== "in_progress") {
      res.status(400).json({ error: "Инвентаризация уже завершена" });
      return;
    }
    if (sess[0].user_id !== req.auth!.userId && req.auth!.role !== "admin") {
      res.status(403).json({ error: "Недостаточно прав" });
      return;
    }

    const { rowCount } = await query(
      `UPDATE inventory_lines SET counted_qty = $1, note = $2
       WHERE session_id = $3 AND product_id = $4`,
      [parsed.data.countedQty, parsed.data.note?.trim() || null, sessionId, productId]
    );
    if (!rowCount) {
      res.status(404).json({ error: "Строка не найдена" });
      return;
    }

    res.json({ ok: true });
  },
];

export const completeInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const sessionId = String(req.params.id);
    const { rows: sess } = await query<{
      user_id: string;
      status: string;
      location: string;
      cell: string;
      shift_id: string | null;
      session_type: string;
    }>(`SELECT user_id, status, location, cell, shift_id, session_type FROM inventory_sessions WHERE id = $1`, [
      sessionId,
    ]);
    if (!sess[0]) {
      res.status(404).json({ error: "Сессия не найдена" });
      return;
    }
    if (sess[0].status !== "in_progress") {
      res.status(400).json({ error: "Сессия уже завершена" });
      return;
    }
    if (sess[0].user_id !== req.auth!.userId && req.auth!.role !== "admin") {
      res.status(403).json({ error: "Недостаточно прав" });
      return;
    }

    const { rows: lines } = await query<{
      product_id: string | number;
      expected_qty: number;
      counted_qty: number | null;
    }>(
      `SELECT product_id, expected_qty, counted_qty FROM inventory_lines WHERE session_id = $1`,
      [sessionId]
    );

    const uncounted = lines.filter((l) => l.counted_qty === null);
    if (uncounted.length > 0) {
      for (const line of uncounted) {
        await query(
          `UPDATE inventory_lines SET counted_qty = expected_qty WHERE session_id = $1 AND product_id = $2`,
          [sessionId, line.product_id]
        );
        line.counted_qty = line.expected_qty;
      }
    }

    const shiftId = sess[0].shift_id ?? (await getOpenShiftId(req.auth!.userId));
    let adjusted = 0;

    for (const line of lines) {
      const counted = line.counted_qty!;
      if (counted === line.expected_qty) continue;
      const delta = counted - line.expected_qty;
      const { rows: upd } = await query<{ quantity: number }>(
        `UPDATE products SET quantity = $1, updated_at = now() WHERE id = $2 RETURNING quantity`,
        [counted, line.product_id]
      );
      await logMovement(
        line.product_id,
        delta,
        upd[0].quantity,
        "inventory",
        req.auth!.userId,
        `Инвентаризация ${sess[0].session_type === "full" ? "всего склада" : `ячейки ${sess[0].cell} (${sess[0].location})`}`,
        shiftId
      );
      adjusted++;
    }

    await query(
      `UPDATE inventory_sessions SET status = 'completed', completed_at = now() WHERE id = $1`,
      [sessionId]
    );

    res.json({ ok: true, adjusted, total: lines.length });
  },
];

export const cancelInventorySession: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const sessionId = String(req.params.id);
    const { rows: sess } = await query<{ user_id: string; status: string }>(
      `SELECT user_id, status FROM inventory_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!sess[0]) {
      res.status(404).json({ error: "Сессия не найдена" });
      return;
    }
    if (sess[0].status !== "in_progress") {
      res.status(400).json({ error: "Сессия уже завершена" });
      return;
    }
    if (sess[0].user_id !== req.auth!.userId && req.auth!.role !== "admin") {
      res.status(403).json({ error: "Недостаточно прав" });
      return;
    }
    await query(
      `UPDATE inventory_sessions SET status = 'cancelled', completed_at = now() WHERE id = $1`,
      [sessionId]
    );
    res.json({ ok: true });
  },
];

export const listInventorySessions: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const isAdmin = req.auth!.role === "admin";
    const params = isAdmin ? [] : [req.auth!.userId];
    const where = isAdmin ? "" : "WHERE s.user_id = $1";

    const { rows } = await query(
      `SELECT ${SESSION_SELECT},
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id) AS line_count,
        (SELECT COUNT(*)::int FROM inventory_lines WHERE session_id = s.id AND counted_qty IS NOT NULL AND counted_qty <> expected_qty) AS diff_count
       FROM inventory_sessions s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.started_at DESC
       LIMIT 30`,
      params
    );

    res.json({
      sessions: rows.map((r) => mapSession(r as Parameters<typeof mapSession>[0])),
    });
  },
];
