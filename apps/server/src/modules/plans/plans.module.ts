import { Module, type DynamicModule } from "@nestjs/common";
import { PlansController } from "./plans.controller.js";
import { PlanStore } from "./application/plan-store.js";
@Module({})
export class PlansModule {
  static register(store: PlanStore): DynamicModule {
    return {
      module: PlansModule,
      providers: [{ provide: PlanStore, useValue: store }],
      exports: [PlanStore],
      controllers: [PlansController],
    };
  }
}
