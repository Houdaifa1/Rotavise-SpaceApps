import { researchTerms, researchStatuses } from "./research.js";
import {
  benefitRoles,
  benefitStrategyNotes,
  benefitEffects,
  benefitApplicability,
} from "./benefits.js";
import {
  glossaryGroups,
  glossaryLanguages,
  type GlossaryEntry,
  type GlossaryGroup,
  type GlossaryLanguage,
  type GlossaryResponse,
} from "@rotavise/contracts";
import { cropDetailReasons } from "./crop-detail.js";
import { rotationOutputReasons } from "./rotation-outputs.js";
import { cropReasonCodes } from "./reason-codes-crop.js";
import { fieldReasonCodes } from "./reason-codes-field.js";
import { strategyNoteCodes } from "./strategy-notes.js";
import {
  effectTerms,
  evidenceTerms,
  scoreTerms,
  statusTerms,
} from "./status-terms.js";
import { errorCodes } from "./error-codes.js";
import { fieldSuggestionTerms } from "./field-suggestions.js";
import { satelliteTerms } from "./satellite-terms.js";
import {
  resultErrorCodes,
  resultReasonCodes,
  resultStatusTerms,
} from "./result-terms.js";
import type { GlossaryEntryText } from "./types.js";

// Bump when a text or an entry changes meaning, so clients can refresh a cache.
export const GLOSSARY_VERSION = "glossary-7";

export const GLOSSARY: readonly GlossaryEntryText[] = [
  ...cropReasonCodes,
  ...cropDetailReasons,
  ...researchTerms,
  ...researchStatuses,
  ...benefitRoles,
  ...benefitStrategyNotes,
  ...benefitEffects,
  ...benefitApplicability,
  ...rotationOutputReasons,
  ...fieldReasonCodes,
  ...resultReasonCodes,
  ...strategyNoteCodes,
  ...effectTerms,
  ...statusTerms,
  ...resultStatusTerms,
  ...evidenceTerms,
  ...scoreTerms,
  ...errorCodes,
  ...fieldSuggestionTerms,
  ...resultErrorCodes,
  ...satelliteTerms,
];

export const GLOSSARY_NOTE: Record<GlossaryLanguage, string> = {
  en: "English text written with AI assistance. No person has reviewed it yet.",
  fr: "Traduction automatique de l'anglais. Aucune personne ne l'a encore relue.",
  ar: "ترجمة آلية إلى العربية الفصحى من الإنجليزية. لم يراجعها أي شخص بعد.",
  ary: "هاد الترجمة من الإنجليزية للدارجة المغربية مكتوبة بالذكاء الاصطناعي. ما راجعها حتى واحد باقي.",
};

// One language of the glossary, optionally narrowed to one group, in a stable
// order. Pure: the caller decides how to serve and cache it.
export function glossaryFor(
  language: GlossaryLanguage,
  group?: GlossaryGroup,
): GlossaryResponse {
  const wanted = group ? [group] : [...glossaryGroups];
  const entries: GlossaryEntry[] = GLOSSARY.filter((e) =>
    wanted.includes(e.group),
  ).map((e) => ({
    code: e.code,
    group: e.group,
    term: e.term[language],
    meaning: e.meaning[language],
    ...(e.evidence ? { evidence: e.evidence } : {}),
  }));
  return {
    version: GLOSSARY_VERSION,
    language,
    direction: language === "ar" || language === "ary" ? "rtl" : "ltr",
    provenance: {
      text:
        language === "en"
          ? "model_written_unreviewed"
          : "model_translated_unreviewed",
      note: GLOSSARY_NOTE[language],
    },
    languages: [...glossaryLanguages],
    groups: wanted.filter((g) => entries.some((e) => e.group === g)),
    entries,
  };
}
