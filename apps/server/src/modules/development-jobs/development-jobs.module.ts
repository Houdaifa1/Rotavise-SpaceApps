import { Module, type DynamicModule } from "@nestjs/common";
import { DevelopmentJobsController } from "./development-jobs.controller.js";
@Module({})
export class DevelopmentJobsModule {
  static register(runtime: DynamicModule): DynamicModule {
    return {
      module: DevelopmentJobsModule,
      imports: [runtime],
      controllers: [DevelopmentJobsController],
    };
  }
}
