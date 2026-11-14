// The code a tile preparation reports when it stops: the error's own code when
// it is one, DATABASE_UNAVAILABLE when PostgreSQL cannot be reached, otherwise
// CLIMATE_PREPARE_FAILED. Never prints SQL, URLs or credentials.
const unavailable = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01",
  "53300",
];
export function climatePrepareFailureCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z_]+$/.test(error.message))
    return error.message;
  // pg reports connection failures with the system code on the error itself.
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    unavailable.includes(String(error.code))
  )
    return "DATABASE_UNAVAILABLE";
  return "CLIMATE_PREPARE_FAILED";
}
