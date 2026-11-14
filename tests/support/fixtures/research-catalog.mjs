import { rotationCatalog } from "../rotation.mjs";

// Explicit synthetic transport fixture. Two invented crop identities borrow
// unmodified research payloads solely to exercise serialization and hashing;
// this mapping is NOT agronomic evidence and cannot enter production imports.
export function syntheticResearchCatalog(real) {
  const catalog = rotationCatalog({ crops: 3 });
  for (const [i, id] of ["barley", "tomato"].entries())
    catalog.profiles[i].research = structuredClone(
      real.profiles.find((p) => p.id === id).research,
    );
  const ids = new Set(
    catalog.profiles.flatMap((p) =>
      p.research
        ? [
            ...p.research.income.facts,
            ...p.research.income.options,
            ...p.research.benefits.findings,
            ...(p.research.benefits.records ?? []),
          ].flatMap((e) => e.citations.map((c) => c.sourceId))
        : [],
    ),
  );
  catalog.sources.push(...real.sources.filter((s) => ids.has(s.id)));
  return catalog;
}
