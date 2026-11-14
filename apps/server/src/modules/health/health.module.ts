import { Module, type DynamicModule } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
@Module({})
export class HealthModule {
  static register(
    runtime: DynamicModule,
    weather?: DynamicModule,
    plans?: DynamicModule,
  ): DynamicModule {
    return {
      module: HealthModule,
      imports: [
        runtime,
        ...(weather ? [weather] : []),
        ...(plans ? [plans] : []),
      ],
      controllers: [HealthController],
    };
  }
}
