import { benefitCoverScenarios } from "./benefits.js";
import {
  rotationAnalysisContextSchema,
  type RotationAnalysisContext,
  type AnalysisGrid,
  type CatalogBundleV2,
  type PlanRequestV2,
  type RainReference,
} from "@rotavise/contracts";

export const emptyAnalysisContext = (): RotationAnalysisContext => ({
  fieldId: null,
  terrain: null,
  ecostress: null,
  waterStorage: null,
  observations: [],
});
export function analysisGrid(
  input: AnalysisGrid["input"],
  meters: number | null = null,
): AnalysisGrid {
  return {
    input,
    use: "not_used",
    grid: "not_found",
    resolution: { meters, latitudeDegrees: null, longitudeDegrees: null },
    cell: null,
    row: null,
    column: null,
    tile: null,
    selection: "not_used; no source selection for this result",
    samplePoints: [],
    evidenceIds: [],
    resampling: "none_added",
    upstreamResampling:
      "not_found; see provider evidence for upstream processing",
  };
}
export function rotationOutputs(
  input: PlanRequestV2,
  catalog: CatalogBundleV2,
  raw: unknown,
  weatherIds: string[],
  weatherCells: { latitude: number; longitude: number }[],
  rain: RainReference | null,
  corrected: boolean,
  future: {
    cell: { latitude: number; longitude: number } | null;
    unitIds: string[];
  },
  benefitsV2 = false,
) {
  const context = rotationAnalysisContextSchema.parse(
    raw ?? emptyAnalysisContext(),
  );
  if (context.fieldId !== (input.field_id ?? null))
    throw new Error("ROTATION_ANALYSIS_FIELD_MISMATCH");
  const grids = [
    analysisGrid("POWER"),
    analysisGrid("GPM"),
    analysisGrid("HLS", 30),
    analysisGrid("SMAP", 9000),
    analysisGrid("NEX-GDDP"),
    analysisGrid("NASADEM", 30),
    analysisGrid("GRACE"),
    analysisGrid("ECOSTRESS", 70),
    analysisGrid("MODIS", 250),
    analysisGrid("GEDI", 1000),
  ];
  const grid = (id: AnalysisGrid["input"]) =>
    grids.find((g) => g.input === id)!;
  if (weatherIds.length)
    Object.assign(grid("POWER"), {
      use: "engine_input",
      grid: "POWER source cells: MERRA-2 meteorology / CERES solar",
      cell: weatherCells.length === 1 ? weatherCells[0] : null,
      samplePoints: weatherCells,
      evidenceIds: weatherIds,
      selection:
        "actual weather snapshot request points; current adapter uses source-cell intersection centre",
      resolution: {
        meters: null,
        latitudeDegrees: 0.5,
        longitudeDegrees: 0.625,
      },
      upstreamResampling:
        "POWER meteorology native cell; solar source 1 degree; provider processing retained",
    });
  if (rain && corrected)
    Object.assign(grid("GPM"), {
      use: "engine_input",
      grid: rain.dataset,
      cell: rain.cell,
      resolution: { meters: null, latitudeDegrees: 0.1, longitudeDegrees: 0.1 },
      selection:
        "GPM monthly climatology scales POWER daily rain; no spatial resampling",
    });
  if (future.unitIds.length)
    Object.assign(grid("NEX-GDDP"), {
      use: "engine_input",
      grid: "NEX-GDDP-CMIP6",
      cell: future.cell,
      resolution: {
        meters: null,
        latitudeDegrees: 0.25,
        longitudeDegrees: 0.25,
      },
      evidenceIds: future.unitIds,
      selection: "prepared source cell in the 1 degree preparation tile",
      tile: future.cell
        ? `${Math.floor(future.cell.latitude)},${Math.floor(future.cell.longitude)}`
        : null,
    });
  for (const [id, snapshot] of [
    ["NASADEM", context.terrain],
    ["ECOSTRESS", context.ecostress],
  ] as const)
    if (snapshot) {
      Object.assign(grid(id), {
        use: "reported_context",
        grid: id === "NASADEM" ? "NASADEM_NC.001" : "ECOSTRESS L2T/L4T",
        samplePoints: snapshot.samplePoints,
        evidenceIds: [snapshot.id, snapshot.sha256],
        selection:
          "pinned AppEEARS point extraction; native pixel identifiers not returned in summary",
      });
      if (snapshot.result.kind === "terrain")
        grid(id).resolution.meters = snapshot.result.resolutionMeters;
    }
  if (context.waterStorage)
    Object.assign(grid("GRACE"), {
      use: "reported_context",
      grid: context.waterStorage.result.product,
      cell: {
        latitude: context.waterStorage.result.cell.latitude,
        longitude: context.waterStorage.result.cell.longitude,
      },
      evidenceIds: [context.waterStorage.sha256],
      selection:
        "nearest imported regional mascon grid cell; effective resolution is hundreds of kilometres",
    });
  for (const observation of context.observations)
    Object.assign(grid(observation.input), observation);
  const crops = catalog.profiles.map((p) => p.id).sort();
  const priorities = [];
  const p = input.preferences;
  if (p.equipment_limits)
    priorities.push({
      id: "equipment_limits" as const,
      status: "not_found" as const,
      rankingApplied: false as const,
      code: "EQUIPMENT_DATA_UNAVAILABLE" as const,
      cropIds: crops,
      note: "Catalog has no structured machinery capacities or required-operation evidence. No equipment filter applied.",
    });
  if (p.market_access !== undefined)
    priorities.push({
      id: "market_access" as const,
      status: "not_found" as const,
      rankingApplied: false as const,
      code: "MARKET_ACCESS_DATA_UNAVAILABLE" as const,
      cropIds: crops,
      note: "Catalog has no structured crop market-access requirements. No access filter applied.",
    });
  if (p.income_weight !== undefined)
    priorities.push({
      id: "income_weight" as const,
      status: "not_found" as const,
      rankingApplied: false as const,
      code: "INCOME_DATA_UNAVAILABLE" as const,
      cropIds: crops,
      note: "Catalog has no comparable net income with currency, area, period and costs. Yield references are not income; requested weight is unapplied.",
    });
  return {
    version: "rotation-outputs-1" as const,
    analysisContext: context,
    grids,
    terrain: {
      rankingApplied: false as const,
      slope: context.terrain?.result.slope ?? null,
      erosion: {
        code: "EROSION_FACTORS_MISSING" as const,
        status: "unranked_incomplete_rusle" as const,
        ls: context.terrain?.result.erosion ?? null,
        missingFactors: (context.terrain?.result.erosion
          ? [
              "R",
              "K",
              ...(catalog.profiles.every(
                (p) => coverFactor(p, benefitsV2).status === "sourced",
              )
                ? []
                : ["C"]),
              "P",
            ]
          : [
              "R",
              "K",
              "LS",
              ...(catalog.profiles.every(
                (p) => coverFactor(p, benefitsV2).status === "sourced",
              )
                ? []
                : ["C"]),
              "P",
            ]) as ("R" | "K" | "LS" | "C" | "P")[],
        soilLossTPerHaPerYear: null,
        cropCover: catalog.profiles.map((profile) => ({
          cropId: profile.id,
          ...coverFactor(profile, benefitsV2),
          catalogReferenceIds: (profile.references ?? [])
            .filter((r) => r.topic === "erosion_protection")
            .map((r) => r.id),
        })),
      },
      infiltrationDrainage: {
        code: "INFILTRATION_DRAINAGE_UNKNOWN" as const,
        status: "not_found" as const,
        note: "Slope and LS are reported context. No measured infiltration or drainage is available; regional GRACE storage and ECOSTRESS surface stress do not establish either.",
      },
    },
    priorities,
  };
}

function coverFactor(
  profile: CatalogBundleV2["profiles"][number],
  benefitsV2 = false,
) {
  const scenarios = benefitsV2 ? benefitCoverScenarios(profile) : [];
  // Ambiguous ranges/multiple factors cannot become a single field estimate.
  const refs = (profile.references ?? []).filter(
    (r) =>
      r.topic === "rusle_cover_management_factor" &&
      r.value?.unit === "dimensionless" &&
      r.value.min !== null &&
      r.value.min === r.value.max &&
      r.value.min >= 0,
  );
  const ref = refs.length === 1 ? refs[0]! : null;
  return {
    ...(benefitsV2 ? { scenarios } : {}),
    status: scenarios.length
      ? ("sourced" as const)
      : ref
        ? ref.citations.length
          ? ("sourced" as const)
          : ("model_recall" as const)
        : ("not_found" as const),
    factor: ref?.value?.min ?? null,
    referenceId: ref?.id ?? null,
    citations: ref?.citations ?? [],
    recall: ref?.recall ?? null,
  };
}
