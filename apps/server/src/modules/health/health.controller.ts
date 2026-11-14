import { Controller, Get, Inject, Optional, Res } from "@nestjs/common";
import { DataCompletenessService } from "./data-completeness.js";
import type { FastifyReply } from "fastify";
import type { PgBoss } from "pg-boss";
import {
  QUEUE_CLIENT,
  DEPENDENCY_CHECKS,
} from "../../infrastructure/runtime.module.js";
import { Ledger } from "../development-jobs/application/job-ledger.js";
import { WeatherService } from "../weather/application/weather.service.js";
import { PlanStore } from "../plans/application/plan-store.js";
import { APP_CONFIG } from "../../infrastructure/runtime.module.js";
import type { Config } from "../../config/environment.js";
@Controller(["api/v1/health", "health"])
export class HealthController {
  constructor(
    @Inject(QUEUE_CLIENT) private readonly boss: PgBoss,
    private readonly ledger: Ledger,
    private readonly completeness: DataCompletenessService,
    @Inject(DEPENDENCY_CHECKS)
    private readonly checks: Array<() => Promise<void>>,
    @Optional() private readonly weather?: WeatherService,
    @Optional() private readonly plans?: PlanStore,
    @Optional() @Inject(APP_CONFIG) private readonly config?: Config,
  ) {}
  @Get("live") live() {
    return { service: "rotavise-api", status: "live" };
  }
  @Get("ready") async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    let dependenciesReady = false;
    try {
      await this.boss.start();
      await this.ledger.ready();
      await this.weather?.ready();
      await this.plans?.ready();
      for (const check of this.checks) await check();
      dependenciesReady = true;
    } catch {
      /* Dependency failures remain unavailable. */
    }
    const dataCompleteness = await this.completeness.check();
    const flag = this.config?.DATA_COMPLETENESS_REQUIRED;
    const required = flag
      ? flag === "true"
      : this.config?.NODE_ENV === "production";
    const ready = dependenciesReady && (dataCompleteness.ok || !required);
    if (!ready) reply.status(503);
    return {
      service: "rotavise-api",
      status: ready ? "ready" : "unavailable",
      checkedAt: new Date().toISOString(),
      dependenciesReady,
      dataCompleteness,
    };
  }
}
