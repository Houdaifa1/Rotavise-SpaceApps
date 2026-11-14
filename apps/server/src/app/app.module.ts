import { Module, type DynamicModule } from "@nestjs/common";
import {
  RuntimeModule,
  type RuntimeResources,
} from "../infrastructure/runtime.module.js";
import { HealthModule } from "../modules/health/health.module.js";
import { WeatherModule } from "../modules/weather/weather.module.js";
import { DevelopmentJobsModule } from "../modules/development-jobs/development-jobs.module.js";
import type { WeatherService } from "../modules/weather/application/weather.service.js";
import { PlansModule } from "../modules/plans/plans.module.js";
import type { PlanStore } from "../modules/plans/application/plan-store.js";
@Module({})
export class AppModule {
  static register(
    resources: RuntimeResources,
    weather?: WeatherService,
    plans?: PlanStore,
  ): DynamicModule {
    const runtime = RuntimeModule.register(resources);
    const weatherModule = weather
      ? WeatherModule.register(runtime, weather)
      : undefined;
    const plansModule = plans ? PlansModule.register(plans) : undefined;
    return {
      module: AppModule,
      imports: [
        HealthModule.register(runtime, weatherModule, plansModule),
        ...(plansModule ? [plansModule] : []),
        ...(weatherModule ? [weatherModule] : []),
        ...(resources.config.DEV_HARNESS_ENABLED === "true"
          ? [DevelopmentJobsModule.register(runtime)]
          : []),
      ],
    };
  }
}
