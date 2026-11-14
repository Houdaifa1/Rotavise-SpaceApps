import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { weatherCapabilitiesSchema } from "@rotavise/contracts";
import type { Config } from "../../../config/environment.js";
import { quota } from "../../../common/security/quota.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import { WeatherService } from "../application/weather.service.js";
import { weatherCapabilities } from "../application/weather-capabilities.js";
import { WeatherError } from "../providers/weather-provider.js";

export function registerPublicWeatherRoutes(
  app: FastifyInstance,
  pool: Pool,
  config: Config,
  weather: WeatherService,
) {
  app.get("/api/v1/weather/capabilities", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as object).length)
      return reply.code(400).send({ code: "INVALID_INPUT" });
    return weatherCapabilitiesSchema.parse(weatherCapabilities());
  });
  app.post(
    "/api/v1/weather/query",
    { bodyLimit: 16384 },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const allowed = [
        config.AUTH_BASE_URL,
        ...config.AUTH_TRUSTED_ORIGINS.split(","),
      ].filter(Boolean);
      if (
        !allowed.includes(request.headers.origin) ||
        request.headers["content-type"]?.split(";")[0] !== "application/json" ||
        Object.keys(request.query as object).length
      )
        return reply.code(403).send({ code: "INVALID_ORIGIN_OR_CONTENT_TYPE" });
      try {
        await quota(pool, "weather-public:" + request.ip, 12, 3600);
        return await weather.query(request.body);
      } catch (error) {
        if (error instanceof PlanError && error.code === "RATE_LIMITED")
          return reply
            .header("Retry-After", "3600")
            .code(429)
            .send({ code: "RATE_LIMITED" });
        const code =
          error instanceof WeatherError
            ? error.code
            : "WEATHER_STORAGE_UNAVAILABLE";
        if (code !== "INVALID_WEATHER_REQUEST" && code !== "WEATHER_BUSY")
          console.error("PUBLIC_WEATHER_UNAVAILABLE", { category: code });
        const status =
          code === "INVALID_WEATHER_REQUEST"
            ? 400
            : code === "WEATHER_BUSY"
              ? 429
              : code === "WEATHER_UPSTREAM_INVALID"
                ? 502
                : code === "WEATHER_TIMEOUT"
                  ? 504
                  : 503;
        if (status === 429) reply.header("Retry-After", "1");
        return reply.code(status).send({ code });
      }
    },
  );
}
