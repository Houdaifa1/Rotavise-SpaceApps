// Inspect rendered content and attributes, including content shown after an
// interaction. Technical identifiers are explicitly marked data-code.
export async function scanDesignDom(page) {
  return page.locator("body").evaluate((body) => {
    const bad = [];
    const forbidden =
      /yyyy|undefined|\bNaN\b|\bnull\b|\[object|\{\{|\}\}|Lorem|TODO|\bmock\b|\b\d{4}-\d\d-\d\dT\d\d:\d\d|\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b|[$€£]\s*\d/i;
    const rawCode =
      /\b(?=[A-Z0-9_]{6,}\b)[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b(?:shell|welcome|auth|map|field|history|inputs|priorities|plan|progress|result|strategy|evidence|whatif|crops|glossary|photo|plans|account|about|demo|error|validation|common)\.[a-z]\w*(?:\.\w+)*\b/;
    for (const el of body.querySelectorAll("*")) {
      if (
        !(el instanceof HTMLElement || el instanceof SVGElement) ||
        !el.getClientRects().length ||
        el.closest('[aria-hidden="true"]')
      )
        continue;
      const values = [...el.attributes].map((a) => [a.name, a.value]);
      for (const node of el.childNodes)
        if (node.nodeType === Node.TEXT_NODE)
          values.push(["text", node.textContent ?? ""]);
      for (const [kind, value] of values)
        if (
          forbidden.test(
            kind === "src" &&
              el.tagName === "IMG" &&
              value.startsWith(`blob:${location.origin}/`) &&
              /\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(
                value,
              )
              ? `blob:${location.origin}/`
              : value,
          ) ||
          (!el.closest("[data-code]") && rawCode.test(value))
        )
          bad.push(`${el.tagName} ${kind}: ${value.slice(0, 160)}`);
    }
    return bad;
  });
}
