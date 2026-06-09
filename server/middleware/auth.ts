import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@shared/api";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

export function signToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; role: UserRole } {
  const decoded = jwt.verify(token, JWT_SECRET) as {
    sub: string;
    role: UserRole;
  };
  return { userId: decoded.sub, role: decoded.role };
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : null;
  if (!token) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Сессия недействительна. Войдите снова." });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.auth?.role !== "admin") {
    res.status(403).json({ error: "Недостаточно прав" });
    return;
  }
  next();
};
