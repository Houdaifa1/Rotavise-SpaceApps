import { z } from "zod";
import {
  openApiComponents,
  openApiOperations,
  type OpenApiComponent,
  type OpenApiOperation,
} from "./operations.js";

// Version of the document's own content. Raise it when an operation or a
// schema changes in a way a client would notice.
export const OPENAPI_DOCUMENT_VERSION = "1.5.0";

type Json = Record<string, unknown>;
const componentRef = (id: OpenApiComponent) => ({
  $ref: `#/components/schemas/${id}`,
});
const refs = (schema: OpenApiOperation["body"]) =>
  schema === undefined
    ? undefined
    : typeof schema === "string"
      ? componentRef(schema)
      : { oneOf: schema.map(componentRef) };

// JSON Schema output carries things OpenAPI documents do not need: a schema
// id per component, and a long date regular expression beside every format.
function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const source = node as Json;
  const out: Json = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema" || key === "$id") continue;
    if (key === "pattern" && typeof source.format === "string") continue;
    out[key] = clean(value);
  }
  return out;
}
const jsonSchemaOf = (schema: z.ZodType, io: "input" | "output") =>
  clean(
    z.toJSONSchema(schema, {
      target: "draft-2020-12",
      io,
      unrepresentable: "any",
    }),
  ) as Json;

function parametersOf(operation: OpenApiOperation) {
  const parameters: Json[] = [];
  for (const [name, schema] of Object.entries(operation.params?.shape ?? {}))
    parameters.push({
      name,
      in: "path",
      required: true,
      schema: jsonSchemaOf(schema as z.ZodType, "input"),
    });
  if (operation.query === "page")
    parameters.push(
      {
        name: "cursor",
        in: "query",
        required: false,
        description:
          "Opaque position from the previous page's nextCursor; pass it back unchanged.",
        schema: { type: "string", pattern: "^[A-Za-z0-9_-]{1,256}$" },
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    );
  else if (operation.query)
    for (const [name, schema] of Object.entries(operation.query.shape))
      parameters.push({
        name,
        in: "query",
        required: !(schema as z.ZodType).safeParse(undefined).success,
        schema: jsonSchemaOf(schema as z.ZodType, "input"),
      });
  if (operation.idempotencyKey)
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      description:
        "A key you choose for this request. Sending the same key again returns the same plan instead of making a second one.",
      schema: { type: "string", pattern: "^[A-Za-z0-9_-]{8,80}$" },
    });
  if (operation.conditionalEtag)
    parameters.push({
      name: "If-None-Match",
      in: "header",
      required: false,
      description:
        "ETag from an earlier response; weak tags, lists and * are accepted.",
      schema: { type: "string" },
    });
  return parameters;
}

const SECURITY: Record<OpenApiOperation["access"], Json[]> = {
  none: [],
  owner: [{ accountSession: [] }, { guestBearer: [] }],
  account: [{ accountSession: [] }],
  guest: [{ guestBearer: [] }],
  both: [{ accountSession: [], guestBearer: [] }],
};

function operationObject(operation: OpenApiOperation): Json {
  const body = refs(operation.body);
  const parameters = parametersOf(operation);
  return {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: operation.summary,
    ...(operation.description ? { description: operation.description } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: body } },
          },
        }
      : {}),
    responses: Object.fromEntries(
      Object.entries(operation.responses).map(([status, response]) => {
        const schema = refs(response.schema);
        return [
          status,
          {
            description: response.description,
            ...(operation.conditionalEtag && ["200", "304"].includes(status)
              ? {
                  headers: {
                    ETag: {
                      description: "Hash of the response bytes.",
                      schema: { type: "string" },
                    },
                    "Cache-Control": {
                      description: "public, max-age=3600, immutable",
                      schema: { type: "string" },
                    },
                  },
                }
              : {}),
            ...(schema ? { content: { "application/json": { schema } } } : {}),
          },
        ];
      }),
    ),
    security: SECURITY[operation.access],
    ...(operation.requires ? { "x-requires": operation.requires } : {}),
  };
}

// The OpenAPI 3.1 document of the public API, built from the Zod contracts the
// routes themselves parse with.
export function buildOpenApiDocument(operations = openApiOperations): Json {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(openApiComponents))
    registry.add(schema, { id });
  const generated = z.toJSONSchema(registry, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "any",
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, unknown> };
  const schemas = Object.fromEntries(
    Object.entries(generated.schemas).map(([id, schema]) => [
      id,
      clean(schema),
    ]),
  );

  const paths: Record<string, Json> = {};
  for (const operation of operations)
    (paths[operation.path] ??= {})[operation.method] =
      operationObject(operation);

  return {
    openapi: "3.1.0",
    info: {
      title: "Rotavise API",
      version: OPENAPI_DOCUMENT_VERSION,
      description:
        "Crop rotation planning for Moroccan farms from NASA data. Results are decision aids built on rules that no agronomist has reviewed yet; every result says which rules and data it used. Reason codes, statuses and terms are explained in plain language by GET /api/v1/glossary. Routes marked x-requires exist only when those server settings are on. The sign-in endpoints under /api/auth/ belong to the account library and are not described here; an internal weather route and the development test jobs are also left out.",
    },
    servers: [{ url: "/" }],
    tags: [...new Set(operations.map((o) => o.tag))].map((name) => ({
      name,
    })),
    paths,
    components: {
      schemas,
      securitySchemes: {
        accountSession: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description:
            "The session cookie set after signing in. Browsers send it themselves; state-changing requests must also come from a trusted Origin.",
        },
        guestBearer: {
          type: "http",
          scheme: "bearer",
          description:
            "Token from POST /api/v1/plan-sessions for someone without an account. Do not send it together with the session cookie, except when claiming a plan.",
        },
      },
    },
  };
}
