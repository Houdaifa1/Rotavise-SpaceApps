import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import type { Config } from "../../../config/environment.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import type { AccountAuth } from "../application/auth.js";

const email = z.email().max(254),
  password = z.string().min(15).max(128),
  callbackURL = z.string().max(1024).optional();
const bodies: Record<string, z.ZodType> = {
  "sign-up/email": z.strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
    email,
    password,
    callbackURL,
  }),
  "sign-in/email": z.strictObject({
    email,
    password: z.string().min(1).max(128),
    callbackURL,
    rememberMe: z.boolean().optional(),
  }),
  "sign-out": z.strictObject({}),
  "request-password-reset": z.strictObject({
    email,
    redirectTo: z.string().max(1024).optional(),
  }),
  "reset-password": z.strictObject({
    newPassword: password,
    token: z.string().min(1).max(2048),
  }),
  "send-verification-email": z.strictObject({ email, callbackURL }),
  "change-password": z.strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    revokeOtherSessions: z.literal(true),
  }),
  "revoke-sessions": z.strictObject({}),
  "delete-user": z.strictObject({
    password: z.string().min(1).max(128).optional(),
    callbackURL,
  }),
};
const queries: Record<string, z.ZodType> = {
  "verify-email": z.strictObject({
    token: z.string().min(1).max(4096),
    callbackURL,
  }),
  "delete-user/callback": z.strictObject({
    token: z.string().min(1).max(2048),
    callbackURL,
  }),
  "reset-password/:token": z.strictObject({
    callbackURL: z.string().max(1024),
  }),
};
const googleBodies: Record<string, z.ZodType> = {
  "sign-in/social": z.strictObject({
    provider: z.literal("google"),
    callbackURL,
  }),
  "link-social": z.strictObject({ provider: z.literal("google"), callbackURL }),
};
const googleQueries: Record<string, z.ZodType> = {
  "callback/google": z
    .record(z.string().max(80), z.string().max(4096))
    .refine((v) => Object.keys(v).length <= 12),
};
// Classify failures without logging SQL, passwords, email addresses or tokens.
function failureCategory(error: unknown) {
  for (
    let depth = 0;
    error && typeof error === "object" && depth < 5;
    depth++
  ) {
    if ("code" in error) {
      if (error.code === "57014") return "database_timeout";
      if (
        ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P01", "53300"].includes(
          String(error.code),
        )
      )
        return "database_unavailable";
    }
    if ("message" in error) {
      if (error.message === "AUTH_MAIL_STORAGE_UNAVAILABLE")
        return "mail_storage";
      if (error.message === "AUTH_BUSY") return "password_capacity";
    }
    error = "cause" in error ? error.cause : undefined;
  }
  return "unclassified";
}
export function authHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const key of [
    "cookie",
    "origin",
    "content-type",
    "user-agent",
    "sec-fetch-site",
  ]) {
    const value = request.headers[key];
    if (typeof value === "string") headers.set(key, value);
  }
  headers.set("x-rotavise-client-ip", request.ip);
  return headers;
}
export function trustedOrigin(request: FastifyRequest, config: Config) {
  const origins = [
    config.AUTH_BASE_URL,
    ...config.AUTH_TRUSTED_ORIGINS.split(","),
  ];
  return (
    typeof request.headers.origin === "string" &&
    origins.includes(request.headers.origin)
  );
}
export async function accountSession(
  auth: AccountAuth,
  request: FastifyRequest,
  fresh = false,
) {
  const result = await auth.api.getSession({ headers: authHeaders(request) });
  if (
    !result?.user.emailVerified ||
    (fresh &&
      Date.now() - new Date(result.session.createdAt).getTime() > 300000)
  )
    throw new PlanError("UNAUTHORIZED");
  return result;
}
export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AccountAuth,
  pool: Pool,
  config: Config,
) {
  const google = !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  for (const [method, schemas] of [
    ["POST", google ? { ...bodies, ...googleBodies } : bodies],
    ["GET", google ? { ...queries, ...googleQueries } : queries],
  ] as const) {
    for (const [path, schema] of Object.entries(schemas)) {
      app.route({
        method,
        url: "/api/auth/" + path,
        bodyLimit: 16384,
        handler: async (req, reply) => {
          // Fixed labels only: never include credentials, email, tokens or SQL.
          let stage = "ip_quota";
          reply
            .header("Cache-Control", "no-store")
            .header("Referrer-Policy", "no-referrer")
            .header("Pragma", "no-cache");
          try {
            await quota(pool, "auth-http:" + req.ip, 60, 60);
            if (
              method === "POST" &&
              (!trustedOrigin(req, config) ||
                req.headers["content-type"]?.split(";")[0] !==
                  "application/json")
            )
              return reply
                .code(403)
                .send({ code: "INVALID_ORIGIN_OR_CONTENT_TYPE" });
            stage = "validation";
            const parsed = schema.safeParse(
              method === "POST" ? req.body : req.query,
            );
            if (
              path === "reset-password/:token" &&
              !z
                .strictObject({ token: z.string().min(1).max(2048) })
                .safeParse(req.params).success
            )
              return reply.code(400).send({ code: "INVALID_INPUT" });
            if (
              !parsed.success ||
              (method === "POST" && Object.keys(req.query as object).length)
            )
              return reply.code(400).send({ code: "INVALID_INPUT" });
            if (path === "link-social") await accountSession(auth, req, true);
            for (const field of ["callbackURL", "redirectTo"]) {
              const target = (parsed.data as Record<string, unknown>)[field];
              if (typeof target !== "string" || !target) continue;
              let origin: string;
              try {
                origin = new URL(target, config.AUTH_BASE_URL).origin;
              } catch {
                return reply.code(400).send({ code: "INVALID_REDIRECT" });
              }
              if (
                ![
                  config.AUTH_BASE_URL,
                  ...config.AUTH_TRUSTED_ORIGINS.split(","),
                ].includes(origin)
              )
                return reply.code(403).send({ code: "INVALID_REDIRECT" });
            }
            if (
              [
                "sign-up/email",
                "sign-in/email",
                "request-password-reset",
                "send-verification-email",
              ].includes(path)
            ) {
              const target = (
                parsed.data as { email: string }
              ).email.toLowerCase();
              stage = "target_quota";
              if (path === "sign-in/email") {
                // Per address and email, so one attacker cannot lock a farmer
                // out everywhere; a looser email ceiling slows spread attempts.
                await quota(
                  pool,
                  `auth-target:${path}:${target}:${req.ip}`,
                  10,
                  600,
                );
                await quota(pool, `auth-target:${path}:${target}`, 100, 600);
              } else
                await quota(pool, `auth-target:${path}:${target}`, 5, 3600);
            }
            const body =
              path === "request-password-reset"
                ? { redirectTo: "/", ...(parsed.data as object) }
                : parsed.data;
            const request = new Request(
              new URL(req.url, config.AUTH_BASE_URL),
              {
                method,
                headers: authHeaders(req),
                ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
              },
            );
            stage = "auth_handler";
            const response = await auth.handler(request);
            stage = "response";
            const cookies = response.headers.getSetCookie();
            if (cookies.length) reply.header("Set-Cookie", cookies);
            for (const [key, value] of response.headers)
              if (
                !["set-cookie", "content-length", "cache-control"].includes(key)
              )
                reply.header(key, value);
            reply.code(response.status);
            const content = await response.text();
            if (
              content &&
              response.headers.get("content-type")?.includes("application/json")
            ) {
              const result: unknown = JSON.parse(content);
              if (
                !response.ok &&
                result &&
                typeof result === "object" &&
                "code" in result &&
                result.code === "FAILED_TO_CREATE_USER"
              ) {
                console.error("AUTH_DEPENDENCY_UNAVAILABLE", {
                  operation: path,
                  stage: "auth_handler",
                  category: "user_creation",
                });
                return reply.code(503).send({ code: "AUTH_UNAVAILABLE" });
              }
              if (result && typeof result === "object" && "token" in result)
                delete result.token;
              if (response.ok && path === "sign-up/email")
                return { status: "verification_required" };
              return result;
            }
            return reply.send(content);
          } catch (error) {
            if (error instanceof PlanError && error.code === "RATE_LIMITED")
              return reply
                .header("Retry-After", String(error.retryAfterSeconds))
                .code(429)
                .send({ code: "RATE_LIMITED" });
            if (error instanceof PlanError && error.code === "UNAUTHORIZED")
              return reply.code(401).send({ code: "UNAUTHORIZED" });
            console.error("AUTH_DEPENDENCY_UNAVAILABLE", {
              operation: path,
              stage,
              category: failureCategory(error),
            });
            return reply.code(503).send({ code: "AUTH_UNAVAILABLE" });
          }
        },
      });
    }
  }
  app.get("/api/v1/auth/capabilities", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { email: true, google };
  });
  app.get("/api/v1/account", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      await quota(pool, "account-http:" + request.ip, 120, 60);
      if (Object.keys(request.query as object).length)
        return reply.code(400).send({ code: "INVALID_INPUT" });
      const { user, session } = await accountSession(auth, request);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        createdAt: user.createdAt.toISOString(),
        sessionExpiresAt: session.expiresAt.toISOString(),
      };
    } catch (error) {
      return reply
        .code(
          error instanceof PlanError
            ? error.code === "RATE_LIMITED"
              ? 429
              : 401
            : 503,
        )
        .send({
          code: error instanceof PlanError ? error.code : "AUTH_UNAVAILABLE",
        });
    }
  });
}
