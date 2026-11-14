import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
export async function poll(fn, { timeout = 30000, label = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await delay(100);
  }
  throw new Error(
    `Timed out waiting for ${label}${last ? `: ${last.message}` : ""}`,
  );
}
export async function freePort() {
  const s = createServer();
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const port = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return port;
}
