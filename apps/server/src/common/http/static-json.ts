import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

// A public document that only changes with a release: serialised once, tagged
// by its hash and cacheable, so clients revalidate cheaply.
export function staticJson(value: unknown) {
  const body = JSON.stringify(value);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  return {
    body,
    etag,
    send(request: FastifyRequest, reply: FastifyReply) {
      reply
        .header("ETag", etag)
        .header("Cache-Control", "public, max-age=3600");
      if (request.headers["if-none-match"] === etag)
        return reply.code(304).send();
      return reply.type("application/json; charset=utf-8").send(body);
    },
  };
}
