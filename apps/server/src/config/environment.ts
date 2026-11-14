import { isIP } from "node:net";
import { z } from "zod";
const port = z.coerce.number().int().min(1).max(65535);
// Fastify trustProxy: "false", 1–9 trusted hops, or explicit proxy addresses or
// CIDR ranges. "true" is refused: any client could then choose its own address.
export function parseTrustProxy(value: string): false | number | string | null {
  if (value === "false") return false;
  if (/^[1-9]$/.test(value)) return Number(value);
  const entries = value.split(",").map((entry) => entry.trim());
  const valid = entries.every((entry) => {
    const [address, prefix, extra] = entry.split("/");
    const family = isIP(address ?? "");
    if (!family || extra !== undefined) return false;
    return (
      prefix === undefined ||
      (/^\d{1,3}$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128))
    );
  });
  return valid ? entries.join(",") : null;
}
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.string().refine((v) => {
      try {
        const url = new URL(v);
        return (
          ["postgres:", "postgresql:"].includes(url.protocol) &&
          !!url.hostname &&
          url.pathname.length > 1
        );
      } catch {
        return false;
      }
    }),
    API_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
    API_PORT: port.default(3000),
    TRUST_PROXY: z
      .string()
      .max(1000)
      .optional()
      .refine((v) => v === undefined || parseTrustProxy(v) !== null),
    WORKER_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
    WORKER_PORT: port.default(3001),
    DEV_HARNESS_ENABLED: z.enum(["true", "false"]).default("false"),
    DEV_HARNESS_TOKEN: z.string().min(32).max(256).optional(),
    WEATHER_ENABLED: z.enum(["true", "false"]).default("false"),
    WEATHER_INTERNAL_TOKEN: z.string().min(32).max(256).optional(),
    PLANS_ENABLED: z.enum(["true", "false"]).default("false"),
    PLANNING_ENABLED: z.enum(["true", "false"]).default("false"),
    // NEX-GDDP-CMIP6 tile preparation by the worker (NCCS THREDDS; no account).
    CLIMATE_SCENARIOS_ENABLED: z.enum(["true", "false"]).default("false"),
    SCENARIO_FETCH_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(8)
      .default(2),
    // New tiles plans may request per rolling day; each is about 1,350 requests.
    SCENARIO_TILES_PER_DAY: z.coerce.number().int().min(0).max(50).default(4),
    // Claude for photo checks and plain-language explanations; server-only.
    // Spaces or line breaks around a pasted key are removed; any inside it are
    // refused at start-up, not as a confusing error on the first photo.
    ANTHROPIC_API_KEY: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[\x21-\x7e]+$/)
      .optional(),
    // Provider model id for the photo check and explanations.
    ANTHROPIC_MODEL: z
      .string()
      .regex(/^claude-[a-z0-9.-]{1,60}$/)
      .optional(),
    // Claude calls allowed per rolling day across all users; 0 turns them off.
    AI_DAILY_REQUEST_LIMIT: z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(300),
    // Internal science service (AquaCrop); without it plans have no yields.
    SCIENCE_URL: z.url().optional(),
    // NASA Earthdata Login (AppEEARS, GES DISC): server-only, never logged.
    EARTHDATA_USERNAME: z.string().min(1).max(100).optional(),
    EARTHDATA_PASSWORD: z.string().min(1).max(256).optional(),
    // Field satellite history, soil moisture and rain (needs accounts and
    // Earthdata credentials).
    OBSERVATIONS_ENABLED: z.enum(["true", "false"]).default("false"),
    // Enable only once the field-detection service is installed (BG-13/B2).
    FIELD_DETECTION_ENABLED: z.enum(["true", "false"]).default("false"),
    FIELD_BOUNDARIES_ENABLED: z.enum(["true", "false"]).default("false"),
    // Readiness fails while data is incomplete: required by default in production only. Development and test databases are reported but not blocked unless this is "true".
    DATA_COMPLETENESS_REQUIRED: z.enum(["true", "false"]).optional(),
    AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
    AUTH_SECRET: z.string().min(48).max(256).optional(),
    AUTH_BASE_URL: z.url().optional(),
    AUTH_TRUSTED_ORIGINS: z.string().max(2000).default(""),
    GOOGLE_CLIENT_ID: z.string().min(10).max(300).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(10).max(300).optional(),
    SMTP_HOST: z.string().min(1).max(253).optional(),
    SMTP_PORT: port.default(1025),
    SMTP_TLS: z.enum(["implicit", "starttls", "local"]).default("starttls"),
    SMTP_USER: z.string().max(256).optional(),
    SMTP_PASSWORD: z.string().max(1024).optional(),
    MAIL_FROM: z.email().optional(),
    PLAN_CATALOG_ID: z
      .string()
      .regex(/^[a-z][a-z0-9-]{2,79}$/)
      .default("rotavise-pilot"),
    // Format 2 catalog used by rotation (format 2) requests.
    ROTATION_CATALOG_VERSION: z
      .string()
      .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
      .max(40)
      .default("0.15.0"),
    PLAN_CATALOG_VERSION: z
      .string()
      .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
      .max(40)
      .default("0.1.0"),
    TEST_PLAN_WORKER_FAULT: z
      .enum(["none", "transient", "terminal", "pause"])
      .default("none"),
    TEST_WORKER_FAULT: z
      .enum(["none", "transient", "terminal", "pause"])
      .default("none"),
  })
  .superRefine((v, ctx) => {
    if (
      v.OBSERVATIONS_ENABLED === "true" &&
      ((v.AUTH_ENABLED !== "true" && v.PLANS_ENABLED !== "true") ||
        !v.EARTHDATA_USERNAME)
    )
      ctx.addIssue({
        code: "custom",
        path: ["OBSERVATIONS_ENABLED"],
        message: "accounts or plans, and Earthdata credentials, required",
      });
    if (!!v.EARTHDATA_USERNAME !== !!v.EARTHDATA_PASSWORD)
      ctx.addIssue({
        code: "custom",
        path: ["EARTHDATA_USERNAME"],
        message: "Earthdata credentials must be paired",
      });
    if (v.CLIMATE_SCENARIOS_ENABLED === "true" && v.PLANNING_ENABLED !== "true")
      ctx.addIssue({
        code: "custom",
        path: ["CLIMATE_SCENARIOS_ENABLED"],
        message: "planning required",
      });
    if (v.PLANNING_ENABLED === "true" && v.PLANS_ENABLED !== "true")
      ctx.addIssue({
        code: "custom",
        path: ["PLANNING_ENABLED"],
        message: "plans required",
      });
    if (v.AUTH_BASE_URL) {
      const url = new URL(v.AUTH_BASE_URL);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        (v.NODE_ENV === "production" && url.protocol !== "https:") ||
        (url.protocol !== "https:" &&
          !(
            v.NODE_ENV !== "production" &&
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname)
          ))
      )
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_BASE_URL"],
          message: "invalid",
        });
    }
    for (const origin of v.AUTH_TRUSTED_ORIGINS.split(",").filter(Boolean)) {
      try {
        const url = new URL(origin);
        if (
          url.origin !== origin ||
          (v.NODE_ENV === "production" && url.protocol !== "https:") ||
          !["http:", "https:"].includes(url.protocol)
        )
          throw new Error("invalid");
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_TRUSTED_ORIGINS"],
          message: "invalid",
        });
      }
    }
    if (v.AUTH_ENABLED === "true") {
      if (!!v.GOOGLE_CLIENT_ID !== !!v.GOOGLE_CLIENT_SECRET)
        ctx.addIssue({
          code: "custom",
          path: ["GOOGLE_CLIENT_ID"],
          message: "Google credentials must be paired",
        });
      for (const key of [
        "AUTH_SECRET",
        "AUTH_BASE_URL",
        "SMTP_HOST",
        "MAIL_FROM",
      ] as const)
        if (!v[key])
          ctx.addIssue({ code: "custom", path: [key], message: "required" });
      if (
        v.SMTP_TLS === "local" &&
        (v.NODE_ENV === "production" ||
          !["localhost", "127.0.0.1"].includes(v.SMTP_HOST ?? ""))
      )
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_TLS"],
          message: "invalid",
        });
      if (!!v.SMTP_USER !== !!v.SMTP_PASSWORD)
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_PASSWORD"],
          message: "invalid",
        });
    }
    if (
      (v.GOOGLE_CLIENT_ID || v.GOOGLE_CLIENT_SECRET) &&
      v.AUTH_ENABLED !== "true"
    )
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_ENABLED"],
        message: "Google requires accounts",
      });
    if (
      v.TEST_PLAN_WORKER_FAULT !== "none" &&
      (v.NODE_ENV !== "test" ||
        v.DEV_HARNESS_ENABLED !== "true" ||
        v.PLANS_ENABLED !== "true")
    )
      ctx.addIssue({
        code: "custom",
        path: ["TEST_PLAN_WORKER_FAULT"],
        message: "invalid",
      });
    if (v.WEATHER_ENABLED === "true" && !v.WEATHER_INTERNAL_TOKEN)
      ctx.addIssue({
        code: "custom",
        path: ["WEATHER_INTERNAL_TOKEN"],
        message: "required",
      });
    if (
      v.DEV_HARNESS_ENABLED === "true" &&
      (v.NODE_ENV === "production" || !v.DEV_HARNESS_TOKEN)
    )
      ctx.addIssue({
        code: "custom",
        path: ["DEV_HARNESS_ENABLED"],
        message: "invalid",
      });
    if (
      v.TEST_WORKER_FAULT !== "none" &&
      (v.NODE_ENV !== "test" || v.DEV_HARNESS_ENABLED !== "true")
    )
      ctx.addIssue({
        code: "custom",
        path: ["TEST_WORKER_FAULT"],
        message: "invalid",
      });
  });
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `CONFIG_INVALID: ${[...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ")}`,
    );
  if (parsed.data.AUTH_BASE_URL)
    parsed.data.AUTH_BASE_URL = new URL(parsed.data.AUTH_BASE_URL).origin;
  return parsed.data;
}
export type Config = ReturnType<typeof loadConfig>;
// The API must state its proxy topology in production; quotas and auth rate
// limits key on the client address this produces.
export function trustProxySetting(config: Config) {
  if (config.TRUST_PROXY === undefined) {
    if (config.NODE_ENV === "production")
      throw new Error("CONFIG_INVALID: TRUST_PROXY");
    return false;
  }
  return parseTrustProxy(config.TRUST_PROXY) ?? false;
}
