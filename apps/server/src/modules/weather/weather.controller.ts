import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { Config } from "../../config/environment.js";
import { APP_CONFIG } from "../../infrastructure/runtime.module.js";
import { validServerToken } from "../../common/security/server-token.js";
import { WeatherService } from "./application/weather.service.js";
import { weatherCapabilities } from "./application/weather-capabilities.js";
import { WeatherError } from "./providers/weather-provider.js";
@Controller("api/v1/internal/weather")
export class WeatherController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    private readonly weather: WeatherService,
  ) {}
  @Get("capabilities") capabilities(
    @Headers("x-weather-token") token: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!validServerToken(token, this.config.WEATHER_INTERNAL_TOKEN)) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }
    reply.header("cache-control", "no-store");
    return weatherCapabilities();
  }
  @Post("query")
  @HttpCode(200)
  async query(
    @Headers("x-weather-token") token: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    reply.header("cache-control", "no-store");
    if (!validServerToken(token, this.config.WEATHER_INTERNAL_TOKEN)) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }
    const cancelled = new AbortController();
    const onClose = () => {
      if (!reply.raw.writableEnded) cancelled.abort();
    };
    reply.raw.on("close", onClose);
    try {
      return await this.weather.query(body, cancelled.signal);
    } catch (error) {
      const code =
        error instanceof WeatherError
          ? error.code
          : "WEATHER_STORAGE_UNAVAILABLE";
      reply.status(
        code === "INVALID_WEATHER_REQUEST"
          ? 400
          : code === "WEATHER_BUSY"
            ? 429
            : code === "WEATHER_UPSTREAM_INVALID"
              ? 502
              : code === "WEATHER_TIMEOUT"
                ? 504
                : 503,
      );
      if (code === "WEATHER_BUSY") reply.header("retry-after", "1");
      return { code };
    } finally {
      reply.raw.off("close", onClose);
    }
  }
}
