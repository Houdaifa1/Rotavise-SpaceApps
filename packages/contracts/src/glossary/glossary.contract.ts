import { z } from "zod";
import { researchCitationSchema } from "../catalog/research.contract.js";

// The glossary explains every code, status, evidence class and satellite term
// the API returns, in plain language, so the interface never shows a raw code.
export const glossaryLanguages = ["en", "fr", "ar", "ary"] as const;
export const glossaryLanguageSchema = z.enum(glossaryLanguages);
export type GlossaryLanguage = z.infer<typeof glossaryLanguageSchema>;

export const glossaryGroups = [
  "reason_code",
  "strategy_note",
  "effect",
  "status",
  "evidence",
  "score",
  "error",
  "term",
  "role",
] as const;
export const glossaryGroupSchema = z.enum(glossaryGroups);
export type GlossaryGroup = z.infer<typeof glossaryGroupSchema>;

// Who wrote the text of a language and whether a person has read it. Nothing
// in the glossary has been reviewed by a person yet.
export const glossaryTextProvenanceSchema = z.enum([
  "model_written_unreviewed",
  "model_translated_unreviewed",
  "human_reviewed",
]);
export type GlossaryTextProvenance = z.infer<
  typeof glossaryTextProvenanceSchema
>;

export const glossaryEntrySchema = z.strictObject({
  // Same value the API returns: a reason code, a status, an explanation key.
  code: z.string().regex(/^[A-Za-z0-9_.]{1,80}$/),
  group: glossaryGroupSchema,
  term: z.string().min(1).max(120),
  meaning: z.string().min(1).max(700),
  evidence: z
    .strictObject({
      status: z.literal("sourced"),
      citations: z
        .array(
          researchCitationSchema.extend({
            url: z.url().max(8192),
            title: z.string().min(1).max(2000),
          }),
        )
        .min(1)
        .max(4),
    })
    .optional(),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

export const glossaryQuerySchema = z.strictObject({
  lang: glossaryLanguageSchema.default("en"),
  group: glossaryGroupSchema.optional(),
});

export const glossaryResponseSchema = z.strictObject({
  version: z.string().regex(/^glossary-\d+$/),
  language: glossaryLanguageSchema,
  direction: z.enum(["ltr", "rtl"]),
  provenance: z.strictObject({
    text: glossaryTextProvenanceSchema,
    note: z.string().min(1).max(400),
  }),
  languages: z.array(glossaryLanguageSchema).min(1),
  groups: z.array(glossaryGroupSchema),
  entries: z.array(glossaryEntrySchema),
});
export type GlossaryResponse = z.infer<typeof glossaryResponseSchema>;
