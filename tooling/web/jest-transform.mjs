import { createHash } from "node:crypto";
import { transformSync } from "../../apps/web/node_modules/esbuild/lib/main.js";
export default {
  getCacheKey(source, filename) {
    return createHash("sha256")
      .update(source + filename + "web-esm-import-attributes-v1")
      .digest("hex");
  },
  process(source, filename) {
    return {
      code: transformSync(source, {
        sourcefile: filename,
        loader: filename.endsWith(".tsx") ? "tsx" : "ts",
        format: "esm",
        jsx: "automatic",
        target: "es2023",
        supported: { "import-attributes": true },
        sourcemap: "inline",
      }).code,
    };
  },
};
