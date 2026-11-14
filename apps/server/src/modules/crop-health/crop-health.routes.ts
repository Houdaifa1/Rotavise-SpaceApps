import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  cropPhotoRequestSchema,
  planExplanationRequestSchema,
} from "@rotavise/contracts";
import { accountSession, trustedOrigin } from "../auth/http/auth.routes.js";
import { CatalogStore } from "../catalog/application/catalog-store.js";
import type { PlanStore } from "../plans/application/plan-store.js";
import { PlanError } from "../plans/application/plan-policy.js";
import {
  ClaudeClient,
  CropHealthError,
  explainPlan,
  planFacts,
  triagePhoto,
  type ModelClient,
} from "./crop-health.service.js";

const STATUS: Record<string, number> = {
  AI_NOT_CONFIGURED: 503,
  AI_BUSY: 503,
  AI_UNAVAILABLE: 503,
  AI_REQUEST_REJECTED: 502,
  AI_DAILY_LIMIT: 503,
  AI_DECLINED: 422,
  PHOTO_INVALID: 422,
  PHOTO_TOO_SMALL: 422,
  PHOTO_TOO_LARGE: 422,
  PHOTO_UNREADABLE: 422,
  CROP_NOT_COVERED: 422,
  EXPLANATION_CHECK_FAILED: 502,
  NOT_READY: 409,
};
// Open to guests and accounts alike. Without a key the routes say so clearly.
export function registerCropHealthRoutes(
  app: FastifyInstance,
  deps: {
    store: PlanStore;
    catalogs: CatalogStore;
    catalogId: string;
    catalogVersion: string;
    apiKey: string | undefined;
    // Overrides the default model; the provider's own model id.
    model?: string | undefined;
    // Provider calls allowed per rolling day across all users (cost cap).
    dailyLimit: number;
    client?: ModelClient;
  },
) {
  const { store } = deps;
  // Every provider call first takes one unit of the shared daily budget.
  const spend = async () => {
    try {
      await store.quota("ai:all", deps.dailyLimit, 86400);
    } catch (error) {
      if (error instanceof PlanError && error.code === "RATE_LIMITED")
        throw new CropHealthError("AI_DAILY_LIMIT");
      throw error;
    }
  };
  const client = (): ModelClient => {
    const inner =
      deps.client ??
      (deps.apiKey
        ? new ClaudeClient(deps.apiKey, {
            ...(deps.model ? { model: deps.model } : {}),
          })
        : null);
    if (!inner || deps.dailyLimit < 1)
      throw new CropHealthError("AI_NOT_CONFIGURED");
    return {
      ...(inner.model ? { model: inner.model } : {}),
      json: async (request) => {
        await spend();
        return inner.json(request);
      },
      text: async (request) => {
        await spend();
        return inner.text(request);
      },
    };
  };
  const identify = async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (header) {
      const match = header.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
      if (!match || request.headers.cookie) throw new PlanError("UNAUTHORIZED");
      return store.authenticate(match[1]!);
    }
    if (!store.account || !trustedOrigin(request, store.account.config))
      throw new PlanError("UNAUTHORIZED");
    const session = await accountSession(store.account.auth, request);
    return store.accountOwner(session.user.id);
  };
  const guarded = async (
    request: FastifyRequest,
    reply: FastifyReply,
    run: (owner: Awaited<ReturnType<typeof identify>>) => Promise<unknown>,
  ) => {
    reply.header("Cache-Control", "no-store");
    try {
      await store.quota("http:" + request.ip, 120, 60);
      return await run(await identify(request));
    } catch (error) {
      if (error instanceof CropHealthError) {
        reply.status(STATUS[error.code] ?? 503);
        return { code: error.code };
      }
      if (error instanceof PlanError) {
        const status =
          {
            UNAUTHORIZED: 401,
            NOT_FOUND: 404,
            INVALID_INPUT: 400,
            RATE_LIMITED: 429,
          }[error.code as string] ?? 503;
        reply.status(status);
        return { code: error.code };
      }
      console.error("CROP_HEALTH_UNAVAILABLE");
      reply.status(503);
      return { code: "CROP_HEALTH_UNAVAILABLE" };
    }
  };
  // Lets the interface show the photo check as on or off before a farmer
  // picks a photo. Public and cheap: no provider call, no budget used.
  app.get("/api/v1/crop-health/status", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    const available = (!!deps.client || !!deps.apiKey) && deps.dailyLimit > 0;
    return { available, reason: available ? null : "AI_NOT_CONFIGURED" };
  });
  app.post(
    "/api/v1/crop-health/photo",
    { bodyLimit: 7_500_000 },
    (request, reply) =>
      guarded(request, reply, async (owner) => {
        const body = cropPhotoRequestSchema.safeParse(request.body);
        if (!body.success) throw new PlanError("INVALID_INPUT");
        await store.quota(`photo:${owner}`, 20, 3600);
        const stored = await deps.catalogs.get(
          deps.catalogId,
          deps.catalogVersion,
        );
        if (!stored || stored.format !== "2")
          throw new CropHealthError("AI_UNAVAILABLE");
        const crop = stored.catalog.profiles.find(
          (p) => p.id === body.data.crop_id,
        );
        if (!crop) throw new PlanError("INVALID_INPUT");
        // The photo goes to the provider without its metadata and is not
        // stored here.
        return triagePhoto(client(), {
          cropName: crop.identity.name,
          issues: stored.catalog.issues
            .filter((i) => i.hostCropIds.includes(crop.id))
            .map((i) => ({
              id: i.id,
              name: i.name,
              scientificName: i.scientificName,
              ...(i.localNames.length
                ? { otherNames: i.localNames.map((n) => n.name) }
                : {}),
              ...(i.visibleSymptoms ? { visibleSigns: i.visibleSymptoms } : {}),
            })),
          mediaType: body.data.media_type,
          base64: body.data.image_base64,
          ...(body.data.language ? { language: body.data.language } : {}),
        });
      }),
  );
  app.post(
    "/api/v1/plans/:id/explanation",
    { bodyLimit: 1024 },
    (request, reply) =>
      guarded(request, reply, async (owner) => {
        const { id } = request.params as { id: string };
        const body = planExplanationRequestSchema.safeParse(request.body);
        if (!body.success || !z.uuid().safeParse(id).success)
          throw new PlanError("INVALID_INPUT");
        await store.quota(`explain:${owner}`, 30, 3600);
        const plan = (await store.read(owner, id)) as {
          result?: Parameters<typeof planFacts>[0] | null;
        };
        if (!plan.result) throw new CropHealthError("NOT_READY");
        return explainPlan(
          client(),
          planFacts(plan.result),
          body.data.language,
        );
      }),
  );
}
