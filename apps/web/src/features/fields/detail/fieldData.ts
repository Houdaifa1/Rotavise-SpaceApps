import {
  fieldUpdateRequestSchema,
  type FieldProfile,
  type CropHistoryEntry,
} from "@rotavise/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useApi, useSession } from "../../../app/providers/Runtime.js";
import { ApiFailure } from "../../../app/http.js";
import { keys } from "../../../api/keys.js";
import { getField, updateField } from "../../../api/fields.js";
import type { Field } from "../useFieldWorkspace.js";

export type FieldPatch = Partial<
  Pick<FieldProfile, "name" | "soil" | "water" | "crop_health">
>;
import type { HistoryRecord } from "../planning.js";
export { readHistory, useHistory, type HistoryRecord } from "../planning.js";
export const fieldBody = (
  field: Pick<Field, "profile" | "version">,
  patch: FieldPatch,
) =>
  fieldUpdateRequestSchema.parse({
    expectedVersion: field.version,
    profile: { ...field.profile, ...patch },
  });
export const isConflict = (error: unknown) =>
  error instanceof ApiFailure && error.status === 409;

export function useFieldWrite(id: string) {
  const client = useApi();
  const { scope } = useSession();
  const cache = useQueryClient();
  async function publish(record: Field) {
    cache.setQueryData(keys.field(scope, id), record);
    await cache.invalidateQueries({ queryKey: keys.fieldPages(scope) });
  }
  return {
    save: async (base: Field, patch: FieldPatch, signal: AbortSignal) => {
      const record = await updateField(client, {
        params: { id },
        body: fieldBody(base, patch),
        signal,
      });
      await publish(record);
    },
    reload: async (signal: AbortSignal) => {
      const record = await getField(client, { params: { id }, signal });
      await publish(record);
      return record;
    },
  };
}
export function overlaps(
  entry: CropHistoryEntry,
  others: HistoryRecord[],
  ownId?: string,
) {
  return others.some(
    ({ id, entry: other }) =>
      id !== ownId &&
      entry.planted_on <= other.harvested_on &&
      entry.harvested_on >= other.planted_on,
  );
}
