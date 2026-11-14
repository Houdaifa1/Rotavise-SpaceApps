import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  fieldCreateRequestSchema,
  cropHistoryEntrySchema,
  pageQuerySchema,
  fieldIdParamsSchema,
  fieldHistoryParamsSchema,
  fieldObservationParamsSchema,
  fieldExtractionParamsSchema,
  fieldWithHistoryRequestSchema,
  fieldUpdateRequestSchema,
  boundaryUpdateRequestSchema,
  historyUpdateRequestSchema,
  observationRequestSchema,
  extractionRequestSchema,
} from "@rotavise/contracts";
import type { Config } from "../../../config/environment.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import type { AccountAuth } from "../../auth/application/auth.js";
import { accountSession, trustedOrigin } from "../../auth/http/auth.routes.js";
import { FieldStore } from "../application/field-store.js";
import type { ObservationStore } from "../../earth-observations/application/observation-store.js";
import type { ExtractionStore } from "../../earth-observations/application/extraction-store.js";
import type { WaterStorageService } from "../../earth-observations/application/water-storage.service.js";
import type { CanopyBiomassService } from "../../earth-observations/application/canopy-biomass.service.js";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const p = schema.safeParse(value);
  if (!p.success) throw new PlanError("INVALID_INPUT");
  return p.data;
}
export function registerFieldRoutes(
  app: FastifyInstance,
  auth: AccountAuth | undefined,
  store: FieldStore,
  config: Config,
  observations?: ObservationStore,
  // Guests use their plan session's bearer token; accounts their cookie.
  guests?: { authenticate(token: string): Promise<string> },
  extractions?: ExtractionStore,
  waterStorage?: WaterStorageService,
  canopyBiomass?: CanopyBiomassService,
) {
  const handler =
    (
      run: (
        id: string,
        req: FastifyRequest,
        reply: FastifyReply,
      ) => Promise<unknown>,
      page = false,
    ) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer");
      try {
        await quota(store.pool, "fields-http:" + req.ip, 120, 60);
        if (!page && Object.keys(req.query as object).length)
          throw new PlanError("INVALID_INPUT");
        const bearer = req.headers.authorization;
        if (bearer) {
          const token = bearer.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
          if (req.headers.cookie || !token || !guests)
            throw new PlanError("INVALID_INPUT");
          if (
            req.method !== "GET" &&
            req.method !== "DELETE" &&
            req.headers["content-type"]?.split(";")[0] !== "application/json"
          )
            throw new PlanError("INVALID_INPUT");
          return await run(await guests.authenticate(token), req, reply);
        }
        if (!auth) throw new PlanError("UNAUTHORIZED");
        if (
          req.method !== "GET" &&
          (!trustedOrigin(req, config) ||
            (req.method !== "DELETE" &&
              req.headers["content-type"]?.split(";")[0] !==
                "application/json"))
        )
          throw new PlanError("UNAUTHORIZED");
        const session = await accountSession(auth, req);
        return await run(session.user.id, req, reply);
      } catch (error) {
        const status =
          error instanceof PlanError
            ? {
                UNAUTHORIZED: 401,
                NOT_FOUND: 404,
                INVALID_INPUT: 400,
                IDEMPOTENCY_CONFLICT: 409,
                RATE_LIMITED: 429,
                CATALOG_UNAVAILABLE: 503,
                STORED_REQUEST_INVALID: 503,
              }[error.code]
            : 503;
        if (status === 503) console.error("FIELD_DEPENDENCY_UNAVAILABLE");
        if (status === 429) reply.header("Retry-After", "86400");
        return reply.code(status).send({
          code: error instanceof PlanError ? error.code : "FIELD_UNAVAILABLE",
        });
      }
    };
  const params = (req: FastifyRequest) =>
    parse(fieldIdParamsSchema, req.params).id;
  const historyParams = (req: FastifyRequest) =>
    parse(fieldHistoryParamsSchema, req.params);
  app.post(
    "/api/v1/fields",
    { bodyLimit: 16384 },
    handler(async (owner, req, reply) => {
      reply.code(201);
      const { boundary, ...profile } = parse(
        fieldCreateRequestSchema,
        req.body,
      );
      return store.create(owner, profile, [], boundary);
    }),
  );
  app.post(
    "/api/v1/fields-with-history",
    { bodyLimit: 32768 },
    handler(async (owner, req, reply) => {
      const body = parse(fieldWithHistoryRequestSchema, req.body);
      reply.code(201);
      return store.create(owner, body.profile, body.history, body.boundary);
    }),
  );
  app.get(
    "/api/v1/fields",
    handler(async (owner, req) => {
      const page = parse(pageQuerySchema, req.query);
      return store.list(owner, page.cursor, page.limit);
    }, true),
  );
  app.get(
    "/api/v1/fields/:id",
    handler(async (owner, req) => store.read(owner, params(req))),
  );
  app.put(
    "/api/v1/fields/:id",
    { bodyLimit: 16384 },
    handler(async (owner, req) => {
      const body = parse(fieldUpdateRequestSchema, req.body);
      return store.update(
        owner,
        params(req),
        body.expectedVersion,
        body.profile,
      );
    }),
  );
  app.delete(
    "/api/v1/fields/:id",
    handler(async (owner, req, reply) => {
      await store.remove(owner, params(req));
      return reply.code(204).send();
    }),
  );
  app.get(
    "/api/v1/fields/:id/boundary",
    handler(async (owner, req) => ({
      boundary: await store.boundary(owner, params(req)),
    })),
  );
  app.put(
    "/api/v1/fields/:id/boundary",
    { bodyLimit: 16384 },
    handler(async (owner, req) => {
      const body = parse(boundaryUpdateRequestSchema, req.body);
      return store.saveBoundary(
        owner,
        params(req),
        body.boundary,
        body.expectedVersion,
      );
    }),
  );
  app.delete(
    "/api/v1/fields/:id/boundary",
    handler(async (owner, req, reply) => {
      await store.removeBoundary(owner, params(req));
      return reply.code(204).send();
    }),
  );
  if (observations) {
    app.post(
      "/api/v1/fields/:id/observations",
      { bodyLimit: 256 },
      handler(async (owner, req, reply) => {
        const { kind } = parse(observationRequestSchema, req.body);
        reply.code(202);
        return observations.request(owner, params(req), kind);
      }),
    );
    app.get(
      "/api/v1/fields/:id/observations",
      handler(async (owner, req) => ({
        items: await observations.list(owner, params(req)),
      })),
    );
    app.get(
      "/api/v1/fields/:id/analysis/vegetation",
      handler(async (owner, req) =>
        observations.vegetationAnalysis(owner, params(req)),
      ),
    );
    app.get(
      "/api/v1/fields/:id/analysis/rain",
      handler(async (owner, req) =>
        observations.rainSeries(owner, params(req)),
      ),
    );
    app.get(
      "/api/v1/fields/:id/observations/:observationId",
      handler(async (owner, req) => {
        const p = parse(fieldObservationParamsSchema, req.params);
        return observations.read(owner, p.id, p.observationId);
      }),
    );
  }
  if (extractions) {
    app.post(
      "/api/v1/fields/:id/extractions",
      { bodyLimit: 256 },
      handler(async (owner, req, reply) => {
        const { kind } = parse(extractionRequestSchema, req.body);
        reply.code(202);
        return extractions.request(owner, params(req), kind);
      }),
    );
    app.get(
      "/api/v1/fields/:id/extractions",
      handler(async (owner, req) => ({
        items: await extractions.list(owner, params(req)),
      })),
    );
    app.get(
      "/api/v1/fields/:id/extractions/:extractionId",
      handler(async (owner, req) => {
        const p = parse(fieldExtractionParamsSchema, req.params);
        return extractions.read(owner, p.id, p.extractionId);
      }),
    );
    // MODIS greenness since 2000, set beside the HLS analysis when there is one.
    app.get(
      "/api/v1/fields/:id/analysis/vegetation-history",
      handler(async (owner, req) => {
        const id = params(req);
        const hls = observations
          ? await observations.vegetationAnalysis(owner, id)
          : null;
        return extractions.vegetationHistory(
          owner,
          id,
          hls?.status === "ready" ? hls.analysis : null,
        );
      }),
    );
  }
  if (canopyBiomass)
    app.get(
      "/api/v1/fields/:id/canopy-biomass",
      handler(async (owner, req) => canopyBiomass.forField(owner, params(req))),
    );
  if (waterStorage)
    app.get(
      "/api/v1/fields/:id/water-storage",
      handler(async (owner, req) => waterStorage.forField(owner, params(req))),
    );
  app.get(
    "/api/v1/fields/:id/history",
    handler(async (owner, req) => {
      const page = parse(pageQuerySchema, req.query);
      return store.history(owner, params(req), page.cursor, page.limit);
    }, true),
  );
  app.post(
    "/api/v1/fields/:id/history",
    { bodyLimit: 2048 },
    handler(async (owner, req, reply) => {
      reply.code(201);
      return store.saveHistory(
        owner,
        params(req),
        parse(cropHistoryEntrySchema, req.body),
      );
    }),
  );
  app.put(
    "/api/v1/fields/:id/history/:entryId",
    { bodyLimit: 2048 },
    handler(async (owner, req) => {
      const p = historyParams(req),
        body = parse(historyUpdateRequestSchema, req.body);
      return store.saveHistory(
        owner,
        p.id,
        body.entry,
        p.entryId,
        body.expectedVersion,
      );
    }),
  );
  app.delete(
    "/api/v1/fields/:id/history/:entryId",
    handler(async (owner, req, reply) => {
      const p = historyParams(req);
      await store.removeHistory(owner, p.id, p.entryId);
      return reply.code(204).send();
    }),
  );
}
