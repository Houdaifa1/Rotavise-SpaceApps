import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { contractTreeShaking } from "../../tooling/web/contract-treeshake.js";
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^maplibre-gl$/,
        replacement: fileURLToPath(
          new URL(
            "./node_modules/maplibre-gl/dist/maplibre-gl-csp.js",
            import.meta.url,
          ),
        ),
      },
    ],
  },
  plugins: [
    contractTreeShaking(),
    {
      name: "preload-interface-assets",
      transformIndexHtml: {
        order: "post",
        handler(html, context) {
          const assets = Object.values(context.bundle ?? {});
          const font = (name: string) =>
            assets.find(
              (output) =>
                output.fileName.includes(`/${name}-`) &&
                output.fileName.endsWith(".woff2"),
            );
          const bodyFont = font("ibm-plex-sans-latin-400-normal");
          const mediumFont = font("ibm-plex-sans-latin-500-normal");
          const displayFont = font("fraunces-latin-500-normal");
          const mapStyle = assets.find((output) =>
            /\/MapWorkspace-[^/]+\.css$/.test(output.fileName),
          );
          const mapShell = assets.find(
            (output) =>
              output.type === "chunk" && output.name === "MapWorkspace",
          );
          const phoneSheet = assets.find(
            (output) => output.type === "chunk" && output.name === "PhoneSheet",
          );
          const planBuilder = assets.find(
            (output) =>
              output.type === "chunk" && output.name === "PlanBuilder",
          );
          const planStatus = assets.find(
            (output) =>
              output.type === "chunk" && output.name === "PlanProgress",
          );
          const planTransport = assets.find(
            (output) =>
              output.type === "chunk" &&
              output.moduleIds.some((id) => id.endsWith("/src/api/plans.ts")),
          );
          const planStyle = assets.find((output) =>
            /\/plans-[^/]+\.css$/.test(output.fileName),
          );
          const languageAsset = (language: string) =>
            assets.find(
              (output) =>
                output.type === "asset" &&
                new RegExp(`/${language}-[^/]+\\.json$`).test(output.fileName),
            );
          const french = languageAsset("fr");
          const english = languageAsset("en");
          const importsFor = (...files: string[]) => {
            const imports = new Set<string>();
            const visit = (file: string) => {
              if (imports.has(file)) return;
              imports.add(file);
              const output = context.bundle?.[file];
              if (output?.type === "chunk") output.imports.forEach(visit);
            };
            files.forEach(visit);
            return [...imports].map((file) => `/${file}`).join(",");
          };
          return {
            html,
            tags: [
              ...(french && english
                ? [
                    {
                      tag: "meta",
                      attrs: {
                        name: "rotavise-languages",
                        content: `/${french.fileName}`,
                        "data-en": `/${english.fileName}`,
                      },
                      injectTo: "head" as const,
                    },
                  ]
                : []),
              ...(planBuilder && planStatus
                ? [
                    {
                      tag: "meta",
                      attrs: {
                        name: "rotavise-planning-shell",
                        content: importsFor(planBuilder.fileName),
                        "data-retry": importsFor(
                          planBuilder.fileName,
                          ...(planTransport ? [planTransport.fileName] : []),
                        ),
                        "data-status": importsFor(
                          planStatus.fileName,
                          ...(planTransport ? [planTransport.fileName] : []),
                        ),
                        "data-style": planStyle ? `/${planStyle.fileName}` : "",
                      },
                      injectTo: "head" as const,
                    },
                  ]
                : []),
              ...[bodyFont]
                .filter((font) => !!font)
                .map((font) => ({
                  tag: "link",
                  attrs: {
                    rel: "preload",
                    as: "font",
                    type: "font/woff2",
                    crossorigin: "anonymous",
                    href: `/${font.fileName}`,
                  },
                  injectTo: "head" as const,
                })),
              ...(mediumFont && displayFont
                ? [
                    {
                      tag: "meta",
                      attrs: {
                        name: "rotavise-fonts",
                        content: `/${displayFont.fileName}`,
                        "data-medium": `/${mediumFont.fileName}`,
                      },
                      injectTo: "head" as const,
                    },
                  ]
                : []),
              ...(mapShell && phoneSheet
                ? [
                    {
                      tag: "meta",
                      attrs: {
                        name: "rotavise-map-shell",
                        content: `/${mapShell.fileName}`,
                        "data-phone-sheet": `/${phoneSheet.fileName}`,
                        "data-style": mapStyle ? `/${mapStyle.fileName}` : "",
                      },
                      injectTo: "head" as const,
                    },
                  ]
                : []),
            ],
          };
        },
      },
    },
  ],
  build: { manifest: true },
  preview: {
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000" },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000" },
  },
});
