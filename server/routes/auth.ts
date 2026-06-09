import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db";
import { requireAuth, signToken } from "../middleware/auth";
import type { AuthResponse, User } from "@shared/api";

const loginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const handleLogin: RequestHandler = async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Укажите логин и пароль" });
    return;
  }
  const { username, password } = parsed.data;
  const { rows } = await query<{
    id: string;
    username: string;
    display_name: string;
    role: User["role"];
    password_hash: string;
  }>(
    `SELECT id, username, display_name, role, password_hash FROM users WHERE lower(username) = lower($1)`,
    [username.trim()]
  );
  const row = rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }
  const user: User = {
    id: row.id,
    name: row.display_name,
    role: row.role,
    username: row.username,
  };
  const token = signToken(row.id, row.role);
  const body: AuthResponse = { token, user };
  res.json(body);
};

export const handleMe: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const { rows } = await query<{
      id: string;
      username: string;
      display_name: string;
      role: User["role"];
    }>(
      `SELECT id, username, display_name, role FROM users WHERE id = $1`,
      [req.auth!.userId]
    );
    const row = rows[0];
    if (!row) {
      res.status(401).json({ error: "Пользователь не найден" });
      return;
    }
    const user: User = {
      id: row.id,
      name: row.display_name,
      role: row.role,
      username: row.username,
    };
    res.json({ user });
  },
];
