import type { z } from "zod";
import type { MessageKey } from "../../i18n/messages.js";
export const schemaMessages = {
  "At least one priority": "validation.At least one priority",
  "Inconsistent selection mode": "validation.Inconsistent selection mode",
  "Considered crop is excluded": "validation.Considered crop is excluded",
  "Duplicate crop choices": "validation.Duplicate crop choices",
  "Invalid first-sowing range": "validation.Invalid first-sowing range",
  "History overlaps proposed start":
    "validation.History overlaps proposed start",
  "Reversed crop dates": "validation.Reversed crop dates",
  "Overlapping crop history": "validation.Overlapping crop history",
  "Duplicate history entry": "validation.Duplicate history entry",
  "Farmer observation is not a confirmed diagnosis":
    "validation.Farmer observation is not a confirmed diagnosis",
  "Duplicate health observation": "validation.Duplicate health observation",
  "Duplicate soil metric": "validation.Duplicate soil metric",
  "One cultivar per crop": "validation.One cultivar per crop",
  "Steps of 0.1 °C": "validation.Steps of 0.1 °C",
  "A what-if needs at least one change":
    "validation.A what-if needs at least one change",
  "Duplicate operations": "validation.Duplicate operations",
  "Empty equipment limits": "validation.Empty equipment limits",
} as const satisfies Record<string, MessageKey>;
export function issueTarget(issue: Pick<z.core.$ZodIssue, "path" | "message">) {
  const root = issue.path[0];
  if (root === "planning") return { step: 0, control: "dates" };
  if (root === "cultivars") return { step: 1, control: "cultivars" };
  if (root === "current_rotation") return { step: 2, control: "rotation" };
  if (
    root === "preferences" &&
    (issue.path[1] === "mode" ||
      issue.path[1] === "considered_crop_ids" ||
      issue.path[1] === "excluded_crop_ids" ||
      issue.message === "Considered crop is excluded")
  )
    return { step: 1, control: "crops" };
  if (root === "history")
    return {
      step: 3,
      control: "history",
      row: typeof issue.path[2] === "number" ? issue.path[2] : undefined,
    };
  if (root === "soil") return { step: 3, control: "soil" };
  if (root === "water") return { step: 3, control: "water" };
  if (root === "crop_health")
    return {
      step: 3,
      control: "health",
      row: typeof issue.path[2] === "number" ? issue.path[2] : undefined,
    };
  return { step: 3, control: "priorities" };
}
export function issueMessage(
  issue: Pick<z.core.$ZodIssue, "message"> &
    Partial<Pick<z.core.$ZodIssue, "path" | "code">>,
): MessageKey {
  if (issue.code === "too_big" && issue.path?.[0] === "history")
    return "f5.historyLimit";
  if (issue.message === "Intake start range") return "f5.intakeRange";
  if (issue.message === "Intake future observation") return "f5.intakeFuture";
  return (
    schemaMessages[issue.message as keyof typeof schemaMessages] ??
    "f5.validation.value"
  );
}

// Additional acceptance rules in the installed server's validateIntakeDates.
// These are not yet expressed by the shared request schema (see F5 notes).
export function intakeDateIssues(
  input: import("./builder.js").BuilderInput,
  today: string,
): z.core.$ZodIssue[] {
  const limit = new Date(Date.parse(today) + 366 * 86400000)
    .toISOString()
    .slice(0, 10);
  const issues: z.core.$ZodIssue[] = [];
  const add = (path: (string | number)[], message: string) =>
    issues.push({ code: "custom", path, message });
  if (
    input.planning.earliest_start_date < today ||
    input.planning.latest_start_date > limit
  )
    add(["planning"], "Intake start range");
  if (input.history.status === "known")
    input.history.entries.forEach((entry, index) => {
      if (
        (entry.planted_on && entry.planted_on > today) ||
        (entry.harvested_on && entry.harvested_on > today)
      )
        add(["history", "entries", index], "Intake future observation");
    });
  if (input.crop_health.status === "reported")
    input.crop_health.observations.forEach((entry, index) => {
      if (entry.observed_on > today)
        add(
          ["crop_health", "observations", index],
          "Intake future observation",
        );
    });
  if (
    input.soil.status === "known" &&
    input.soil.observations.some(
      (entry) => entry.measured_on && entry.measured_on > today,
    )
  )
    add(["soil"], "Intake future observation");
  return issues;
}
