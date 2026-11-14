import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
export function checkImports(source, filename = "module.tsx") {
  const violations = [];
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const check = (text) => {
    if (
      /^@rotavise\/(domain|database)(\/|$)|(^|\/)server\/|^pg$|^pg-boss$|packages\/(domain|database)\//.test(
        text,
      )
    )
      violations.push(text);
  };
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      check(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return violations;
}
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path);
    else if (/\.tsx?$/.test(item.name)) {
      const violations = checkImports(readFileSync(path, "utf8"), path);
      if (violations.length)
        throw new Error(
          `${path}: forbidden browser imports: ${violations.join(", ")}`,
        );
    }
  }
}
if (process.argv[1]?.endsWith("check-boundaries.mjs")) {
  walk("apps/web/src");
  console.log("Browser contract/HTTP boundary verified");
}
