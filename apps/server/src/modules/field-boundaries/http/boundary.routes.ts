import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  fieldBoundaryPointSchema,
  fieldBoundaryTileSchema,
} from "@rotavise/contracts";
import type { Config } from "../../../config/environment.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import type { AccountAuth } from "../../auth/application/auth.js";
import { accountSession, trustedOrigin } from "../../auth/http/auth.routes.js";
import { BoundaryStore } from "../application/boundary-store.js";

export function registerBoundaryRoutes(
  app: FastifyInstance,
  store: BoundaryStore,
  config: Config,
  auth?: AccountAuth,
  guests?: { authenticate(token: string): Promise<string> },
) {
  const handle =
    (point: boolean) => async (req: FastifyRequest, reply: FastifyReply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("Referrer-Policy", "no-referrer");
      try {
        await quota(store.pool, `boundaries-ip:${req.ip}`, 120, 60);
        if (Object.keys(req.query as object).length)
          throw new PlanError("INVALID_INPUT");
        let owner: string;
        const bearer = req.headers.authorization;
        if (bearer) {
          const token = bearer.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
          if (req.headers.cookie || !token || !guests)
            throw new PlanError("UNAUTHORIZED");
          owner = await guests.authenticate(token);
        } else {
          if (!auth || (point && !trustedOrigin(req, config)))
            throw new PlanError("UNAUTHORIZED");
          owner = (await accountSession(auth, req)).user.id;
        }
        if (
          point &&
          req.headers["content-type"]?.split(";")[0] !== "application/json"
        )
          throw new PlanError("INVALID_INPUT");
        await quota(
          store.pool,
          `boundaries-${point ? "point" : "tile"}:${owner}`,
          point ? 20 : 60,
          point ? 3600 : 60,
        );
        if (point) {
          const p = fieldBoundaryPointSchema.safeParse(req.body);
          if (!p.success) throw new PlanError("INVALID_INPUT");
          const result = await store.at(p.data.latitude, p.data.longitude);
          return result ?? reply.code(404).send({ code: "NO_FIELD_FOUND" });
        }
        const p = fieldBoundaryTileSchema.safeParse(req.params);
        if (!p.success) throw new PlanError("INVALID_INPUT");
        return await store.tile(Number(p.data.x), Number(p.data.y));
      } catch (error) {
        if (error instanceof PlanError) {
          const status =
            error.code === "UNAUTHORIZED"
              ? 401
              : error.code === "RATE_LIMITED"
                ? 429
                : error.code === "INVALID_INPUT"
                  ? 400
                  : 503;
          if (status === 429)
            reply.header("Retry-After", String(point ? 3600 : 60));
          return reply.code(status).send({
            code: status === 503 ? "FIELD_BOUNDARIES_UNAVAILABLE" : error.code,
          });
        }
        console.error("FIELD_BOUNDARIES_UNAVAILABLE");
        return reply.code(503).send({ code: "FIELD_BOUNDARIES_UNAVAILABLE" });
      }
    };
  app.get("/api/v1/field-boundaries/tiles/:z/:x/:y", handle(false));
  app.post("/api/v1/field-boundaries/at", { bodyLimit: 1024 }, handle(true));
}
