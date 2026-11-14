import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  idempotencyKeySchema,
  planCreateRequestSchema,
  rotationPlanCreateRequestSchema,
  planLabelRequestSchema,
  pageQuerySchema,
  planClaimRequestSchema,
  planSessionRequestSchema,
} from "@rotavise/contracts";
import { accountSession, trustedOrigin } from "../auth/http/auth.routes.js";
import { PlanStore } from "./application/plan-store.js";
import { PlanError, isFormat2 } from "./application/plan-policy.js";
@Controller("api/v1")
export class PlansController {
  constructor(private readonly store: PlanStore) {}
  private async execute(
    reply: FastifyReply,
    request: FastifyRequest,
    run: () => Promise<unknown>,
    page = false,
  ) {
    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .header("Referrer-Policy", "no-referrer");
    try {
      if (!page && Object.keys(request.query as Record<string, unknown>).length)
        throw new PlanError("INVALID_INPUT");
      await this.store.quota("http:" + request.ip, 120, 60);
      return await run();
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
      reply.status(status);
      if (status === 429)
        reply.header(
          "Retry-After",
          String(
            error instanceof PlanError ? (error.retryAfterSeconds ?? 60) : 60,
          ),
        );
      if (status === 401) reply.header("WWW-Authenticate", "Bearer");
      if (status === 503) console.error("PLAN_DEPENDENCY_UNAVAILABLE");
      return {
        code: error instanceof PlanError ? error.code : "PLAN_UNAVAILABLE",
      };
    }
  }
  private token(authorization: string | undefined) {
    const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
    if (!match) throw new PlanError("UNAUTHORIZED");
    return match[1];
  }
  private async identify(request: FastifyRequest) {
    if (request.headers.authorization) {
      if (request.headers.cookie) throw new PlanError("INVALID_INPUT");
      return this.store.authenticate(this.token(request.headers.authorization));
    }
    if (!this.store.account) throw new PlanError("UNAUTHORIZED");
    if (
      request.method !== "GET" &&
      !trustedOrigin(request, this.store.account.config)
    )
      throw new PlanError("UNAUTHORIZED");
    const session = await accountSession(this.store.account.auth, request);
    return this.store.accountOwner(session.user.id);
  }
  @Post("plan-sessions")
  createSession(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      if (!planSessionRequestSchema.safeParse(body).success)
        throw new PlanError("INVALID_INPUT");
      reply.status(201);
      return this.store.createOwner(request.ip);
    });
  }
  @Delete("plan-sessions/current")
  revoke(
    @Headers("authorization") authorization: string | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.store.authenticate(this.token(authorization));
      await this.store.revoke(owner);
      reply.status(204);
    });
  }
  @Post("plans")
  submit(
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.identify(request);
      // Format 2 (multi-year rotations) and format 1 (two-cycle interface).
      const input = (
          isFormat2(body)
            ? rotationPlanCreateRequestSchema
            : planCreateRequestSchema
        ).safeParse(body),
        parsedKey = idempotencyKeySchema.safeParse(key);
      if (!input.success || !parsedKey.success)
        throw new PlanError("INVALID_INPUT");
      await this.store.boss.start();
      const { label, ...calculationInput } = input.data;
      const result = await this.store.submit(
        owner,
        parsedKey.data,
        calculationInput,
        undefined,
        label === undefined ? {} : { label },
      );
      reply.status(202).header("Location", `/api/v1/plans/${result.id}`);
      return result;
    });
  }
  // Body: { "what_if": { rainfall_change_percent, temperature_change_c,
  // sowing_shift_days } }. Creates a new plan from this plan's stored request.
  @Post("plans/:id/what-if")
  whatIf(
    @Param("id") id: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.identify(request);
      const parsedKey = idempotencyKeySchema.safeParse(key);
      const parsedBody = z
        .strictObject({ what_if: z.unknown() })
        .safeParse(body);
      if (
        !z.uuid().safeParse(id).success ||
        !parsedKey.success ||
        !parsedBody.success
      )
        throw new PlanError("INVALID_INPUT");
      await this.store.boss.start();
      const result = await this.store.submitWhatIf(
        owner,
        parsedKey.data,
        id,
        parsedBody.data.what_if,
      );
      reply.status(202).header("Location", `/api/v1/plans/${result.id}`);
      return result;
    });
  }
  @Get("plans/:id")
  read(
    @Param("id") id: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.identify(request);
      if (!z.uuid().safeParse(id).success) throw new PlanError("NOT_FOUND");
      const value = await this.store.read(owner, id);
      return reply
        .type("application/json; charset=utf-8")
        .send(this.store.serializeRead(value));
    });
  }
  @Put("plans/:id/label")
  label(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.identify(request);
      if (!z.uuid().safeParse(id).success) throw new PlanError("NOT_FOUND");
      const parsed = planLabelRequestSchema.safeParse(body);
      if (!parsed.success) throw new PlanError("INVALID_INPUT");
      return this.store.setLabel(owner, id, parsed.data.label);
    });
  }
  @Delete("plans/:id")
  remove(
    @Param("id") id: string,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      const owner = await this.identify(request);
      if (!z.uuid().safeParse(id).success) throw new PlanError("NOT_FOUND");
      await this.store.remove(owner, id);
      reply.status(204);
    });
  }
  @Get("plans")
  list(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(
      reply,
      request,
      async () => {
        const page = pageQuerySchema.safeParse(request.query);
        if (!page.success) throw new PlanError("INVALID_INPUT");
        const owner = await this.identify(request);
        return this.store.list(owner, page.data.cursor, page.data.limit);
      },
      true,
    );
  }
  @Post("plans/:id/claim")
  claim(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, request, async () => {
      if (
        !this.store.account ||
        !trustedOrigin(request, this.store.account.config)
      )
        throw new PlanError("UNAUTHORIZED");
      if (
        !z.uuid().safeParse(id).success ||
        !planClaimRequestSchema.safeParse(body).success
      )
        throw new PlanError("INVALID_INPUT");
      const session = await accountSession(
        this.store.account.auth,
        request,
        true,
      );
      const guest = await this.store.authenticate(
        this.token(request.headers.authorization),
      );
      const owner = await this.store.accountOwner(session.user.id);
      return this.store.claim(guest, owner, id);
    });
  }
}
