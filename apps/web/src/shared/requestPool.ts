// A shared limit covers work queued by successive views and aborted requests.
export function requestPool(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(signal: AbortSignal, request: () => Promise<T>) {
    signal.throwIfAborted();
    if (active >= limit) {
      await new Promise<void>((resolve, reject) => {
        const ready = () => {
          signal.removeEventListener("abort", abort);
          resolve();
        };
        const abort = () => {
          const index = waiting.indexOf(ready);
          if (index !== -1) waiting.splice(index, 1);
          reject(signal.reason);
        };
        waiting.push(ready);
        signal.addEventListener("abort", abort, { once: true });
      });
    } else {
      active++;
    }
    try {
      signal.throwIfAborted();
      return await request();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
