import { PlanError } from "../../modules/plans/application/plan-policy.js";
// Keyset position of the last row on a page: its sort key and id, so equal
// keys still page without gaps or repeats. Clients treat it as opaque.
const keys = {
  // Microseconds since the epoch, computed exactly in PostgreSQL.
  instant: /^\d{1,20}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function encodeCursor(key: string, id: string) {
  return Buffer.from(JSON.stringify([key, id]), "utf8").toString("base64url");
}
export function decodeCursor(
  cursor: string | undefined,
  kind: keyof typeof keys,
): { key: string; id: string } | null {
  if (cursor === undefined) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "string" &&
      typeof value[1] === "string" &&
      keys[kind].test(value[0]) &&
      uuid.test(value[1])
    )
      return { key: value[0], id: value[1] };
  } catch {
    // Fall through: malformed cursors are invalid input, never a server error.
  }
  throw new PlanError("INVALID_INPUT");
}
