import type { FieldProfile } from "@rotavise/contracts";
export type SoilReading = Extract<
  FieldProfile["soil"],
  { status: "known" }
>["observations"][number];
export type HealthReport = Extract<
  FieldProfile["crop_health"],
  { status: "reported" }
>["observations"][number];
export type Availability =
  | "unknown"
  | Extract<FieldProfile["water"], { status: "reported" }>["availability"];

export function soilWith(
  profile: FieldProfile,
  metric: SoilReading["metric"],
  reading?: SoilReading,
): FieldProfile["soil"] {
  const previous =
    profile.soil.status === "known" ? profile.soil.observations : [];
  const observations = previous.filter((item) => item.metric !== metric);
  if (reading) observations.push(reading);
  return observations.length
    ? { status: "known", observations }
    : { status: "unknown" };
}
export function waterWith(availability: Availability): FieldProfile["water"] {
  return availability === "unknown"
    ? { status: "unknown" }
    : { status: "reported", availability };
}
export function sameReport(a: HealthReport, b: HealthReport) {
  return (
    a.crop_id === b.crop_id &&
    a.kind === b.kind &&
    a.name === b.name &&
    a.observed_on === b.observed_on &&
    a.source === b.source &&
    a.confirmation === b.confirmation
  );
}
export function healthWith(
  profile: FieldProfile,
  previous?: HealthReport,
  report?: HealthReport,
): FieldProfile["crop_health"] {
  const observations =
    profile.crop_health.status === "reported"
      ? profile.crop_health.observations.filter(
          (item) => !previous || !sameReport(item, previous),
        )
      : [];
  if (report) observations.push(report);
  return observations.length
    ? { status: "reported", observations }
    : { status: "unknown" };
}
