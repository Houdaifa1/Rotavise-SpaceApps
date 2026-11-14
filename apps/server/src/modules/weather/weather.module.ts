import { Module, type DynamicModule } from "@nestjs/common";
import { WeatherService } from "./application/weather.service.js";
import { WeatherController } from "./weather.controller.js";
@Module({})
export class WeatherModule {
  static register(
    runtime: DynamicModule,
    service: WeatherService,
  ): DynamicModule {
    return {
      module: WeatherModule,
      imports: [runtime],
      controllers: [WeatherController],
      providers: [{ provide: WeatherService, useValue: service }],
      exports: [WeatherService],
    };
  }
}
