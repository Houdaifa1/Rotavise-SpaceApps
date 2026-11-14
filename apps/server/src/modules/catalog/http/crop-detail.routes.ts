import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { cropDetailParamsSchema } from "@rotavise/contracts";
import { staticJson } from "../../../common/http/static-json.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import { CatalogStore } from "../application/catalog-store.js";
import { buildCropDetail } from "../application/crop-detail.js";

const RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_BYTES = 8 * 1024 * 1024;
const CACHE_ENTRIES = 32;

export function registerCropDetailRoutes(app: FastifyInstance, pool: Pool) {
  const store = new CatalogStore(pool);
  // Per server, bounded by bytes and entries. The release hash and crop id are
  // immutable identities, independent of which catalog is currently configured.
  const documents = new Map<
    string,
    { body: string; etag: string; bytes: number }
  >();
  let cachedBytes = 0;
  app.get(
    "/api/v1/catalog/crops/:catalogId/:version/:cropId",
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const params = cropDetailParamsSchema.safeParse(request.params);
      if (!params.success || Object.keys(request.query as object).length)
        return reply.code(400).send({ code: "INVALID_INPUT" });
      try {
        await quota(pool, "catalog-detail:" + request.ip, 60, 60);
        const { catalogId, version, cropId } = params.data;
        // Always check the verified store, including on an ETag hit: missing or
        // corrupt releases and database outages must never become a cached 200/304.
        const current = await store.get(catalogId, version);
        if (!current || current.catalog.synthetic)
          return reply.code(404).send({ code: "CATALOG_NOT_FOUND" });
        const key = `${current.sha256}:${cropId}`;
        let document = documents.get(key);
        if (!document) {
          const detail = buildCropDetail(current, cropId);
          if (!detail) return reply.code(404).send({ code: "NOT_FOUND" });
          const serialized = staticJson(detail);
          const bytes = Buffer.byteLength(serialized.body);
          // Never silently drop facts, sources or issues to fit the response.
          if (bytes > RESPONSE_BYTES)
            throw new Error("CROP_DETAIL_RESPONSE_LIMIT");
          document = { body: serialized.body, etag: serialized.etag, bytes };
          while (
            documents.size >= CACHE_ENTRIES ||
            cachedBytes + bytes > CACHE_BYTES
          ) {
            const oldest = documents.keys().next().value!;
            cachedBytes -= documents.get(oldest)!.bytes;
            documents.delete(oldest);
          }
          cachedBytes += bytes;
        } else documents.delete(key);
        documents.set(key, document);
        reply
          .header("ETag", document.etag)
          .header("Cache-Control", "public, max-age=3600, immutable");
        const matches = request.headers["if-none-match"]
          ?.split(",")
          .some((tag) => {
            const candidate = tag.trim();
            return (
              candidate === "*" ||
              candidate.replace(/^W\//, "") === document.etag
            );
          });
        if (matches) return reply.code(304).send();
        return reply
          .type("application/json; charset=utf-8")
          .send(document.body);
      } catch (error) {
        if (error instanceof PlanError && error.code === "RATE_LIMITED")
          return reply
            .header("Retry-After", "60")
            .code(429)
            .send({ code: "RATE_LIMITED" });
        console.error("CATALOG_DETAIL_UNAVAILABLE");
        return reply.code(503).send({ code: "CATALOG_UNAVAILABLE" });
      }
    },
  );
}
