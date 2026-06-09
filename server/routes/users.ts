import type { RequestHandler } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query } from "../db";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { UserManagementEntry } from "@shared/api";

function mapUser(row: {
  id: string;
  username: string;
  display_name: string;
  role: string;
  created_at: Date;
}): UserManagementEntry {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as "admin" | "worker",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export const listUsers: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    const { rows } = await query<{ id: string; username: string; display_name: string; role: string; created_at: Date }>(
      `SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at`
    );
    res.json({ users: rows.map(mapUser) });
  },
];

const createUserBody = z.object({
  username: z.string().min(2).max(64),
  displayName: z.string().min(1).max(128),
  password: z.string().min(4),
  role: z.enum(["admin", "worker"]).default("worker"),
});

export const createUser: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = createUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Проверьте поля формы" });
      return;
    }
    const b = parsed.data;
    const hash = bcrypt.hashSync(b.password, 10);
    try {
      const { rows } = await query<{ id: string; username: string; display_name: string; role: string; created_at: Date }>(
        `INSERT INTO users (username, password_hash, display_name, role)
         VALUES (lower($1), $2, $3, $4)
         RETURNING id, username, display_name, role, created_at`,
        [b.username.trim(), hash, b.displayName.trim(), b.role]
      );
      res.status(201).json({ user: mapUser(rows[0]) });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        res.status(409).json({ error: "Пользователь с таким логином уже существует" });
        return;
      }
      throw e;
    }
  },
];

const patchUserBody = z.object({
  displayName: z.string().min(1).max(128).optional(),
  role: z.enum(["admin", "worker"]).optional(),
  password: z.string().min(4).optional(),
});

export const updateUser: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = req.params.id;
    const parsed = patchUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const b = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (b.displayName !== undefined) {
      fields.push(`display_name = $${i++}`);
      values.push(b.displayName.trim());
    }
    if (b.role !== undefined) {
      fields.push(`role = $${i++}`);
      values.push(b.role);
    }
    if (b.password !== undefined) {
      fields.push(`password_hash = $${i++}`);
      values.push(bcrypt.hashSync(b.password, 10));
    }
    if (!fields.length) {
      res.status(400).json({ error: "Нет изменений" });
      return;
    }
    values.push(id);
    const { rows } = await query<{ id: string; username: string; display_name: string; role: string; created_at: Date }>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING id, username, display_name, role, created_at`,
      values
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    res.json({ user: mapUser(rows[0]) });
  },
];

export const deleteUser: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = req.params.id;
    const selfId = req.auth?.userId;
    if (id === selfId) {
      res.status(400).json({ error: "Нельзя удалить свой аккаунт" });
      return;
    }
    const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
    if (!rowCount) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    res.status(204).send();
  },
];

const changeOwnPasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

export const changeOwnPassword: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const selfId = req.auth?.userId;
    const parsed = changeOwnPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Проверьте поля" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    const { rows } = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [selfId]
    );
    if (!rows[0] || !bcrypt.compareSync(currentPassword, rows[0].password_hash)) {
      res.status(400).json({ error: "Неверный текущий пароль" });
      return;
    }
    await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [bcrypt.hashSync(newPassword, 10), selfId]
    );
    res.json({ ok: true });
  },
];
