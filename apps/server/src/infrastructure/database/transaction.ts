import type pg from "pg";
import type { Db } from "pg-boss";
export function queueTransaction(client: pg.PoolClient): Db {
  return { executeSql: (text, values) => client.query(text, values) };
}
export async function withTransaction<T>(
  pool: pg.Pool,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  const onError = () => {
    broken = new Error("DATABASE_CONNECTION_LOST");
  };
  client.on("error", onError);
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      broken = new Error("DATABASE_ROLLBACK_FAILED");
    });
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(broken);
  }
}
