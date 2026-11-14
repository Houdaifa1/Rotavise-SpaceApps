import { z } from "zod";

export const catalogIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,79}$/);
export const catalogVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .max(40);
export const catalogShaSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const catalogTextSchema = z.string().trim().min(1).max(2000);
export const citationSchema = z.strictObject({
  sourceId: catalogIdSchema,
  locator: catalogTextSchema,
  interpretation: z.enum(["direct", "normalized", "context_only"]),
  note: catalogTextSchema,
  // Release 0.3.0 onwards: the PDF page (null for a web page) and the exact
  // source words, which the release's quote check finds by machine.
  page: z.number().int().min(1).max(2000).nullable().optional(),
  quote: z.string().min(8).max(800).optional(),
});
export const citationsSchema = z.array(citationSchema).min(1).max(12);
export const catalogSourceSchema = z.strictObject({
  id: catalogIdSchema,
  title: catalogTextSchema,
  publisher: catalogTextSchema,
  url: z
    .url()
    // Saved research includes exact SPARQL query URLs (up to 4,372 bytes).
    .max(8192)
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === "https:" && !parsed.username && !parsed.password
        );
      } catch {
        return false;
      }
    }),
  publicationYear: z.number().int().min(1700).max(2100).nullable(),
  accessedAt: z.iso.datetime(),
  evidence: z.strictObject({
    kind: z.enum(["document_bytes", "verified_extract"]),
    sha256: catalogShaSchema,
    // The hashed INRA Tanji research PDF is 50,290,776 bytes; only its size
    // and digest enter the catalog, never the document bytes themselves.
    bytes: z.number().int().positive().max(64_000_000),
    artifactPath: z
      .string()
      .regex(/^docs\/evidence\/catalog\/[a-zA-Z0-9/_.-]+$/)
      .max(300)
      .refine((path) =>
        path
          .split("/")
          .every((part) => part !== "." && part !== ".." && part.length > 0),
      )
      .nullable(),
    captureNote: catalogTextSchema,
  }),
  geographicScope: catalogTextSchema,
  limitations: z.array(catalogTextSchema).min(1).max(12),
  synthetic: z.boolean(),
});
