import type pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
export async function migrateApplication(pool: pg.Pool) {
  // Serialize deploy-time migrations; API and worker startup never call this.
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(1801001)");
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL("../../migrations", import.meta.url),
      ),
    });
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(1801001)");
    } finally {
      client.release();
    }
  }
}
