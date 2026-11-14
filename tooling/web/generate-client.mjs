import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { format } from "prettier";
import * as contracts from "../../packages/contracts/dist/index.js";

// Derive method, path, access, bodies and response unions from the exact
// registry that builds OpenAPI. Import concrete schemas to preserve inference
// and tree shaking (the registry deliberately erases its schema value types).
const source = ts.createSourceFile(
  "operations.ts",
  readFileSync(
    new URL(
      "../../packages/contracts/src/openapi/operations.ts",
      import.meta.url,
    ),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
);
const expressions = new Map();
const inlineParams = new Map();
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === "openApiComponents"
  ) {
    for (const property of node.initializer.arguments[0].properties)
      expressions.set(
        property.name.getText(source),
        property.initializer.getText(source),
      );
  }
  if (ts.isObjectLiteralExpression(node)) {
    const properties = new Map(
      node.properties
        .filter(ts.isPropertyAssignment)
        .map((p) => [p.name.getText(source), p.initializer]),
    );
    if (properties.has("operationId") && properties.has("params"))
      inlineParams.set(
        properties.get("operationId").text,
        properties.get("params").getText(source),
      );
  }
  ts.forEachChild(node, visit);
}
visit(source);
const schemaName = (schema) => {
  const match = Object.entries(contracts).find(
    ([name, value]) => name.endsWith("Schema") && value === schema,
  );
  return match?.[0];
};
const resource = (operation) => {
  const path = operation.path;
  if (path.includes("field-boundaries") || path.endsWith("/boundary"))
    return "boundary";
  if (path.includes("/history")) return "history";
  if (
    path.includes("/analysis/") ||
    path.endsWith("/water-storage") ||
    path.endsWith("/canopy-biomass")
  )
    return "analysis";
  if (path.includes("/observations")) return "observations";
  if (path.includes("/extractions")) return "extractions";
  if (path.includes("/catalog/")) return "catalog";
  if (path.includes("/weather/")) return "weather";
  if (path.includes("/glossary")) return "glossary";
  if (path.includes("/crop-health/")) return "cropHealth";
  if (path.includes("/account") || path.includes("/auth/")) return "account";
  if (path.includes("/fields")) return "fields";
  if (path.includes("/plans") || path.includes("/plan-sessions"))
    return "plans";
  return "capabilities";
};
const groups = new Map();
const omitted = {
  getOpenApi:
    "Developer documentation; the browser validates contracts locally, it does not render the OpenAPI document.",
};
for (const operation of contracts.openApiOperations) {
  if (operation.operationId in omitted) continue;
  const name = resource(operation);
  const group = groups.get(name) ?? {
    imports: new Set(),
    definitions: [],
    operations: [],
  };
  groups.set(name, group);
  function schema(ref) {
    if (Array.isArray(ref)) return `z.union([${ref.map(schema).join(",")}])`;
    const expression = expressions.get(ref);
    if (!expression) throw new Error(`Missing schema ${ref}`);
    if (/^\w+$/.test(expression)) {
      group.imports.add(expression);
      return expression;
    }
    for (const name of expression.match(/\b\w+Schema\b/g) ?? [])
      group.imports.add(name);
    return expression;
  }
  const fields = ["signal?: AbortSignal"];
  const lines = [];
  if (operation.params) {
    let name = schemaName(operation.params);
    if (name) group.imports.add(name);
    else {
      name = `${operation.operationId}ParamsSchema`;
      const expression = inlineParams.get(operation.operationId);
      if (!expression) throw new Error("Missing inline parameter schema");
      for (const symbol of expression.match(/\b\w+Schema\b/g) ?? [])
        group.imports.add(symbol);
      group.definitions.push(`const ${name} = ${expression};`);
    }
    fields.push(`params: z.input<typeof ${name}>`);
    lines.push(`const params = ${name}.parse(args.params);`);
  }
  if (operation.query) {
    const name =
      operation.query === "page"
        ? "pageQuerySchema"
        : schemaName(operation.query);
    group.imports.add(name);
    fields.push(`query?: z.input<typeof ${name}>`);
    lines.push(`const query = ${name}.parse(args.query ?? {});`);
  }
  let body;
  if (operation.body) {
    body = `${operation.operationId}BodySchema`;
    group.definitions.push(`const ${body} = ${schema(operation.body)};`);
    fields.push(`body: z.input<typeof ${body}>`);
    lines.push(`const body = ${body}.parse(args.body);`);
  }
  if (operation.idempotencyKey) {
    fields.push("idempotencyKey: string");
    lines.push(
      "const key = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/).parse(args.idempotencyKey);",
    );
  }
  const success = Object.entries(operation.responses).find(([status]) =>
    status.startsWith("2"),
  )[1];
  let response = "null";
  if (success.schema) {
    response = `${operation.operationId}ResponseSchema`;
    const expression = schema(success.schema);
    group.definitions.push(
      operation.operationId === "getPlan"
        ? `export const ${response}: z.ZodType<RotationPlanningStatus | z.infer<typeof planningStatusSchema> | PlanStatus> = ${expression};`
        : `export const ${response} = ${expression};`,
    );
  }
  const path = operation.path.replace(
    /\{(\w+)\}/g,
    (_, name) => `\${encodeURIComponent(String(params.${name}))}`,
  );
  lines.push(`const path = \`${path}\`;`);
  if (operation.query)
    lines.push(
      "const search = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined) search.set(key, String(value));",
    );
  lines.push(
    `return client.request(${operation.query ? 'path + (search.size ? "?" + search.toString() : "")' : "path"}, ${response}, {method: "${operation.method.toUpperCase()}", access: "${operation.access}", signal: args.signal, ${body ? "body," : ""} ${operation.idempotencyKey ? 'headers: {"Idempotency-Key": key},' : ""} ${operation.conditionalEtag || operation.operationId === "getGlossary" ? "conditional: true," : ""} ${operation.operationId === "getReady" ? "acceptStatuses: [503]," : ""} });`,
  );
  const optional =
    !operation.params && !operation.body && !operation.idempotencyKey;
  group.operations.push(
    `export function ${operation.operationId}(client: ApiClient, args: {${fields.join(";")}}${optional ? " = {}" : ""}) {${lines.join("\n")}}`,
  );
}
const outputs = new Map();
const implemented = {
  getCapabilities: "S00 boot and shell feature availability",
  getReady: "S00 readiness, retry and recovery",
  getAccount: "S00 owner discovery and retained S19 account",
  getGlossary: "S00, S16 and GlossaryTerm",
  getAuthCapabilities: "Retained S02 account form",
  getCatalogOptions: "S00 and retained planner",
  getCatalogOptionsVersion: "Retained planner's pinned result catalog",
  getWeatherCapabilities: "Retained weather explorer",
  queryWeather: "Retained weather explorer",
  createPlanSession: "Shared guest owner and retained planner",
  submitPlan: "Retained planner (format 1); format 2 UI is F6",
  getPlan: "Retained planner progress/result",
  listPlans: "Retained account saved plans",
  claimPlan: "Retained planner guest-to-account claim",
  createField: "Retained account/planner field save",
  createFieldWithHistory: "Retained planner field/history save",
  listFields: "Retained account saved fields",
  listFieldHistory: "Retained account field history",
  createFieldHistoryEntry: "Retained account history editor",
};
const deferred = {
  capabilities: "Operational liveness diagnostics, not needed by farmer boot.",
  boundary: "F3/F4/F5 field outlines and suggestions have not landed.",
  fields: "F5 field detail/edit/delete has not landed.",
  history: "F5 history update/delete has not landed.",
  plans:
    "F7/F10 plan label, deletion, explanation and settings have not landed.",
  analysis: "F8 evidence screens have not landed.",
  observations: "F8 NASA request/status screens have not landed.",
  extractions: "F8 NASA extraction screens have not landed.",
  catalog: "F9 crop detail has not landed.",
  cropHealth:
    "F9 photo check has not landed; availability comes from capabilities.",
};
for (const [resource, group] of groups) {
  const definitions = group.definitions.join("\n");
  const operations = group.operations.join("\n");
  const needsZod =
    /\bz\./.test(definitions + operations) || resource === "account";
  const content = `// Generated by tooling/web/generate-client.mjs from @rotavise/contracts.\n// Do not edit. Responses and inputs are inferred from their runtime schemas.\n${needsZod ? 'import { z } from "zod";' : ""}\nimport {${[...group.imports].sort().join(",")}} from "@rotavise/contracts";\n${resource === "plans" ? 'import type { RotationPlanningStatus, PlanStatus } from "@rotavise/contracts";' : ""}\nimport type { ApiClient } from "./client.js";\n${definitions}\n${operations}\n${resource === "account" ? "export type Account = z.infer<typeof getAccountResponseSchema>;" : ""}`;
  outputs.set(
    `apps/web/src/api/${resource}.ts`,
    await format(content, { parser: "typescript" }),
  );
}
outputs.set(
  "docs/steps/15/f1-api-inventory.json",
  await format(
    JSON.stringify({
      generatedFrom: "packages/contracts/src/openapi/operations.ts",
      operations: contracts.openApiOperations.map((o) => ({
        operation: o.operationId,
        method: o.method,
        path: o.path,
        module: o.operationId in omitted ? null : resource(o),
        status: o.operationId in implemented ? "used" : "not-used-in-F1",
        usedBy: implemented[o.operationId] ?? null,
        reason: implemented[o.operationId]
          ? null
          : (omitted[o.operationId] ??
            (o.operationId === "submitWhatIf"
              ? "F9 what-if has not landed."
              : o.operationId === "revokePlanSession"
                ? "F10 clear-device/session settings have not landed."
                : deferred[resource(o)])),
      })),
    }),
    { parser: "json" },
  ),
);
for (const [relative, content] of outputs) {
  const path = fileURLToPath(new URL(`../../${relative}`, import.meta.url));
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== content)
      throw new Error(`Generated client is stale: ${relative}`);
  } else {
    mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    writeFileSync(path, content);
  }
}
console.log(
  `${outputs.size - 1} contract-derived resource modules ${process.argv.includes("--check") ? "verified" : "generated"}`,
);
