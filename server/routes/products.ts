import type { RequestHandler } from "express";
import { z } from "zod";
import { query } from "../db";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { Product } from "@shared/api";

type ProductRow = {
  id: string | number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  cell: string;
  description: string | null;
  barcode: string | null;
  supplier: string | null;
  cost_price: string | null;
  sale_price: string | null;
  updated_at: Date;
  image_url: string | null;
  min_quantity: number | null;
  expiry_date: Date | null;
  nearest_batch_expiry?: string | null;
  batch_count?: number | null;
};

function mapProduct(row: ProductRow): Product {
  const nearest =
    row.nearest_batch_expiry?.slice(0, 10) ??
    row.expiry_date?.toISOString().slice(0, 10);
  return {
    id: String(row.id),
    name: row.name,
    sku: row.sku,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    cell: row.cell,
    description: row.description ?? undefined,
    barcode: row.barcode ?? undefined,
    supplier: row.supplier ?? undefined,
    costPrice: row.cost_price != null ? parseFloat(row.cost_price) : undefined,
    salePrice: row.sale_price != null ? parseFloat(row.sale_price) : undefined,
    imageUrl: row.image_url ?? undefined,
    minQuantity: row.min_quantity ?? undefined,
    expiryDate: row.expiry_date?.toISOString().slice(0, 10),
    nearestExpiry: nearest,
    batchCount: row.batch_count ?? undefined,
    lastUpdated: new Date(row.updated_at).toISOString(),
  };
}

const LIST_COLS = `p.id, p.name, p.sku, p.category, p.quantity, p.unit, p.location, p.cell,
  p.description, p.barcode, p.supplier, p.cost_price, p.sale_price, p.image_url, p.min_quantity, p.expiry_date, p.updated_at,
  (SELECT MIN(b.expiry_date)::text FROM product_batches b WHERE b.product_id = p.id AND b.quantity > 0) AS nearest_batch_expiry,
  (SELECT COUNT(*)::int FROM product_batches b WHERE b.product_id = p.id AND b.quantity > 0) AS batch_count`;

const RETURNING_COLS = `id, name, sku, category, quantity, unit, location, cell,
  description, barcode, supplier, cost_price, sale_price, image_url, min_quantity, expiry_date, updated_at`;

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
  auth?: { userId: string },
  note?: string | null,
  shiftId?: string | null
) {
  await query(
    `INSERT INTO stock_movements (product_id, delta, balance_after, reason, note, user_id, shift_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, delta, balanceAfter, reason, note ?? null, auth?.userId ?? null, shiftId ?? null]
  );
}

export const listProducts: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const cat = String(req.query.category ?? "").trim();
    const loc = String(req.query.location ?? "").trim();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (q) {
      conditions.push(
        `(lower(name) LIKE $${i} OR lower(sku) LIKE $${i} OR lower(coalesce(barcode,'')) LIKE $${i})`
      );
      params.push(`%${q.toLowerCase()}%`);
      i++;
    }
    if (cat) {
      conditions.push(`lower(category) = lower($${i})`);
      params.push(cat);
      i++;
    }
    if (loc) {
      conditions.push(`lower(location) LIKE lower($${i})`);
      params.push(`%${loc}%`);
      i++;
    }
    let sql = `SELECT ${LIST_COLS} FROM products p`;
    if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += ` ORDER BY p.updated_at DESC`;
    const { rows } = await query(sql, params);
    res.json({ products: rows.map(mapProduct) });
  },
];

const productBodySchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional().default(""),
  quantity: z.coerce.number().int().min(0).default(0),
  unit: z.string().min(1).default("шт"),
  location: z.string().optional().default(""),
  cell: z.string().optional().default(""),
  description: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  minQuantity: z.coerce.number().int().min(0).nullable().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  batchCode: z.string().max(128).optional().default(""),
});

export const createProduct: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = productBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Проверьте поля формы" });
      return;
    }
    const b = parsed.data;
    try {
      const { rows } = await query<ProductRow>(
        `INSERT INTO products (name, sku, category, quantity, unit, location, cell, description, barcode, supplier, cost_price, sale_price, image_url, min_quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING ${RETURNING_COLS}`,
        [
          b.name.trim(),
          b.sku.trim(),
          b.category.trim(),
          b.quantity,
          b.unit.trim(),
          b.location.trim(),
          b.cell.trim(),
          b.description?.trim() || null,
          b.barcode?.trim() || null,
          b.supplier?.trim() || null,
          b.costPrice ?? null,
          b.salePrice ?? null,
          b.imageUrl?.trim() || null,
          b.minQuantity ?? null,
        ]
      );
      const p = rows[0];
      if (b.quantity > 0) {
        const shiftId = await getOpenShiftId(req.auth!.userId);
        await logMovement(p.id, b.quantity, b.quantity, "initial", req.auth, null, shiftId);
      }
      if (b.expiryDate && b.quantity > 0) {
        await query(
          `INSERT INTO product_batches (product_id, batch_code, quantity, expiry_date)
           VALUES ($1, $2, $3, $4)`,
          [p.id, b.batchCode?.trim() || "", b.quantity, b.expiryDate]
        );
      }
      const { rows: withBatch } = await query<ProductRow>(
        `SELECT ${LIST_COLS} FROM products p WHERE p.id = $1`,
        [p.id]
      );
      res.status(201).json({ product: mapProduct(withBatch[0] ?? p) });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        res.status(409).json({ error: "Товар с таким SKU уже существует" });
        return;
      }
      throw e;
    }
  },
];

const patchBody = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  unit: z.string().min(1).optional(),
  location: z.string().optional(),
  cell: z.string().optional(),
  description: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  costPrice: z.coerce.number().min(0).nullable().optional(),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  minQuantity: z.coerce.number().int().min(0).nullable().optional(),
});

export const updateProduct: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const b = parsed.data;
    const { rows: currentRows } = await query<{ quantity: number }>(
      `SELECT quantity FROM products WHERE id = $1`,
      [id]
    );
    if (!currentRows[0]) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    const prevQty = currentRows[0].quantity;
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const addField = (col: string, val: unknown) => {
      fields.push(`${col} = $${i++}`);
      values.push(val);
    };

    if (b.name !== undefined) addField("name", b.name.trim());
    if (b.sku !== undefined) addField("sku", b.sku.trim());
    if (b.category !== undefined) addField("category", b.category.trim());
    if (b.quantity !== undefined) addField("quantity", b.quantity);
    if (b.unit !== undefined) addField("unit", b.unit.trim());
    if (b.location !== undefined) addField("location", b.location.trim());
    if (b.cell !== undefined) addField("cell", b.cell.trim());
    if (b.description !== undefined) addField("description", b.description?.trim() || null);
    if (b.barcode !== undefined) addField("barcode", b.barcode?.trim() || null);
    if (b.supplier !== undefined) addField("supplier", b.supplier?.trim() || null);
    if (b.costPrice !== undefined) addField("cost_price", b.costPrice);
    if (b.salePrice !== undefined) addField("sale_price", b.salePrice);
    if (b.imageUrl !== undefined) addField("image_url", b.imageUrl?.trim() || null);
    if (b.minQuantity !== undefined) addField("min_quantity", b.minQuantity);

    if (!fields.length) {
      res.status(400).json({ error: "Нет изменений" });
      return;
    }
    fields.push(`updated_at = now()`);
    values.push(id);
    try {
      const { rows } = await query<ProductRow>(
        `UPDATE products SET ${fields.join(", ")} WHERE id = $${i} RETURNING ${RETURNING_COLS}`,
        values
      );
      const p = rows[0];
      if (b.quantity !== undefined && b.quantity !== prevQty) {
        const shiftId = await getOpenShiftId(req.auth!.userId);
        await logMovement(id, b.quantity - prevQty, b.quantity, "adjustment", req.auth, null, shiftId);
      }
      res.json({ product: mapProduct(p) });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        res.status(409).json({ error: "Товар с таким SKU уже существует" });
        return;
      }
      throw e;
    }
  },
];

const adjustBody = z.object({
  delta: z.coerce.number().int(),
  reason: z.string().min(1).default("adjustment"),
  note: z.string().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  batchCode: z.string().max(128).optional(),
});

export const adjustProduct: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = adjustBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные" });
      return;
    }
    const { delta, reason, note, expiryDate, batchCode } = parsed.data;

    if (req.auth!.role === "worker") {
      const shiftId = await getOpenShiftId(req.auth!.userId);
      if (!shiftId) {
        res.status(403).json({ error: "Откройте смену перед операциями со складом" });
        return;
      }
    }

    const { rows: cur } = await query<{ quantity: number }>(
      `SELECT quantity FROM products WHERE id = $1`,
      [id]
    );
    if (!cur[0]) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    const newQty = cur[0].quantity + delta;
    if (newQty < 0) {
      res.status(400).json({ error: "Остаток не может быть отрицательным" });
      return;
    }
    const { rows } = await query<ProductRow>(
      `UPDATE products SET quantity = $1, updated_at = now() WHERE id = $2 RETURNING ${RETURNING_COLS}`,
      [newQty, id]
    );
    const shiftId = await getOpenShiftId(req.auth!.userId);
    await logMovement(id, delta, newQty, reason, req.auth, note ?? null, shiftId);

    if (delta > 0 && expiryDate) {
      await query(
        `INSERT INTO product_batches (product_id, batch_code, quantity, expiry_date, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, batchCode?.trim() || "", delta, expiryDate, note?.trim() || null]
      );
    }

    const { rows: full } = await query<ProductRow>(
      `SELECT ${LIST_COLS} FROM products p WHERE p.id = $1`,
      [id]
    );
    res.json({ product: mapProduct(full[0] ?? rows[0]) });
  },
];

export const deleteProduct: RequestHandler[] = [
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = String(req.params.id);
    const { rowCount } = await query(`DELETE FROM products WHERE id = $1`, [id]);
    if (!rowCount) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.status(204).send();
  },
];

const transferBody = z.object({
  toLocation: z.string().min(1).max(256),
  toCell: z.string().min(1).max(256),
  note: z.string().max(512).optional(),
});

export const transferProduct: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const id = String(req.params.id);
    const parsed = transferBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Укажите зону и ячейку назначения" });
      return;
    }

    if (req.auth!.role === "worker") {
      const shiftId = await getOpenShiftId(req.auth!.userId);
      if (!shiftId) {
        res.status(403).json({ error: "Откройте смену перед операциями со складом" });
        return;
      }
    }

    const { toLocation, toCell, note } = parsed.data;
    const { rows: cur } = await query<{ location: string; cell: string; quantity: number }>(
      `SELECT location, cell, quantity FROM products WHERE id = $1`,
      [id]
    );
    if (!cur[0]) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }

    const fromLoc = cur[0].location.trim();
    const fromCell = cur[0].cell.trim();
    const toLoc = toLocation.trim();
    const toC = toCell.trim();

    if (fromLoc === toLoc && fromCell === toC) {
      res.status(400).json({ error: "Ячейка назначения совпадает с текущей" });
      return;
    }

    const moveNote =
      note?.trim() ||
      `Из «${fromLoc || "—"}» / ${fromCell || "—"} → «${toLoc}» / ${toC}`;

    const shiftId = await getOpenShiftId(req.auth!.userId);
    const { rows } = await query<ProductRow>(
      `UPDATE products SET location = $1, cell = $2, updated_at = now()
       WHERE id = $3 RETURNING ${RETURNING_COLS}`,
      [toLoc, toC, id]
    );

    await logMovement(id, 0, cur[0].quantity, "transfer", req.auth, moveNote, shiftId);
    res.json({ product: mapProduct(rows[0]) });
  },
];
