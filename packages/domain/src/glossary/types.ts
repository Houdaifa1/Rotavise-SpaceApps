import type {
  GlossaryGroup,
  GlossaryLanguage,
  GlossaryEntry,
} from "@rotavise/contracts";

export type GlossaryTranslations = readonly [
  en: string,
  fr: string,
  ar: string,
  ary: string,
];
export type GlossaryRow = readonly [
  code: string,
  term: GlossaryTranslations,
  meaning: GlossaryTranslations,
];
export type GlossaryEntryText = {
  code: string;
  group: GlossaryGroup;
  term: Record<GlossaryLanguage, string>;
  meaning: Record<GlossaryLanguage, string>;
  evidence?: GlossaryEntry["evidence"];
};
export function rows(group: GlossaryGroup, list: GlossaryRow[]) {
  return list.map(([code, term, meaning]): GlossaryEntryText => ({
    code,
    group,
    term: { en: term[0], fr: term[1], ar: term[2], ary: term[3] },
    meaning: {
      en: meaning[0],
      fr: meaning[1],
      ar: meaning[2],
      ary: meaning[3],
    },
  }));
}
