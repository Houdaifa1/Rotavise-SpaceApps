import {
  randomUUID,
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  betterAuth,
  getCurrentAdapter,
  type BetterAuthPlugin,
} from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  user,
  session,
  account,
  verification,
  rateLimit,
  authMail,
} from "@rotavise/database";
import type { Pool } from "pg";
import type { Config } from "../../../config/environment.js";
import { createPasswordHasher } from "./password.js";

const outboxPlugin = {
  id: "rotavise-mail-outbox",
  schema: {
    authMail: {
      fields: {
        userId: {
          type: "string",
          required: true,
          references: { model: "user", field: "id", onDelete: "cascade" },
        },
        kind: { type: "string", required: true },
        ciphertext: { type: "string", required: true },
        createdAt: { type: "date", required: true },
        expiresAt: { type: "date", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;

function key(secret: string) {
  return createHash("sha256")
    .update("rotavise-auth-mail-v1\0")
    .update(secret)
    .digest();
}
export function encryptMail(
  secret: string,
  id: string,
  payload: { to: string; url: string },
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(id));
  const content = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString(
    "base64url",
  );
}
export function decryptMail(
  secret: string,
  id: string,
  encoded: string,
): { to: string; url: string } {
  const bytes = Buffer.from(encoded, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const result: unknown = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
  if (
    !result ||
    typeof result !== "object" ||
    !("to" in result) ||
    !("url" in result) ||
    typeof result.to !== "string" ||
    typeof result.url !== "string"
  )
    throw new Error("MAIL_CONTENT_INVALID");
  return { to: result.to, url: result.url };
}

export type AccountAuth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (options: { headers: Headers }) => Promise<{
      user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        createdAt: Date;
      };
      session: { id: string; createdAt: Date; expiresAt: Date };
    } | null>;
  };
};
export function createAuth(pool: Pool, config: Config): AccountAuth {
  if (!config.AUTH_SECRET || !config.AUTH_BASE_URL)
    throw new Error("AUTH_CONFIG_REQUIRED");
  const secret = config.AUTH_SECRET;
  const requests = new AsyncLocalStorage<{ mailFailure: boolean }>();
  const auth = betterAuth({
    appName: "Rotavise",
    baseURL: config.AUTH_BASE_URL,
    basePath: "/api/auth",
    secret,
    database: drizzleAdapter(drizzle(pool), {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit, authMail },
      transaction: true,
    }),
    trustedOrigins: [
      config.AUTH_BASE_URL,
      ...config.AUTH_TRUSTED_ORIGINS.split(",").filter(Boolean),
    ],
    ...(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: config.GOOGLE_CLIENT_ID,
              clientSecret: config.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
    account: {
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 900,
      revokeSessionsOnPasswordReset: true,
      password: createPasswordHasher(),
      sendResetPassword: async ({ user, url }) =>
        enqueue(user.id, user.email, url, "recover", 900),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) =>
        enqueue(user.id, user.email, url, "verify", 3600),
    },
    session: {
      expiresIn: 7 * 86400,
      freshAge: 300,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    verification: { storeIdentifier: "hashed" },
    user: {
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn: 900,
        sendDeleteAccountVerification: async ({ user, url }) =>
          enqueue(user.id, user.email, url, "delete", 900),
      },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: "uuid" },
      useSecureCookies: config.NODE_ENV === "production",
      ipAddress: { ipAddressHeaders: ["x-rotavise-client-ip"] },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.NODE_ENV === "production",
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-up/email": { window: 3600, max: 5 },
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 3600, max: 5 },
        "/send-verification-email": { window: 3600, max: 5 },
      },
    },
    telemetry: { enabled: false },
    logger: { disabled: true },
    plugins: [outboxPlugin],
  });
  async function enqueue(
    userId: string,
    to: string,
    url: string,
    kind: "verify" | "recover" | "delete",
    ttl: number,
  ) {
    const id = randomUUID();
    try {
      const adapter = await getCurrentAdapter((await auth.$context).adapter);
      await adapter.create({
        model: "authMail",
        data: {
          id,
          userId,
          kind,
          ciphertext: encryptMail(secret, id, { to, url }),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
        forceAllowId: true,
      });
    } catch (error) {
      const state = requests.getStore();
      if (state) state.mailFailure = true;
      throw error;
    }
  }
  // Better Auth deliberately logs/absorbs mail callback errors. Preserve that
  // library behavior while refusing a successful HTTP response if durable enqueue
  // failed. AsyncLocalStorage keeps concurrent request outcomes independent.
  return {
    api: { getSession: async (options) => auth.api.getSession(options) },
    handler: (request: Request) =>
      requests.run({ mailFailure: false }, async () => {
        const response = await auth.handler(request);
        if (requests.getStore()!.mailFailure)
          throw new Error("AUTH_MAIL_STORAGE_UNAVAILABLE");
        return response;
      }),
  };
}
