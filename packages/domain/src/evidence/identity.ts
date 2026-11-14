import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("CLIMATE_EVIDENCE_INVALID");
  return result;
}
// Content identity is not authentication; the trusted server supplies stored evidence.
export function normalizedWeatherHash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonical(value))));
}
