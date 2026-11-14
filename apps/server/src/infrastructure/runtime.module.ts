import { Module, type DynamicModule } from "@nestjs/common";
import type { PgBoss } from "pg-boss";
import type { Config } from "../config/environment.js";
import { DataCompletenessService } from "../modules/health/data-completeness.js";
import { Ledger } from "../modules/development-jobs/application/job-ledger.js";
export const APP_CONFIG = Symbol("APP_CONFIG");
export const QUEUE_CLIENT = Symbol("QUEUE_CLIENT");
export const DEPENDENCY_CHECKS = Symbol("DEPENDENCY_CHECKS");
export interface RuntimeResources {
  config: Config;
  boss: PgBoss;
  ledger: Ledger;
  checks?: Array<() => Promise<void>>;
  completeness: DataCompletenessService;
}
@Module({})
export class RuntimeModule {
  static register(resources: RuntimeResources): DynamicModule {
    return {
      module: RuntimeModule,
      providers: [
        { provide: DataCompletenessService, useValue: resources.completeness },
        { provide: APP_CONFIG, useValue: resources.config },
        { provide: QUEUE_CLIENT, useValue: resources.boss },
        { provide: Ledger, useValue: resources.ledger },
        { provide: DEPENDENCY_CHECKS, useValue: resources.checks ?? [] },
      ],
      exports: [
        APP_CONFIG,
        QUEUE_CLIENT,
        Ledger,
        DEPENDENCY_CHECKS,
        DataCompletenessService,
      ],
    };
  }
}
