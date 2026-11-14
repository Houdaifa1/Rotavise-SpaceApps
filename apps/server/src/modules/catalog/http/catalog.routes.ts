import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { catalogOptionsSchema } from "@rotavise/contracts";
import type { Config } from "../../../config/environment.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import { CatalogStore } from "../application/catalog-store.js";
import { registerCropDetailRoutes } from "./crop-detail.routes.js";

type StoredName = {
  language: "fr" | "ar" | "ary" | "zgh" | "en";
  name: string;
  recall?: { confidence: "low" | "medium" | "high" } | undefined;
  confidence?: "low" | "medium" | "high" | undefined;
  preferred?: boolean | undefined;
  origin?: "primary_name" | undefined;
};
const publicNames = (names: StoredName[]) =>
  names.map((n) => ({
    language: n.language,
    name: n.name,
    ...(n.confidence || n.recall
      ? { confidence: n.confidence ?? n.recall?.confidence }
      : {}),
    ...(n.preferred !== undefined ? { preferred: n.preferred } : {}),
    ...(n.origin ? { origin: n.origin } : {}),
  }));

export function registerCatalogRoutes(
  app: FastifyInstance,
  pool: Pool,
  config: Config,
) {
  registerCropDetailRoutes(app, pool);
  const store = new CatalogStore(pool);
  // The verified store head is still checked per request. Cache only the
  // bounded public serialization of immutable release content, by its hash.
  const documents = new Map<string, { body: string; bytes: number }>();
  let cachedBytes = 0;
  const serve = async (
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
    version: string,
    historical: boolean,
  ) => {
    reply.header("Cache-Control", "no-store");
    try {
      if (Object.keys(request.query as object).length)
        return reply.code(400).send({ code: "INVALID_INPUT" });
      await quota(pool, "catalog-options:" + request.ip, 60, 60);
      const current = await store.get(id, version);
      if (!current || current.catalog.synthetic)
        return reply.code(historical ? 404 : 503).send({
          code: historical ? "CATALOG_NOT_FOUND" : "CATALOG_UNAVAILABLE",
        });
      const hit = documents.get(current.sha256);
      if (hit) {
        documents.delete(current.sha256);
        documents.set(current.sha256, hit);
        return reply.type("application/json; charset=utf-8").send(hit.body);
      }
      const options = catalogOptionsSchema.parse({
        catalogId: current.catalog.id,
        catalogVersion: current.catalog.version,
        catalogSha256: current.sha256,
        crops:
          current.format === "1"
            ? current.catalog.profiles.map((profile) => ({
                id: profile.id,
                name: profile.identity.name,
                scientificName: profile.identity.scientificName,
                family: profile.identity.family,
                reviewStatus: profile.review.status,
                localNames: [],
                cultivars: [],
              }))
            : current.catalog.profiles.map((profile) => {
                // Format 2 reviews rules, not profiles: "reviewed" only when
                // every binding rule has a recorded specialist review.
                const binding = profile.rules.filter(
                  (r) => r.severity !== "reference",
                );
                return {
                  id: profile.id,
                  name: profile.identity.name,
                  scientificName: profile.identity.scientificName,
                  family: profile.identity.family,
                  localNames: publicNames(profile.identity.localNames),
                  cultivars: profile.cultivars.map((c) => ({
                    id: c.id,
                    name: c.name,
                    localNames: publicNames(c.localNames ?? []),
                  })),
                  reviewStatus:
                    binding.length > 0 &&
                    binding.every(
                      (r) => r.verification.status === "expert_reviewed",
                    )
                      ? ("reviewed" as const)
                      : ("pending" as const),
                };
              }),
        sources: current.catalog.sources.map((source) => ({
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
        })),
      });
      const body = JSON.stringify(options);
      const bytes = Buffer.byteLength(body);
      if (bytes > 2 * 1024 * 1024)
        throw new Error("CATALOG_OPTIONS_RESPONSE_LIMIT");
      while (documents.size >= 4 || cachedBytes + bytes > 8 * 1024 * 1024) {
        const oldest = documents.keys().next().value!;
        cachedBytes -= documents.get(oldest)!.bytes;
        documents.delete(oldest);
      }
      documents.set(current.sha256, { body, bytes });
      cachedBytes += bytes;
      return reply.type("application/json; charset=utf-8").send(body);
    } catch (error) {
      if (error instanceof PlanError && error.code === "RATE_LIMITED")
        return reply
          .header("Retry-After", "60")
          .code(429)
          .send({ code: "RATE_LIMITED" });
      console.error("CATALOG_OPTIONS_UNAVAILABLE");
      return reply.code(503).send({ code: "CATALOG_UNAVAILABLE" });
    }
  };
  app.get("/api/v1/catalog/options", (request, reply) =>
    serve(
      request,
      reply,
      config.PLAN_CATALOG_ID,
      config.PLANNING_ENABLED === "true"
        ? config.ROTATION_CATALOG_VERSION
        : config.PLAN_CATALOG_VERSION,
      false,
    ),
  );
  app.get("/api/v1/catalog/options/:catalogId/:version", (request, reply) => {
    const parsed = z
      .strictObject({
        catalogId: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
        version: z
          .string()
          .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
          .max(40),
      })
      .safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ code: "INVALID_INPUT" });
    return serve(
      request,
      reply,
      parsed.data.catalogId,
      parsed.data.version,
      true,
    );
  });
}
