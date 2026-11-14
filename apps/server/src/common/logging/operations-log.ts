import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { WorkHandler } from "pg-boss";
import { GLOSSARY } from "@rotavise/domain";

const context = new AsyncLocalStorage<{ requestId: string }>();
const publicCodes = new Set(GLOSSARY.map((entry) => entry.code));
// Compatibility boundary for existing diagnostics. Never serialize arbitrary
// arguments, error objects, SQL, provider replies, headers or request bodies.
const diagnosticCodes = new Set([
  "DATABASE_UNAVAILABLE",
  "DATABASE_INCOMPLETE",
  "QUEUE_UNAVAILABLE",
  "API_INTERNAL_ERROR",
  "API_START_FAILED",
  "WORKER_START_FAILED",
  "MIGRATION_FAILED",
  "MAIL_DELIVERY_FAILED",
  "MAIL_EXPIRED_OR_EXHAUSTED",
  "MAIL_DEPENDENCY_UNAVAILABLE",
  "WORKER_DEPENDENCY_UNAVAILABLE",
  "WEATHER_UPSTREAM_FAILURE",
  "WEATHER_LEASE_RELEASE_UNAVAILABLE",
  "PUBLIC_WEATHER_UNAVAILABLE",
  "FIELD_DEPENDENCY_UNAVAILABLE",
  "PLAN_DEPENDENCY_UNAVAILABLE",
  "CATALOG_OPTIONS_UNAVAILABLE",
  "AUTH_DEPENDENCY_UNAVAILABLE",
  "CROP_HEALTH_UNAVAILABLE",
  "SCIENCE_WEATHER_INCOMPLETE",
  "SCIENCE_SERVICE_REJECTED",
  "SCIENCE_SERVICE_UNAVAILABLE",
]);
const stderr = console.error.bind(console);
let installed = false;
const safeCode = (code: unknown) =>
  typeof code === "string" &&
  (publicCodes.has(code) || diagnosticCodes.has(code))
    ? code
    : "INTERNAL_ERROR";

export function errorLog(
  code: unknown,
  fields: {
    event?:
      "http_error" | "job_failure" | "runtime_error" | "database_incomplete";
    incomplete?: readonly string[];
    requestId?: string;
    status?: number;
    count?: number;
  } = {},
) {
  stderr(
    JSON.stringify({
      at: new Date().toISOString(),
      level: "error",
      event: fields.event ?? "runtime_error",
      code: safeCode(code),
      ...(context.getStore() ?? {}),
      ...(fields.requestId && /^[a-f0-9-]{36}$/.test(fields.requestId)
        ? { requestId: fields.requestId }
        : {}),
      ...(Number.isInteger(fields.status) ? { status: fields.status } : {}),
      ...(Number.isInteger(fields.count) ? { count: fields.count } : {}),
      ...(fields.incomplete
        ? {
            incomplete: fields.incomplete.filter((dataset) =>
              [
                "database",
                "migrations",
                "catalogs",
                "triggers",
                "indexes",
                "constraints",
                "autovacuum",
                "climateMidCentury",
                "climateNearTerm",
                "climateUnits",
                "grace",
                "gedi",
              ].includes(dataset),
            ),
          }
        : {}),
    }),
  );
}

export function installErrorLogging() {
  if (installed) return;
  installed = true;
  console.error = (...args: unknown[]) => {
    let code: unknown = args[0];
    if (typeof code === "string" && code.startsWith("{")) {
      try {
        code = (JSON.parse(code) as { code?: unknown }).code;
      } catch {
        code = undefined;
      }
    }
    errorLog(code);
  };
}

// Entrypoints opt in, so an unexpected fatal error cannot print an exception
// containing request data. Preserve the process's failure exit semantics.
export function installFatalErrorLogging() {
  installErrorLogging();
  const fatal = () => {
    errorLog("INTERNAL_ERROR");
    process.exit(1);
  };
  process.once("uncaughtException", fatal);
  process.once("unhandledRejection", fatal);
}

export function registerRequestLogging(app: FastifyInstance) {
  app.addHook("onRequest", (request, reply, done) => {
    // Ignore client-supplied IDs: they can contain personal data or secrets.
    request.id = randomUUID();
    reply.header("X-Request-Id", request.id);
    context.run({ requestId: request.id }, done);
  });
  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 400) {
      let code: unknown;
      if (typeof payload === "string") {
        try {
          code = (JSON.parse(payload) as { code?: unknown }).code;
        } catch {
          /* non-JSON error responses get the generic code */
        }
      }
      errorLog(code, {
        event: "http_error",
        requestId: request.id,
        status: reply.statusCode,
      });
    }
    return payload;
  });
}

export function loggedHandler<T>(handler: WorkHandler<T>): WorkHandler<T> {
  return async (jobs) => {
    try {
      return await handler(jobs);
    } catch (error) {
      errorLog("CALCULATION_FAILED", { event: "job_failure" });
      throw error; // pg-boss still retries/fails with its original semantics.
    }
  };
}
