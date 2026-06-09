import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const USERS = [
  {
    username: "admin1",
    password: "admin",
    displayName: "Администратор 1",
    role: "admin" as const,
  },
  {
    username: "sclad1",
    password: "sclad1",
    displayName: "Кладовщик 1",
    role: "worker" as const,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан в .env");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    for (const u of USERS) {
      const hash = bcrypt.hashSync(u.password, 10);
      const { rowCount } = await client.query(
        `UPDATE users
         SET password_hash = $1, display_name = $2, role = $3
         WHERE lower(username) = lower($4)`,
        [hash, u.displayName, u.role, u.username]
      );

      if (rowCount === 0) {
        await client.query(
          `INSERT INTO users (username, password_hash, display_name, role)
           VALUES (lower($1), $2, $3, $4)`,
          [u.username, hash, u.displayName, u.role]
        );
        console.log(`✓ Создан: ${u.username} / ${u.password} (${u.role})`);
      } else {
        console.log(`✓ Обновлён: ${u.username} / ${u.password} (${u.role})`);
      }
    }
    console.log("\nГотово. Можно входить:");
    console.log("  admin1 / admin   — администратор");
    console.log("  sclad1 / sclad1  — кладовщик");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
