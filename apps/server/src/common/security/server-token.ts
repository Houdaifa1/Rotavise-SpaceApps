import { timingSafeEqual } from "node:crypto";
export function validServerToken(
  actual: string | undefined,
  expected: string | undefined,
) {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual),
    expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}
