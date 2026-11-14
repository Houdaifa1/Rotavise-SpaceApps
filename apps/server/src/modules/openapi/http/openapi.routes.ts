import type { FastifyInstance } from "fastify";
import { buildOpenApiDocument } from "@rotavise/contracts";
import { staticJson } from "../../../common/http/static-json.js";

// The document describes the code this server was built from, so it is built
// once at start-up and served with an ETag.
export function registerOpenApiRoutes(app: FastifyInstance) {
  const document = staticJson(buildOpenApiDocument());
  app.get("/api/v1/openapi.json", async (request, reply) => {
    if (Object.keys(request.query as object).length)
      return reply.code(400).send({ code: "INVALID_INPUT" });
    return document.send(request, reply);
  });
}
