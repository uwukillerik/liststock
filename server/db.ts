import pg from "pg";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL не задан. Создайте файл .env по образцу .env.example."
    );
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}
