import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function splitConnectionUrl(conn: string): { adminUrl: string; dbName: string } {
  const q = conn.indexOf("?");
  const query = q >= 0 ? conn.slice(q) : "";
  const noQuery = q >= 0 ? conn.slice(0, q) : conn;
  const i = noQuery.lastIndexOf("/");
  if (i < 0) throw new Error("Некорректный DATABASE_URL: нет имени базы");
  const dbName = noQuery.slice(i + 1);
  if (!dbName) throw new Error("Укажите имя базы в DATABASE_URL");
  const adminUrl = noQuery.slice(0, i + 1) + "postgres" + query;
  return { adminUrl, dbName };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Дополняет старую таблицу users колонками под текущее приложение (логин, хеш пароля, роль). */
async function syncUsersColumns(client: pg.Client) {
  const { rows: exists } = await client.query<{ e: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS e`
  );
  if (!exists[0]?.e) {
    return;
  }

  const { rows: colRows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  const before = new Set(colRows.map((r) => r.column_name));

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(128);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  `);

  await client.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  `);

  if (before.has("email")) {
    await client.query(`
      UPDATE users SET username = lower(trim(email))
      WHERE (username IS NULL OR trim(username) = '') AND email IS NOT NULL AND trim(email::text) <> '';
    `);
  }
  if (before.has("login")) {
    await client.query(`
      UPDATE users SET username = lower(trim(login::text))
      WHERE (username IS NULL OR trim(username) = '') AND login IS NOT NULL AND trim(login::text) <> '';
    `);
  }
  if (before.has("name")) {
    await client.query(`
      UPDATE users SET display_name = trim(name::text)
      WHERE (display_name IS NULL OR trim(display_name) = '') AND name IS NOT NULL AND trim(name::text) <> '';
    `);
  }

  await client.query(`
    UPDATE users SET username = 'user-' || replace(id::text, '-', '')
    WHERE username IS NULL OR trim(username) = '';
  `);

  await client.query(`
    UPDATE users SET username = left(trim(username), 64) WHERE length(trim(username)) > 64;
  `);

  await client.query(`
    UPDATE users SET display_name = trim(username)
    WHERE display_name IS NULL OR trim(display_name) = '';
  `);

  const { rows: needPwd } = await client.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM users WHERE password_hash IS NULL OR trim(password_hash) = ''`
  );
  if (needPwd[0].c > 0) {
    const temp =
      process.env.SEED_MIGRATION_PASSWORD ??
      process.env.SEED_ADMIN_PASSWORD ??
      "ScladAdmin!";
    const hash = bcrypt.hashSync(temp, 10);
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE password_hash IS NULL OR trim(password_hash) = ''`,
      [hash]
    );
    console.log(
      `ВНИМАНИЕ: для ${needPwd[0].c} учётной записи без пароля установлен временный пароль (войдите и смените): ${temp}`
    );
  }

  await client.query(`
    UPDATE users SET role = CASE lower(trim(role))
      WHEN 'admin' THEN 'admin'
      WHEN 'administrator' THEN 'admin'
      WHEN 'storekeeper' THEN 'worker'
      WHEN 'klad' THEN 'worker'
      WHEN 'кладовщик' THEN 'worker'
      WHEN 'worker' THEN 'worker'
      ELSE 'worker'
    END
    WHERE role IS NOT NULL AND trim(role) <> '';
  `);
  await client.query(`
    UPDATE users SET role = 'worker'
    WHERE role IS NULL OR trim(role) = '';
  `);
  await client.query(`
    UPDATE users u SET role = 'admin'
    FROM (
      SELECT id FROM users ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1
    ) first
    WHERE u.id = first.id
      AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin');
  `);

  await client.query(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'worker'));
  `);

  await client.query(`
    WITH ranked AS (
      SELECT id, username, row_number() OVER (PARTITION BY lower(trim(username)) ORDER BY created_at, id) AS rn
      FROM users
    )
    UPDATE users u SET username = left(trim(u.username) || '-' || substring(replace(u.id::text, '-', ''), 1, 8), 64)
    FROM ranked r
    WHERE u.id = r.id AND r.rn > 1;
  `);

  await client.query(`
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
    ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
    ALTER TABLE users ALTER COLUMN role SET NOT NULL;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (lower(trim(username)));
  `);

  console.log("Схема таблицы users проверена и при необходимости дополнена.");
}

/** Дополняет старую таблицу products недостающими колонками (без удаления данных). */
async function syncProductsColumns(client: pg.Client) {
  const { rows } = await client.query<{ e: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'products'
    ) AS e`
  );
  if (!rows[0]?.e) {
    return;
  }

  await client.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(128);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(256) NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(64) NOT NULL DEFAULT 'шт';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(256) NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cell VARCHAR(64) NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(128);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier VARCHAR(256);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await client.query(`
    UPDATE products SET sku = 'SKU-' || id::text WHERE sku IS NULL OR trim(sku) = '';
  `);

  await client.query(`
    ALTER TABLE products ALTER COLUMN sku SET NOT NULL;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS products_sku_uq ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(lower(name));
  `);

  console.log("Схема таблицы products проверена и при необходимости дополнена.");
}

async function ensureStockMovements(client: pg.Client) {
  const { rows: exists } = await client.query<{ e: boolean }>(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'stock_movements'
    ) AS e`
  );

  if (exists[0]?.e) {
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT`);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ,
        note TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
      );
    `);
    await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id)`);
    console.log("Таблица stock_movements уже есть — дополнены колонки.");
    return;
  }

  const { rows } = await client.query<{ data_type: string }>(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'products'
       AND column_name = 'id'`
  );

  const col = rows[0];
  if (!col) {
    console.warn(
      "Таблица products не найдена после миграции — пропуск stock_movements."
    );
    return;
  }

  const t = col.data_type;
  let sql: string;

  if (t === "uuid") {
    sql = `
      CREATE TABLE stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  } else if (t === "bigint" || t === "integer" || t === "smallint") {
    const refType = t === "bigint" ? "BIGINT" : "INTEGER";
    sql = `
      CREATE TABLE stock_movements (
        id BIGSERIAL PRIMARY KEY,
        product_id ${refType} NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  } else {
    throw new Error(
      `Неподдерживаемый тип products.id: ${t}. Обратитесь к разработчику или пересоздайте таблицу products.`
    );
  }

  await client.query(sql);
  await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS note TEXT`);
  await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ,
      note TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_user ON shifts (user_id) WHERE status = 'open';
  `);
  await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id)`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id)`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at DESC)`
  );
  console.log(`Таблица stock_movements создана (тип связи с products.id: ${t}).`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Задайте DATABASE_URL в .env (см. .env.example).");
    process.exit(1);
  }

  const { adminUrl, dbName } = splitConnectionUrl(databaseUrl);
  console.log(`Проверка базы «${dbName}»…`);

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (!rows.length) {
      await admin.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
      console.log(`Создана база данных «${dbName}».`);
    } else {
      console.log(`База «${dbName}» уже существует.`);
    }
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const migrationPath = join(
      __dirname,
      "..",
      "server",
      "migrations",
      "001_init.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");
    await client.query(sql);
    console.log("Миграции применены (001_init.sql).");

    await syncUsersColumns(client);
    await syncProductsColumns(client);
    await ensureStockMovements(client);
    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ,
        note TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_user ON shifts (user_id) WHERE status = 'open';
    `);

    const { rows: userCount } = await client.query(
      `SELECT COUNT(*)::int AS c FROM users`
    );
    if (userCount[0].c === 0) {
      const adminPass =
        process.env.SEED_ADMIN_PASSWORD ?? "ScladAdmin!";
      const workerPass =
        process.env.SEED_WORKER_PASSWORD ?? "ScladWorker!";
      const hashAdmin = bcrypt.hashSync(adminPass, 10);
      const hashWorker = bcrypt.hashSync(workerPass, 10);
      await client.query(
        `INSERT INTO users (username, password_hash, display_name, role) VALUES
         ('admin', $1, 'Администратор', 'admin'),
         ('klad', $2, 'Кладовщик', 'worker')`,
        [hashAdmin, hashWorker]
      );
      console.log("");
      console.log("Созданы учётные записи:");
      console.log(`  Администратор — логин: admin   пароль: ${adminPass}`);
      console.log(`  Кладовщик     — логин: klad   пароль: ${workerPass}`);
      console.log(
        "Смените пароли через SQL или задайте SEED_ADMIN_PASSWORD / SEED_WORKER_PASSWORD при первом запуске."
      );
      console.log("");
    } else {
      console.log("Пользователи уже есть, пропуск создания учёток.");
    }

    const { rows: prodCount } = await client.query(
      `SELECT COUNT(*)::int AS c FROM products`
    );
    if (prodCount[0].c === 0 && process.env.SEED_DEMO_PRODUCTS !== "0") {
      const demo = [
        {
          name: "Вода питьевая 0,5 л ПЭТ",
          sku: "NAP-VOD-05",
          category: "Вода питьевая",
          quantity: 240,
          unit: "бут",
          location: "Холодильник",
          cell: "А-01-12",
          description: "Негазированная",
        },
        {
          name: "Сок яблочный 1 л тетрапак",
          sku: "NAP-SOK-APL-1",
          category: "Соки и нектары",
          quantity: 96,
          unit: "ящик",
          location: "Сухой склад",
          cell: "Б-04-02",
          description: null,
        },
        {
          name: "Кола 0,5 л ж/б",
          sku: "NAP-COLA-05",
          category: "Газировка",
          quantity: 18,
          unit: "ящик",
          location: "Холодильник Х-2",
          cell: "Х-12-03",
          description: "Мало остатка для демо",
        },
      ];
      for (const d of demo) {
        const { rows: ins } = await client.query<{ id: string | number }>(
          `INSERT INTO products (name, sku, category, quantity, unit, location, cell, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            d.name,
            d.sku,
            d.category,
            d.quantity,
            d.unit,
            d.location,
            d.cell,
            d.description,
          ]
        );
        const id = ins[0].id;
        await client.query(
          `INSERT INTO stock_movements (product_id, delta, balance_after, reason)
           VALUES ($1, $2, $3, 'initial')`,
          [id, d.quantity, d.quantity]
        );
      }
      console.log("Добавлены демонстрационные товары (отключите: SEED_DEMO_PRODUCTS=0).");
    }
  } finally {
    await client.end();
  }

  console.log("Готово.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
