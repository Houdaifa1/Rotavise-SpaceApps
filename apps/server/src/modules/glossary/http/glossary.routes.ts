import type { FastifyInstance } from "fastify";
import {
  glossaryQuerySchema,
  glossaryResponseSchema,
  type GlossaryGroup,
  type GlossaryLanguage,
} from "@rotavise/contracts";
import { glossaryFor } from "@rotavise/domain";
import { staticJson } from "../../../common/http/static-json.js";

// The glossary needs no account and no database: it is the same for everyone
// and changes only with a release.
export function registerGlossaryRoutes(app: FastifyInstance) {
  const served = new Map<string, ReturnType<typeof staticJson>>();
  const documentFor = (language: GlossaryLanguage, group?: GlossaryGroup) => {
    const key = `${language}:${group ?? ""}`;
    let document = served.get(key);
    if (!document) {
      document = staticJson(
        glossaryResponseSchema.parse(glossaryFor(language, group)),
      );
      served.set(key, document);
    }
    return document;
  };
  app.get("/api/v1/glossary", async (request, reply) => {
    const query = glossaryQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: "INVALID_INPUT" });
    reply.header("Content-Language", query.data.lang);
    return documentFor(query.data.lang, query.data.group).send(request, reply);
  });
}
