import type { FastifyInstance } from "fastify";
// The API returns JSON and redirects only: browsers must never render, frame or
// MIME-sniff its responses. HSTS is sent only in production, which is HTTPS.
export function registerSecurityHeaders(
  app: FastifyInstance,
  production: boolean,
) {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("X-Frame-Options", "DENY")
      .header(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      )
      .header("Referrer-Policy", "no-referrer")
      .header("Cross-Origin-Resource-Policy", "same-origin");
    if (production)
      reply.header("Strict-Transport-Security", "max-age=31536000");
    return payload;
  });
}
