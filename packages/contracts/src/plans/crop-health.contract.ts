import { z } from "zod";

// Same accepted alphabet and trailing padding as the former regex, without
// depending on the regexp interpreter stack for multi-megabyte uploads.
const base64Characters = (value: string) => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 61) end--;
  if (end === 0 || value.length - end > 2) return false;
  for (let i = 0; i < end; i++) {
    const c = value.charCodeAt(i);
    if (!(
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) ||
      c === 43 ||
      c === 47
    ))
      return false;
  }
  return true;
};

// Photo triage: possibilities for a person to check, never a diagnosis.
export const explanationLanguages = ["ar", "ary", "fr", "en"] as const;
// A photo of at most 8000 px a side and about 5 MB; the server checks the
// format and size and removes metadata (GPS, device, time) before sending it.
export const cropPhotoRequestSchema = z.strictObject({
  crop_id: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  image_base64: z
    .string()
    .min(100)
    .max(7_000_000)
    .refine(base64Characters, "Invalid base64 alphabet or padding"),
  // The farmer agreed to send this photo to the AI provider.
  consent: z.literal(true),
  // Language of the note and notice; English when omitted.
  language: z.enum(explanationLanguages).optional(),
});
export const cropPhotoResultSchema = z.strictObject({
  image_quality: z.enum(["usable", "poor"]),
  // "no_visible_problem" means none of the crop's listed problems is visible.
  assessment: z.enum(["no_visible_problem", "possibly_affected", "not_sure"]),
  candidates: z
    .array(
      z.strictObject({
        issue_id: z.string().max(80),
        what_is_visible: z.string().max(400),
      }),
    )
    .max(3),
  note: z.string().max(600),
  // Fixed text from the server, not the model.
  notice: z.string().max(400),
  // True when the server removed model text that looked like treatment,
  // product or dose advice.
  text_removed: z.boolean(),
  // How many sourced problems the photo was checked against.
  checked_issue_count: z.number().int().min(1).max(200),
});
export type CropPhotoResult = z.infer<typeof cropPhotoResultSchema>;
// Whether the photo check and explanations are switched on (a key is set).
export const cropHealthStatusSchema = z.strictObject({
  available: z.boolean(),
  reason: z.literal("AI_NOT_CONFIGURED").nullable(),
});
export const planExplanationRequestSchema = z.strictObject({
  language: z.enum(explanationLanguages),
});
