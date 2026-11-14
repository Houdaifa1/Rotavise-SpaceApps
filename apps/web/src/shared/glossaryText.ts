import type { GlossaryResponse, GlossaryGroup } from "@rotavise/contracts";

export function findTerm(
  glossary: GlossaryResponse | undefined,
  code: string,
  group: GlossaryGroup,
) {
  return glossary?.entries.find(
    (entry) => entry.group === group && entry.code === code,
  );
}
