import {
  installErrorLogging,
  errorLog,
  registerRequestLogging,
} from "../common/logging/operations-log.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { createPool } from "@rotavise/database";
import { trustProxySetting, type Config } from "../config/environment.js";
import { createBoss } from "../infrastructure/queue/pg-boss.js";
import { Ledger } from "../modules/development-jobs/application/job-ledger.js";
import { WeatherService } from "../modules/weather/application/weather.service.js";
import { SafeExceptionFilter } from "../common/http/safe-exception.filter.js";
import { registerSecurityHeaders } from "../common/http/security-headers.js";
import { registerCapabilitiesRoutes } from "../modules/health/capabilities.js";
import { DataCompletenessService } from "../modules/health/data-completeness.js";
import { AppModule } from "./app.module.js";
import { PlanStore } from "../modules/plans/application/plan-store.js";
import { MAX_PLAN_BODY_BYTES } from "../modules/plans/application/plan-policy.js";
import { createAuth } from "../modules/auth/application/auth.js";
import { registerAuthRoutes } from "../modules/auth/http/auth.routes.js";
import { FieldStore } from "../modules/fields/application/field-store.js";
import { registerFieldRoutes } from "../modules/fields/http/field.routes.js";
import { ObservationStore } from "../modules/earth-observations/application/observation-store.js";
import { ExtractionStore } from "../modules/earth-observations/application/extraction-store.js";
import { WaterStorageService } from "../modules/earth-observations/application/water-storage.service.js";
import { CanopyBiomassService } from "../modules/earth-observations/application/canopy-biomass.service.js";
import { AppeearsClient } from "../modules/earth-observations/providers/appeears/appeears.client.js";
import { GiovanniClient } from "../modules/earth-observations/providers/giovanni/giovanni.client.js";
import { PlanningStore } from "../modules/plans/application/planning-store.js";
import { authReady } from "../modules/auth/application/readiness.js";
import { CatalogStore } from "../modules/catalog/application/catalog-store.js";
import { registerCatalogRoutes } from "../modules/catalog/http/catalog.routes.js";
import { registerCropHealthRoutes } from "../modules/crop-health/crop-health.routes.js";
import { registerPublicWeatherRoutes } from "../modules/weather/http/weather-public.routes.js";
import { registerGlossaryRoutes } from "../modules/glossary/http/glossary.routes.js";
import { registerOpenApiRoutes } from "../modules/openapi/http/openapi.routes.js";
import { BoundaryStore } from "../modules/field-boundaries/application/boundary-store.js";
import { registerBoundaryRoutes } from "../modules/field-boundaries/http/boundary.routes.js";
export async function createApi(config: Config) {
  installErrorLogging();
  // Resolve before opening resources so a missing production choice fails fast.
  // Nest's adapter type omits Fastify's hop count; proxy-addr implements a hop
  // count as exactly this function.
  const trusted = trustProxySetting(config);
  const trustProxy =
    typeof trusted === "number"
      ? (_address: string, hop: number) => hop < trusted
      : trusted;
  const pool = createPool(config.DATABASE_URL);
  pool.on("error", () => console.error("DATABASE_UNAVAILABLE"));
  const completeness = new DataCompletenessService(pool);
  if (config.NODE_ENV === "production") {
    const data = await completeness.check();
    if (!data.ok)
      errorLog("DATABASE_INCOMPLETE", {
        event: "database_incomplete",
        incomplete: data.incomplete,
      });
  }
  const boss = createBoss(config);
  const ledger = new Ledger(pool, boss);
  const auth =
    config.AUTH_ENABLED === "true" ? createAuth(pool, config) : undefined;
  const planning =
    config.PLANS_ENABLED === "true"
      ? new PlanningStore(pool, boss, config)
      : undefined;
  const plans =
    config.PLANS_ENABLED === "true"
      ? new PlanStore(
          pool,
          boss,
          config.PLAN_CATALOG_ID,
          config.PLAN_CATALOG_VERSION,
          auth ? { auth, config } : undefined,
          planning,
        )
      : undefined;
  const weather =
    config.WEATHER_ENABLED === "true" ? new WeatherService(pool) : undefined;
  const observationWeather =
    config.OBSERVATIONS_ENABLED === "true"
      ? new WeatherService(pool)
      : undefined;
  const observations = observationWeather
    ? new ObservationStore(
        pool,
        boss,
        new AppeearsClient(
          config.EARTHDATA_USERNAME,
          config.EARTHDATA_PASSWORD,
        ),
        new GiovanniClient(
          config.EARTHDATA_USERNAME,
          config.EARTHDATA_PASSWORD,
        ),
        observationWeather,
      )
    : undefined;
  const extractions = observationWeather
    ? new ExtractionStore(
        pool,
        boss,
        new AppeearsClient(
          config.EARTHDATA_USERNAME,
          config.EARTHDATA_PASSWORD,
        ),
      )
    : undefined;
  const waterStorage = new WaterStorageService(pool);
  const canopyBiomass = new CanopyBiomassService(pool);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(
      {
        config,
        boss,
        ledger,
        completeness,
        checks: auth ? [() => authReady(pool)] : [],
      },
      weather,
      plans,
    ),
    new FastifyAdapter({
      bodyLimit: plans ? MAX_PLAN_BODY_BYTES : 2048,
      trustProxy,
      logger: false,
      allowErrorHandlerOverride: false,
    }),
    { logger: false, abortOnError: false },
  );
  app.useGlobalFilters(new SafeExceptionFilter());
  // Every route Fastify registers, so a test can compare them with the
  // OpenAPI document. Added first: the hook only sees routes added after it.
  const routes: { method: string; url: string }[] = [];
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRoute", (route) => {
      for (const method of [route.method].flat())
        routes.push({ method, url: route.url });
    });
  // Before any route registration, so every response carries the headers.
  registerRequestLogging(app.getHttpAdapter().getInstance());
  registerSecurityHeaders(
    app.getHttpAdapter().getInstance(),
    config.NODE_ENV === "production",
  );
  registerCapabilitiesRoutes(
    app.getHttpAdapter().getInstance(),
    config,
    completeness,
  );
  registerGlossaryRoutes(app.getHttpAdapter().getInstance());
  registerOpenApiRoutes(app.getHttpAdapter().getInstance());
  if (config.FIELD_BOUNDARIES_ENABLED === "true" && (auth || plans))
    registerBoundaryRoutes(
      app.getHttpAdapter().getInstance(),
      new BoundaryStore(pool),
      config,
      auth,
      plans,
    );
  if (auth)
    registerAuthRoutes(app.getHttpAdapter().getInstance(), auth, pool, config);
  if (auth || plans)
    registerFieldRoutes(
      app.getHttpAdapter().getInstance(),
      auth,
      new FieldStore(pool),
      config,
      observations,
      plans,
      extractions,
      waterStorage,
      canopyBiomass,
    );
  if (plans) {
    registerCatalogRoutes(app.getHttpAdapter().getInstance(), pool, config);
    registerCropHealthRoutes(app.getHttpAdapter().getInstance(), {
      store: plans,
      catalogs: new CatalogStore(pool),
      catalogId: config.PLAN_CATALOG_ID,
      catalogVersion: config.ROTATION_CATALOG_VERSION,
      apiKey: config.ANTHROPIC_API_KEY,
      model: config.ANTHROPIC_MODEL,
      dailyLimit: config.AI_DAILY_REQUEST_LIMIT,
    });
  }
  if (weather)
    registerPublicWeatherRoutes(
      app.getHttpAdapter().getInstance(),
      pool,
      config,
      weather,
    );
  await app.init();
  return {
    app,
    ledger,
    plans,
    auth,
    pool,
    boss,
    routes,
    async close() {
      await weather?.close();
      await observationWeather?.close();
      await planning?.weather.close();
      await app.close();
      await boss.stop();
      await pool.end();
    },
  };
}
