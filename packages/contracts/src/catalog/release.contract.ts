import { z } from "zod";
import { catalogBundleSchema } from "./catalog.contract.js";
export const catalogReleaseSchema = catalogBundleSchema
  .omit({ sources: true, profiles: true })
  .extend({
    sourceFile: z.literal("sources.json"),
    profileFiles: z
      .array(z.string().regex(/^profiles\/[a-z][a-z0-9-]{2,79}\.json$/))
      .min(1)
      .max(50),
  })
  .superRefine((release, ctx) => {
    if (new Set(release.profileFiles).size !== release.profileFiles.length)
      ctx.addIssue({
        code: "custom",
        path: ["profileFiles"],
        message: "Duplicate files",
      });
  });
