import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAuth } from "../middleware/auth";
import type { Shift } from "@shared/api";

function mapShift(row: {
  id: string;
  user_id: string;
  user_name: string;
  username: string;
  started_at: Date;
  ended_at: Date | null;
  note: string | null;
  status: "open" | "closed";
  movement_count?: number;
}): Shift {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    username: row.username,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : undefined,
    note: row.note ?? undefined,
    status: row.status,
    movementCount: row.movement_count,
  };
}

const SHIFT_SELECT = `
  s.id, s.user_id, u.display_name AS user_name, u.username,
  s.started_at, s.ended_at, s.note, s.status
`;

export const getActiveShift: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const userId = req.auth!.userId;
    const { rows } = await query(
      `SELECT ${SHIFT_SELECT},
        (SELECT COUNT(*)::int FROM stock_movements m WHERE m.shift_id = s.id) AS movement_count
       FROM shifts s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1 AND s.status = 'open'
       LIMIT 1`,
      [userId]
    );
    res.json({ shift: rows[0] ? mapShift(rows[0] as Parameters<typeof mapShift>[0]) : null });
  },
];

export const listShifts: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const isAdmin = req.auth!.role === "admin";
    const userId = req.auth!.userId;

    const params: unknown[] = isAdmin ? [limit] : [userId, limit];
    const where = isAdmin ? "" : "WHERE s.user_id = $1";

    const { rows } = await query(
      `SELECT ${SHIFT_SELECT},
        (SELECT COUNT(*)::int FROM stock_movements m WHERE m.shift_id = s.id) AS movement_count
       FROM shifts s
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.started_at DESC
       LIMIT $${isAdmin ? 1 : 2}`,
      params
    );

    res.json({
      shifts: rows.map((r) => mapShift(r as Parameters<typeof mapShift>[0])),
    });
  },
];

const openBody = z.object({
  note: z.string().max(512).optional(),
});

export const openShift: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const parsed = openBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const userId = req.auth!.userId;

    const { rows: existing } = await query(
      `SELECT id FROM shifts WHERE user_id = $1 AND status = 'open'`,
      [userId]
    );
    if (existing.length) {
      res.status(409).json({ error: "Смена уже открыта" });
      return;
    }

    const { rows } = await query(
      `INSERT INTO shifts (user_id, note, status)
       VALUES ($1, $2, 'open')
       RETURNING id, user_id, started_at, ended_at, note, status`,
      [userId, parsed.data.note?.trim() || null]
    );
    const { rows: userRows } = await query<{ display_name: string; username: string }>(
      `SELECT display_name, username FROM users WHERE id = $1`,
      [userId]
    );
    const row = rows[0] as {
      id: string;
      user_id: string;
      started_at: Date;
      ended_at: Date | null;
      note: string | null;
      status: "open" | "closed";
    };
    res.status(201).json({
      shift: mapShift({
        ...row,
        user_name: userRows[0].display_name,
        username: userRows[0].username,
        movement_count: 0,
      }),
    });
  },
];

const closeBody = z.object({
  note: z.string().max(512).optional(),
});

export const closeShift: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const parsed = closeBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const userId = req.auth!.userId;
    const shiftId = req.params.id;
    const isAdmin = req.auth!.role === "admin";

    const { rows: cur } = await query<{ user_id: string; status: string }>(
      `SELECT user_id, status FROM shifts WHERE id = $1`,
      [shiftId]
    );
    if (!cur[0]) {
      res.status(404).json({ error: "Смена не найдена" });
      return;
    }
    if (cur[0].status !== "open") {
      res.status(400).json({ error: "Смена уже закрыта" });
      return;
    }
    if (!isAdmin && cur[0].user_id !== userId) {
      res.status(403).json({ error: "Недостаточно прав" });
      return;
    }

    const closeNote = parsed.data.note?.trim() || null;

    const { rows } = closeNote
      ? await query(
          `UPDATE shifts SET status = 'closed', ended_at = now(),
            note = coalesce(note || E'\\n', '') || $2::text
           WHERE id = $1
           RETURNING id, user_id, started_at, ended_at, note, status`,
          [shiftId, closeNote]
        )
      : await query(
          `UPDATE shifts SET status = 'closed', ended_at = now()
           WHERE id = $1
           RETURNING id, user_id, started_at, ended_at, note, status`,
          [shiftId]
        );
    const { rows: userRows } = await query<{ display_name: string; username: string }>(
      `SELECT display_name, username FROM users WHERE id = $1`,
      [cur[0].user_id]
    );
    const { rows: mc } = await query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM stock_movements WHERE shift_id = $1`,
      [shiftId]
    );
    const row = rows[0] as {
      id: string;
      user_id: string;
      started_at: Date;
      ended_at: Date | null;
      note: string | null;
      status: "open" | "closed";
    };
    res.json({
      shift: mapShift({
        ...row,
        user_name: userRows[0].display_name,
        username: userRows[0].username,
        movement_count: mc[0]?.c ?? 0,
      }),
    });
  },
];
