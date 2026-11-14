// Start S00 reads while the lazy app modules download. Responses are consumed
// once by http.ts and still pass its normal status handling and Zod parsing.
// No result is exposed to a screen before validation.
type Reads = Map<
  string,
  {
    response: Promise<Response>;
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  }
>;
const pending = () =>
  ((window as Window & { rotaviseBootReads?: Reads }).rotaviseBootReads ??=
    new Map());
const releases = new WeakMap<Response, () => void>();
export function preloadBootReads() {
  if (pending().size) return;
  let language = "fr";
  try {
    if (localStorage.getItem("rv.lang") === "en") language = "en";
  } catch {
    /* French default. */
  }
  for (const path of [
    "/api/v1/health/live",
    "/api/v1/capabilities",
    "/api/v1/catalog/options",
    `/api/v1/glossary?lang=${language}`,
  ]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = fetch(path, {
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    void response.catch(() => {});
    pending().set(path, { response, controller, timer });
  }
}
export function takeBootRead(path: string, signal?: AbortSignal) {
  const read = pending().get(path);
  if (!read) return undefined;
  pending().delete(path);
  const abort = () => read.controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const release = () => {
    clearTimeout(read.timer);
    signal?.removeEventListener("abort", abort);
  };
  return read.response.then(
    (response) => {
      releases.set(response, release);
      return response;
    },
    (error) => {
      release();
      throw error;
    },
  );
}
export function releaseBootRead(response: Response) {
  releases.get(response)?.();
  releases.delete(response);
}
