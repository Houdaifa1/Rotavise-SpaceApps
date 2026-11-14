import type { FastifyInstance } from "fastify";
import { capabilitiesSchema } from "@rotavise/contracts";
import { GLOSSARY_VERSION } from "@rotavise/domain";
import type { DataCompleteness } from "@rotavise/contracts";
import type { DataCompletenessService } from "./data-completeness.js";
import type { Config } from "../../config/environment.js";

// Configuration discovery plus the shared database completeness gate.
export function capabilities(
  config: Config,
  dataCompleteness: DataCompleteness = {
    ok: false,
    checkedAt: new Date().toISOString(),
    incomplete: ["unchecked"],
    datasets: [],
  },
) {
  const plans = config.PLANS_ENABLED === "true";
  const email = config.AUTH_ENABLED === "true";
  const cropHealth =
    plans && !!config.ANTHROPIC_API_KEY && config.AI_DAILY_REQUEST_LIMIT > 0;
  return capabilitiesSchema.parse({
    version: "1",
    dataCompleteness,
    plans,
    auth: {
      email,
      google:
        email && !!config.GOOGLE_CLIENT_ID && !!config.GOOGLE_CLIENT_SECRET,
    },
    observations: config.OBSERVATIONS_ENABLED === "true",
    weather: config.WEATHER_ENABLED === "true",
    cropHealth: {
      available: cropHealth,
      reason: cropHealth ? null : "AI_NOT_CONFIGURED",
    },
    climateScenarios: config.CLIMATE_SCENARIOS_ENABLED === "true",
    fieldDetection: { available: config.FIELD_DETECTION_ENABLED === "true" },
    fieldBoundaries: {
      available: config.FIELD_BOUNDARIES_ENABLED === "true" && (plans || email),
    },
    glossaryVersion: GLOSSARY_VERSION,
    catalog: {
      id: config.PLAN_CATALOG_ID,
      version:
        config.PLANNING_ENABLED === "true"
          ? config.ROTATION_CATALOG_VERSION
          : config.PLAN_CATALOG_VERSION,
    },
  });
}

export function registerCapabilitiesRoutes(
  app: FastifyInstance,
  config: Config,
  completeness: DataCompletenessService,
) {
  app.get("/api/v1/capabilities", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (Object.keys(request.query as object).length)
      return reply.code(400).send({ code: "INVALID_INPUT" });
    return capabilities(config, await completeness.check());
  });
}
