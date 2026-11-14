// First-party boot transport only. http.ts validates every consumed response.
// A separate deferred script overlaps S00 reads with the application modules.
(() => {
  if (location.pathname === "/design" || window.rotaviseBootReads) return;
  // Start the shell download on direct map visits, before the router starts.
  // The WebGL renderer and its worker still load after the shell mounts.
  const mapRoute =
    location.pathname === "/map" ||
    /^\/fields\/[^/]+(?:\/history)?$/.test(location.pathname);
  if (mapRoute) {
    const entry = document.querySelector('meta[name="rotavise-map-shell"]');
    const preload = (href) => {
      if (!href) return;
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = href;
      document.head.append(link);
    };
    if (entry?.dataset.style) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = entry.dataset.style;
      document.head.append(link);
    }
    preload(entry?.content);
    if (matchMedia("(max-width: 767px)").matches)
      preload(entry?.dataset.phoneSheet);
  }
  const planningRoute = /^\/fields\/[^/]+\/plan\/new$|^\/plans\/[^/]+$/.test(
    location.pathname,
  );
  if (planningRoute) {
    const entry = document.querySelector(
      'meta[name="rotavise-planning-shell"]',
    );
    const status = location.pathname.startsWith("/plans/");
    if (entry?.dataset.style) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = entry.dataset.style;
      document.head.append(link);
    }
    const imports = status
      ? entry?.dataset.status
      : new URLSearchParams(location.search).has("retry")
        ? entry?.dataset.retry
        : entry?.content;
    for (const href of (imports ?? "").split(",").filter(Boolean)) {
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = href;
      document.head.append(link);
    }
  }
  const fonts = document.querySelector('meta[name="rotavise-fonts"]');
  const fontHref =
    mapRoute || planningRoute
      ? fonts?.dataset.medium
      : location.pathname === "/"
        ? fonts?.content
        : undefined;
  if (fontHref) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = fontHref;
    document.head.append(link);
  }
  const deferReferenceData =
    mapRoute || planningRoute || location.pathname === "/";
  let language = "fr";
  try {
    if (localStorage.getItem("rv.lang") === "en") language = "en";
  } catch {
    /* French default. */
  }
  const copy = document.querySelector('meta[name="rotavise-languages"]');
  const languageHref = language === "en" ? copy?.dataset.en : copy?.content;
  if (languageHref) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    link.href = languageHref;
    document.head.append(link);
  }
  const reads = new Map();
  window.rotaviseBootReads = reads;
  for (const path of [
    "/api/v1/health/live",
    "/api/v1/capabilities",
    ...(deferReferenceData
      ? []
      : ["/api/v1/catalog/options", `/api/v1/glossary?lang=${language}`]),
  ]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = fetch(path, {
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    void response.catch(() => {});
    reads.set(path, { response, controller, timer });
  }
})();
