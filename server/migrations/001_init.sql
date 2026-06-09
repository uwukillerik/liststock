CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  sku VARCHAR(128) UNIQUE NOT NULL,
  category VARCHAR(256) NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit VARCHAR(64) NOT NULL DEFAULT 'шт',
  location VARCHAR(256) NOT NULL DEFAULT '',
  cell VARCHAR(64) NOT NULL DEFAULT '',
  description TEXT,
  barcode VARCHAR(128),
  supplier VARCHAR(256),
  cost_price NUMERIC(12,2),
  sale_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(lower(name));
