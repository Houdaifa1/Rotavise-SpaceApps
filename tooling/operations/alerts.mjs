import { createRequire } from "node:module";
import { readEnvFile } from "./lib.mjs";

const requireServerDependency = createRequire(
  new URL("../../apps/server/package.json", import.meta.url),
);
const { z } = requireServerDependency("zod");

export const providerNames = [
  "nasa-power",
  "nex-gddp-cmip6",
  "soilgrids",
  "hls",
  "smap",
  "gpm",
  "terrain",
  "ecostress",
  "modis",
  "grace",
  "gedi",
];
const count = z.number().int().nonnegative();
const instant = z.iso.datetime();
const metricsSchema = z.object({
  checkedAt: instant,
  queue: z.object({
    depth: count,
    active: count,
    failed: count,
    oldestWaitingSeconds: z.number().nonnegative().finite(),
  }),
  failedJobs: z.array(
    z.object({
      source: z.enum([
        "queue",
        "intake",
        "planning",
        "observations",
        "extractions",
        "mail",
        "tiles",
        "development",
      ]),
      count,
    }),
  ),
  ingests: z.array(
    z.object({
      provider: z.enum(providerNames),
      lastSuccessAt: instant.nullable(),
    }),
  ),
  climateTiles: z.array(
    z.object({
      status: z.enum(["requested", "preparing", "ready", "failed"]),
      count,
      unitsReady: count,
      unitsTotal: count,
      oldestUpdateAt: instant,
    }),
  ),
  disk: z.object({ freeBytes: count, totalBytes: count }),
});
export const parseMetrics = (value) => metricsSchema.parse(value);

const policySchema = z.object({
  OPS_INGEST_MAX_AGE_HOURS: z
    .string()
    .transform((v) => JSON.parse(v))
    .pipe(
      z.partialRecord(z.enum(providerNames), z.number().positive().finite()),
    )
    .default({}),
  OPS_QUEUE_DEPTH_LIMIT: z.coerce.number().int().nonnegative().optional(),
  OPS_TILE_MAX_IDLE_MINUTES: z.coerce.number().positive().finite().optional(),
});
export function metricChecks(metrics, env = {}, now = new Date()) {
  const policy = policySchema.parse(env);
  const failed = metrics.failedJobs.reduce((sum, row) => sum + row.count, 0);
  const checks = {
    failed_jobs: {
      ok: failed === 0,
      detail: `${failed} retained failures (queue and application records can overlap)`,
    },
    queue_depth: {
      ok:
        policy.OPS_QUEUE_DEPTH_LIMIT === undefined ||
        metrics.queue.depth <= policy.OPS_QUEUE_DEPTH_LIMIT,
      detail: `${metrics.queue.depth} waiting, ${metrics.queue.active} active`,
    },
    climate_tiles: {
      ok: metrics.climateTiles.every(
        (row) =>
          row.status !== "failed" &&
          (policy.OPS_TILE_MAX_IDLE_MINUTES === undefined ||
            !["requested", "preparing"].includes(row.status) ||
            (now - new Date(row.oldestUpdateAt)) / 60000 <=
              policy.OPS_TILE_MAX_IDLE_MINUTES),
      ),
      detail:
        metrics.climateTiles
          .map(
            (r) =>
              `${r.status}=${r.count} (${r.unitsReady}/${r.unitsTotal} units)`,
          )
          .join(", ") || "no tiles requested",
    },
  };
  for (const [provider, hours] of Object.entries(
    policy.OPS_INGEST_MAX_AGE_HOURS,
  )) {
    const instant = metrics.ingests.find(
      (row) => row.provider === provider,
    )?.lastSuccessAt;
    const age = instant ? (now - new Date(instant)) / 3600000 : Infinity;
    checks[`ingest_${provider}`] = {
      ok: Number.isFinite(age) && age <= hours,
      detail: instant
        ? `last successful ingest ${instant}`
        : "no successful ingest retained",
    };
  }
  return checks;
}

const smtpSchema = z
  .object({
    OPS_ALERT_TO: z.email(),
    MAIL_FROM: z.email(),
    SMTP_HOST: z.string().min(1).max(253),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_TLS: z.enum(["implicit", "starttls"]),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .refine((env) => !!env.SMTP_USER === !!env.SMTP_PASSWORD);

// The default is off. Supplying a transport in tests exercises messages without
// opening a socket. No SMTP errors/addresses/credentials are printed.
export async function sendAlert(env, messages, makeTransport) {
  if (!env.OPS_ALERT_TO || messages.length === 0) return { sent: false };
  const parsed = smtpSchema.safeParse(env);
  if (!parsed.success) throw new Error("ALERT_SMTP_CONFIG_INVALID");
  const config = parsed.data;
  const factory =
    makeTransport ?? requireServerDependency("nodemailer").createTransport;
  const transport = factory({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_TLS === "implicit",
    requireTLS: config.SMTP_TLS === "starttls",
    ...(config.SMTP_USER
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 3000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: config.MAIL_FROM,
      to: config.OPS_ALERT_TO,
      subject: "Rotavise operations alert",
      text: messages.join("\n"),
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw new Error("rejected");
    return { sent: true };
  } catch {
    throw new Error("ALERT_MAIL_DELIVERY_FAILED");
  } finally {
    transport.close();
  }
}

export async function alertFromFile(config, messages) {
  return sendAlert(await readEnvFile(config.envFile), messages);
}
