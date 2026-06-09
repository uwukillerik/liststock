import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS min_quantity INTEGER;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        batch_code VARCHAR(128) NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        expiry_date DATE NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_id);
      CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS warehouse_cell_layout (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        location VARCHAR(256) NOT NULL,
        cell VARCHAR(256) NOT NULL,
        pos_x INTEGER NOT NULL DEFAULT 0,
        pos_y INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 110,
        height INTEGER NOT NULL DEFAULT 72,
        zone_color VARCHAR(32) NOT NULL DEFAULT '#0d7377',
        UNIQUE (location, cell)
      );
    `);

    await client.query(`
      ALTER TABLE inventory_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(16) NOT NULL DEFAULT 'cell';
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shift_id UUID REFERENCES shifts(id),
        location VARCHAR(256) NOT NULL,
        cell VARCHAR(256) NOT NULL,
        session_type VARCHAR(16) NOT NULL DEFAULT 'cell',
        status VARCHAR(16) NOT NULL DEFAULT 'in_progress'
          CHECK (status IN ('in_progress', 'completed', 'cancelled')),
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        note TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        expected_qty INTEGER NOT NULL DEFAULT 0,
        counted_qty INTEGER,
        note TEXT,
        UNIQUE (session_id, product_id)
      );
    `);

    if (process.env.SEED_DEMO_BATCHES !== "0") {
      const { rows: demo } = await client.query<{ id: string; sku: string }>(
        `SELECT id, sku FROM products WHERE sku IN ('NAP-COLA-05', 'NAP-SOK-APL-1') LIMIT 2`
      );
      for (const p of demo) {
        const { rows: has } = await client.query(
          `SELECT 1 FROM product_batches WHERE product_id = $1 LIMIT 1`,
          [p.id]
        );
        if (has.length) continue;
        const days = p.sku.includes("COLA") ? -1 : p.sku.includes("SOK") ? 1 : 5;
        const exp = new Date();
        exp.setDate(exp.getDate() + days);
        const expStr = exp.toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO product_batches (product_id, batch_code, quantity, expiry_date, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            p.id,
            `DEMO-${p.sku}`,
            p.sku.includes("COLA") ? 18 : 40,
            expStr,
            "Демо-партия для проверки сроков",
          ]
        );
      }
    }

    console.log("Схема синхронизирована (партии, план, инвентаризация).");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
