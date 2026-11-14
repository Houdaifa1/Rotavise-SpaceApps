import pg from "pg";
export function createPool(connectionString: string) {
  return new pg.Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 2000,
    statement_timeout: 3000,
    query_timeout: 4000,
    idleTimeoutMillis: 10000,
  });
}
