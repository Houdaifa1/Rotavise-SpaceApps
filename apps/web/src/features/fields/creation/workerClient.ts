import type { Work, runWork } from "./geometry.worker.js";
export class GeometryWorker {
  private worker = new Worker(
    new URL("./geometry.worker.ts", import.meta.url),
    { type: "module" },
  );
  private next = 0;
  private failed = false;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  constructor() {
    this.worker.onmessage = (
      event: MessageEvent<{ id: number; result: unknown; issue?: string }>,
    ) => {
      const entry = this.pending.get(event.data.id);
      if (!entry) return;
      this.pending.delete(event.data.id);
      if (event.data.issue) entry.reject(new Error(event.data.issue));
      else entry.resolve(event.data.result);
    };
    this.worker.onerror = () => {
      this.failed = true;
      for (const p of this.pending.values()) p.reject(new Error("worker"));
      this.pending.clear();
    };
  }
  run<T = Awaited<ReturnType<typeof runWork>>>(work: Work): Promise<T> {
    if (this.failed) return Promise.reject(new Error("worker"));
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
      this.worker.postMessage(
        { id, work },
        work.kind === "import" ? [work.buffer] : [],
      );
    });
  }
  destroy() {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new DOMException("Aborted", "AbortError"));
    this.pending.clear();
  }
}
