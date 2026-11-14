// Page text of a PDF with Mozilla PDF.js, for machine quote checks. Text is
// normalized (Unicode NFC, collapsed whitespace, joined hyphenated line
// breaks) so a quote matches regardless of layout.
// Usage: node tooling/catalog/pdf-text.mjs <file.pdf> [out.json]
import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export function normalizeText(text) {
  return text
    .normalize("NFC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/ /g, " ")
    .replace(/(\w)- +(\w)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}
export async function pdfPages(path) {
  const data = new Uint8Array(await readFile(path));
  const task = getDocument({ data, verbosity: 0, isEvalSupported: false });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = "";
    for (const item of content.items)
      text += item.str + (item.hasEOL ? "\n" : " ");
    pages.push(normalizeText(text));
  }
  await task.destroy();
  return pages;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, out] = process.argv.slice(2);
  const pages = await pdfPages(file);
  if (out) await writeFile(out, JSON.stringify(pages, null, 1));
  console.log(
    JSON.stringify({
      file,
      pages: pages.length,
      chars: pages.map((p) => p.length),
    }),
  );
}
