import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { PgBoss } from "pg-boss";
import {
  syntheticInputSchema,
  idempotencyKeySchema,
  runIdSchema,
} from "@rotavise/contracts";
import type { Config } from "../../config/environment.js";
import {
  APP_CONFIG,
  QUEUE_CLIENT,
} from "../../infrastructure/runtime.module.js";
import { validServerToken } from "../../common/security/server-token.js";
import { Ledger, ConflictError } from "./application/job-ledger.js";
@Controller("api/v1/dev/test-jobs")
export class DevelopmentJobsController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(QUEUE_CLIENT) private readonly boss: PgBoss,
    private readonly ledger: Ledger,
  ) {}
  @Post()
  @HttpCode(202)
  async submit(
    @Headers("x-dev-token") token: string | undefined,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!validServerToken(token, this.config.DEV_HARNESS_TOKEN)) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }
    const input = syntheticInputSchema.safeParse(body),
      parsedKey = idempotencyKeySchema.safeParse(key);
    if (!input.success || !parsedKey.success) {
      reply.status(400);
      return { code: "INVALID_INPUT" };
    }
    try {
      await this.boss.start();
      return { id: await this.ledger.submit(parsedKey.data, input.data) };
    } catch (error) {
      reply.status(error instanceof ConflictError ? 409 : 503);
      return {
        code:
          error instanceof ConflictError
            ? "IDEMPOTENCY_CONFLICT"
            : "SUBMISSION_UNAVAILABLE",
      };
    }
  }
  @Get(":id") async read(
    @Headers("x-dev-token") token: string | undefined,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!validServerToken(token, this.config.DEV_HARNESS_TOKEN)) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }
    if (!runIdSchema.safeParse(id).success) {
      reply.status(400);
      return { code: "INVALID_ID" };
    }
    try {
      const run = await this.ledger.read(id);
      if (!run) {
        reply.status(404);
        return { code: "NOT_FOUND" };
      }
      return run;
    } catch {
      reply.status(503);
      return { code: "LOOKUP_UNAVAILABLE" };
    }
  }
}
