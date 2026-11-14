import { realpath, open } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  catalogReleaseSchema,
  catalogReleaseV2Schema,
} from "@rotavise/contracts";
import {
  prepareCatalog,
  prepareCatalogV2,
  CatalogValidationError,
} from "@rotavise/catalog";

export class CatalogReleaseError extends Error {
  constructor(
    public readonly code: string,
    public readonly file?: string,
  ) {
    super(code);
  }
}

export async function loadCatalogRelease(directory: string) {
  const root = await realpath(directory).catch(() => {
    throw new CatalogReleaseError("CATALOG_DIRECTORY_UNAVAILABLE");
  });
  let totalBytes = 0;
  // Format 1 keeps its original limits; format 2 region boundaries need more
  // room. The manifest is read under the larger limit, then the format decides.
  // Pretty-printed format 2 research releases need a 24 MiB disk budget;
  // prepareCatalogV2 still enforces the 16 MiB canonical ceiling (result ceiling is unchanged).
  let limits = { file: 4194304, total: 25165824 };
  async function readJson(relative: string): Promise<unknown> {
    const path = await realpath(resolve(root, relative)).catch(() => {
      throw new CatalogReleaseError("CATALOG_FILE_UNAVAILABLE", relative);
    });
    if (!path.startsWith(root + sep))
      throw new CatalogReleaseError("CATALOG_PATH_INVALID", relative);
    const file = await open(path, "r").catch(() => {
      throw new CatalogReleaseError("CATALOG_FILE_UNAVAILABLE", relative);
    });
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size < 1 ||
        stat.size > limits.file ||
        totalBytes + stat.size > limits.total
      )
        throw new CatalogReleaseError("CATALOG_FILE_LIMIT", relative);
      // Fixed buffer also bounds a file that grows after stat; no unbounded readFile.
      const buffer = Buffer.alloc(stat.size + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const chunk = await file.read(
          buffer,
          bytes,
          buffer.length - bytes,
          bytes,
        );
        if (!chunk.bytesRead) break;
        bytes += chunk.bytesRead;
      }
      if (bytes !== stat.size)
        throw new CatalogReleaseError("CATALOG_FILE_CHANGED", relative);
      totalBytes += bytes;
      try {
        return JSON.parse(
          buffer.subarray(0, bytes).toString("utf8"),
        ) as unknown;
      } catch {
        throw new CatalogReleaseError("CATALOG_JSON_INVALID", relative);
      }
    } finally {
      await file.close();
    }
  }
  const manifest = await readJson("manifest.json");
  const format2 =
    typeof manifest === "object" &&
    manifest !== null &&
    "schemaVersion" in manifest &&
    manifest.schemaVersion === "2";
  if (!format2) limits = { file: 1048576, total: 2097152 };
  const parsed = (
    format2 ? catalogReleaseV2Schema : catalogReleaseSchema
  ).safeParse(manifest);
  if (!parsed.success)
    throw new CatalogValidationError(
      "CATALOG_INVALID",
      parsed.error.issues
        .slice(0, 20)
        .map((i) => `manifest.${i.path.join(".")}`),
    );
  const { sourceFile, profileFiles, ...metadata } = parsed.data;
  const sources = await readJson(sourceFile);
  const profiles = [];
  for (const file of profileFiles) profiles.push(await readJson(file));
  const bundle = { ...metadata, sources, profiles };
  return format2
    ? prepareCatalogV2(bundle).catalog
    : prepareCatalog(bundle).catalog;
}
