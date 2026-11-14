import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  buildOpenApiDocument,
  openApiComponents,
  openApiOperations,
  toOpenApiPath,
} from "../../packages/contracts/dist/index.js";

const document = buildOpenApiDocument();
const walk = (node, visit) => {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node);
    Object.values(node).forEach((n) => walk(n, visit));
  }
};

describe("OpenAPI document", () => {
  test("is OpenAPI 3.1 with an operation for every table entry and unique ids", () => {
    expect(document.openapi).toBe("3.1.0");
    const ids = openApiOperations.map((o) => o.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = openApiOperations.map((o) => `${o.method} ${o.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const operation of openApiOperations) {
      const built = document.paths[operation.path]?.[operation.method];
      expect(built?.operationId).toBe(operation.operationId);
      expect(Object.keys(built.responses).length).toBeGreaterThan(0);
      expect(
        operation.path.startsWith("/api/v1/") ||
          ["/health/live", "/health/ready"].includes(operation.path),
      ).toBe(true);
    }
  });

  test("every $ref points at a schema that exists", () => {
    const missing = new Set();
    walk(document, (node) => {
      const ref = node.$ref;
      if (typeof ref !== "string") return;
      const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
      if (!match || !document.components.schemas[match[1]]) missing.add(ref);
    });
    expect([...missing]).toEqual([]);
    expect(Object.keys(document.components.schemas).sort()).toEqual(
      Object.keys(openApiComponents).sort(),
    );
  });

  test("path parameters match the path template, and security is declared", () => {
    for (const operation of openApiOperations) {
      const built = document.paths[operation.path][operation.method];
      const inPath = [...operation.path.matchAll(/\{(\w+)\}/g)].map(
        (m) => m[1],
      );
      const described = (built.parameters ?? [])
        .filter((p) => p.in === "path")
        .map((p) => p.name);
      expect(described.sort()).toEqual(inPath.sort());
      expect(Array.isArray(built.security)).toBe(true);
      if (operation.body) expect(built.requestBody.required).toBe(true);
      if (operation.idempotencyKey)
        expect(built.parameters.some((p) => p.name === "Idempotency-Key")).toBe(
          true,
        );
    }
    expect(Object.keys(document.components.securitySchemes).sort()).toEqual([
      "accountSession",
      "guestBearer",
    ]);
  });

  test("components carry no per-schema ids or date regular expressions", () => {
    let leftovers = 0;
    walk(document.components.schemas, (node) => {
      if ("$schema" in node || "$id" in node) leftovers++;
      if ("pattern" in node && typeof node.format === "string") leftovers++;
    });
    expect(leftovers).toBe(0);
  });

  test("the plan request accepts both formats and the request bodies of fields are required", () => {
    const submit = document.paths["/api/v1/plans"].post;
    expect(submit.requestBody.content["application/json"].schema.oneOf).toEqual(
      [
        { $ref: "#/components/schemas/RotationPlanCreateRequest" },
        { $ref: "#/components/schemas/PlanCreateRequest" },
      ],
    );
    expect(document.paths["/api/v1/fields"].post.requestBody.required).toBe(
      true,
    );
  });

  test("Fastify and Nest route syntax converts to OpenAPI syntax", () => {
    expect(toOpenApiPath("/api/v1/fields/:id/history/:entryId")).toBe(
      "/api/v1/fields/{id}/history/{entryId}",
    );
  });

  test("the committed docs/api/openapi.json is the current document", () => {
    const committed = readFileSync("docs/api/openapi.json", "utf8");
    expect(committed).toBe(JSON.stringify(document, null, 2) + "\n");
  });
});
