import {
  installErrorLogging,
  loggedHandler,
  errorLog,
} from "../common/logging/operations-log.js";
import {
  operationsStatus,
  failureReporter,
} from "../modules/health/operations-status.js";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createPool } from "@rotavise/database";
import type { Config } from "../config/environment.js";
import {
  createBoss,
  QUEUE,
  PLAN_QUEUE,
  PLANNING_QUEUE,
  SCENARIO_QUEUE,
  OBSERVATION_QUEUE,
  EXTRACTION_QUEUE,
} from "../infrastructure/queue/pg-boss.js";
import { ExtractionStore } from "../modules/earth-observations/application/extraction-store.js";
import { createExtractionHandler } from "../modules/earth-observations/worker/extraction.handler.js";
import { ObservationStore } from "../modules/earth-observations/application/observation-store.js";
import { AppeearsClient } from "../modules/earth-observations/providers/appeears/appeears.client.js";
import { GiovanniClient } from "../modules/earth-observations/providers/giovanni/giovanni.client.js";
import { createObservationHandler } from "../modules/earth-observations/worker/observation.handler.js";
import { WeatherService } from "../modules/weather/application/weather.service.js";
import { Ledger } from "../modules/development-jobs/application/job-ledger.js";
import { createEchoHandler } from "../modules/development-jobs/worker/echo.handler.js";
import { PlanStore } from "../modules/plans/application/plan-store.js";
import { createIntakeHandler } from "../modules/plans/worker/intake.handler.js";
import { MailWorker } from "../modules/auth/worker/mail.worker.js";
import {
  PlanningStore,
  currentFutureClimatePolicy as futureClimatePolicy,
} from "../modules/plans/application/planning-store.js";
import {
  createScenarioHandler,
  enqueueTile,
} from "../modules/climate-scenarios/worker/scenario.handler.js";
import { createPlanningHandler } from "../modules/plans/worker/planning.handler.js";
import { pruneWeatherEvidence } from "../modules/weather/application/weather-retention.js";
export async function startWorker(config: Config) {
  installErrorLogging();
  const pool = createPool(config.DATABASE_URL);
  pool.on("error", () => console.error("DATABASE_UNAVAILABLE"));
  const boss = createBoss(config, false, true);
  const reportFailures = failureReporter(pool);
  const ledger = new Ledger(pool, boss);
  const mail =
    config.AUTH_ENABLED === "true" ? new MailWorker(pool, config) : undefined;
  const planning =
    config.PLANS_ENABLED === "true"
      ? new PlanningStore(pool, boss, config)
      : undefined;
  let mailing = false;
  let mailTimer: ReturnType<typeof setTimeout> | undefined;
  const mailCycle = async () => {
    mailing = true;
    try {
      await mail?.tick();
    } catch {
      console.error("MAIL_DEPENDENCY_UNAVAILABLE");
    } finally {
      mailing = false;
      if (!stopping) mailTimer = setTimeout(() => void mailCycle(), 500);
    }
  };
  const plans =
    config.PLANS_ENABLED === "true"
      ? new PlanStore(
          pool,
          boss,
          config.PLAN_CATALOG_ID,
          config.PLAN_CATALOG_VERSION,
          undefined,
          planning,
        )
      : undefined;
  let lastCheck = 0;
  // Weather retention needs no per-second precision; its margins are a day.
  let lastPrune = 0;
  let lastScenarioResume = 0;
  let lastObservationPickup = 0;
  let lastExtractionPickup = 0;
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
  const scenarios =
    planning && config.CLIMATE_SCENARIOS_ENABLED === "true"
      ? planning.scenarios
      : undefined;
  let stopping = false;
  let cycling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cycle = async () => {
    cycling = true;
    try {
      await ledger.ready();
      await ledger.reconcile();
      await plans?.ready();
      await plans?.maintain();
      await mail?.ready();
      await mail?.maintain();
      await planning?.ready();
      await planning?.maintain();
      if (Date.now() - lastPrune >= 600000) {
        await pruneWeatherEvidence(pool);
        lastPrune = Date.now();
      }
      // New observation requests are queued here, with the worker's queue
      // connection; the stately queue keeps one job per observation.
      if (observations && Date.now() - lastObservationPickup >= 5000) {
        for (const id of await observations.fresh())
          await observations.enqueue(id);
        lastObservationPickup = Date.now();
      }
      if (extractions && Date.now() - lastExtractionPickup >= 5000) {
        for (const id of await extractions.fresh())
          await extractions.enqueue(id);
        lastExtractionPickup = Date.now();
      }
      // Tiles whose slice job was lost are queued again.
      if (
        (scenarios || observations) &&
        Date.now() - lastScenarioResume >= 600000
      ) {
        for (const tile of (await scenarios?.stale(futureClimatePolicy)) ?? [])
          await enqueueTile(boss, tile, futureClimatePolicy);
        // Observations whose next step job was lost are queued again.
        for (const id of (await observations?.stale()) ?? [])
          await observations!.enqueue(id);
        for (const id of (await extractions?.stale()) ?? [])
          await extractions!.enqueue(id);
        lastScenarioResume = Date.now();
      }
      await reportFailures();
      lastCheck = Date.now();
    } catch {
      lastCheck = 0;
      console.error("WORKER_DEPENDENCY_UNAVAILABLE");
    } finally {
      cycling = false;
      if (!stopping) timer = setTimeout(() => void cycle(), 1000);
    }
  };
  const health = createServer((req, res) => {
    if (
      req.url === "/health/operations" &&
      ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      )
    ) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      void operationsStatus(pool).then(
        (status) => {
          res.writeHead(200);
          res.end(JSON.stringify(status));
        },
        () => {
          errorLog("WORKER_DEPENDENCY_UNAVAILABLE");
          res.writeHead(503);
          res.end(JSON.stringify({ code: "INTERNAL_ERROR" }));
        },
      );
      return;
    }
    const live = req.url === "/health/live";
    const ready = req.url === "/health/ready";
    res.setHeader("Content-Type", "application/json");
    if (!live && !ready) {
      errorLog("NOT_FOUND", { status: 404 });
      res.writeHead(404);
      res.end(JSON.stringify({ code: "NOT_FOUND" }));
      return;
    }
    const ok =
      live || (!stopping && lastCheck > 0 && Date.now() - lastCheck < 5000);
    if (!ok) errorLog("WORKER_DEPENDENCY_UNAVAILABLE", { status: 503 });
    res.writeHead(ok ? 200 : 503);
    res.end(
      JSON.stringify({
        service: "rotavise-worker",
        status: ok ? (live ? "live" : "ready") : "unavailable",
        checkedAt: lastCheck ? new Date(lastCheck).toISOString() : null,
      }),
    );
  });
  await boss.start();
  await ledger.ready();
  await plans?.ready();
  await boss.work(
    QUEUE,
    { pollingIntervalSeconds: 0.5, batchSize: 1 },
    loggedHandler(createEchoHandler(ledger, config)),
  );
  if (plans)
    await boss.work(
      PLAN_QUEUE,
      // A worker sleeps its polling interval after every job, so one worker
      // handles about two plan intakes a second. Intake is short and
      // database-bound, so a few workers in parallel raise that without
      // lowering the interval.
      { pollingIntervalSeconds: 0.5, batchSize: 1, localConcurrency: 8 },
      loggedHandler(createIntakeHandler(plans, config)),
    );
  if (planning && plans)
    await boss.work(
      PLANNING_QUEUE,
      { pollingIntervalSeconds: 0.5, batchSize: 1 },
      loggedHandler(createPlanningHandler(plans, config)),
    );
  if (observations) {
    if (!(await boss.getQueue(OBSERVATION_QUEUE)))
      throw new Error("OBSERVATION_QUEUE_UNAVAILABLE");
    await boss.work(
      OBSERVATION_QUEUE,
      { pollingIntervalSeconds: 5, batchSize: 1, localConcurrency: 2 },
      loggedHandler(createObservationHandler(observations)),
    );
  }
  if (extractions) {
    if (!(await boss.getQueue(EXTRACTION_QUEUE)))
      throw new Error("EXTRACTION_QUEUE_UNAVAILABLE");
    await boss.work(
      EXTRACTION_QUEUE,
      { pollingIntervalSeconds: 5, batchSize: 1, localConcurrency: 2 },
      loggedHandler(createExtractionHandler(extractions)),
    );
  }
  if (scenarios) {
    if (!(await boss.getQueue(SCENARIO_QUEUE)))
      throw new Error("SCENARIO_QUEUE_UNAVAILABLE");
    // One tile at a time per worker keeps upstream load bounded.
    await boss.work(
      SCENARIO_QUEUE,
      { pollingIntervalSeconds: 5, batchSize: 1, localConcurrency: 1 },
      loggedHandler(
        createScenarioHandler(scenarios, boss, config, futureClimatePolicy),
      ),
    );
  }
  await new Promise<void>((resolve) =>
    health.listen(config.WORKER_PORT, config.WORKER_HOST, resolve),
  );
  await cycle();
  if (mail) void mailCycle();
  console.log(
    JSON.stringify({ event: "worker_ready", port: config.WORKER_PORT }),
  );
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    if (timer) clearTimeout(timer);
    if (mailTimer) clearTimeout(mailTimer);
    await new Promise<void>((resolve) => health.close(() => resolve()));
    await boss.stop({ graceful: true, timeout: 5000 });
    await planning?.weather.close();
    await observationWeather?.close();
    while (cycling) await delay(20);
    while (mailing) await delay(20);
    mail?.close();
    await pool.end();
    console.log(JSON.stringify({ event: "WORKER_STOPPED" }));
  };
  return { stop };
}
