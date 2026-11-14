import ts from "typescript";

// Schema construction and the two documentation registries have no side
// effects. Mark only those initializers, so unused contracts can be removed
// from the browser bundle. Parsing/validation calls are never annotated.
export function annotateContractSchemas(source: string) {
  const file = ts.createSourceFile(
    "contract.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const edits: { start: number; end: number; text: string }[] = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer || !ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      const text = initializer.getText(file);
      if (
        name === "openApiOperations" &&
        ts.isArrayLiteralExpression(initializer)
      )
        edits.push({
          start: initializer.getStart(file),
          end: initializer.end,
          text: `/*#__PURE__*/ (() => (${text}))()`,
        });
      else if (
        name === "openApiComponents" ||
        (name.endsWith("Schema") &&
          ts.isCallExpression(initializer) &&
          !(
            ts.isPropertyAccessExpression(initializer.expression) &&
            /^(parse|safeParse)/.test(initializer.expression.name.text)
          ) &&
          /^(z\.|[A-Za-z_$][\w$]*Schema\.)/.test(text))
      )
        edits.push({
          start: initializer.getStart(file),
          end: initializer.end,
          text: `/*#__PURE__*/ (() => (${text}))()`,
        });
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
export function contractTreeShaking() {
  return {
    name: "contract-schema-tree-shaking",
    enforce: "pre" as const,
    transform(source: string, id: string) {
      if (!id.includes("/packages/contracts/dist/") || !id.endsWith(".js"))
        return;
      return {
        code: annotateContractSchemas(source),
        map: null,
        moduleSideEffects: false,
      };
    },
  };
}
