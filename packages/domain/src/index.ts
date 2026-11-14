import { prepareCatalog } from "@rotavise/catalog";
import { evaluateSequenceCore } from "./sequences/generate.js";
import { assessHistoricalCore } from "./climate/assess.js";
export { EngineInputError, EngineLimitError } from "./sequences/input.js";
export { sequenceLimits } from "./sequences/generate.js";
export { measureHistoricalWindow } from "./climate/assess.js";
export { normalizedWeatherHash } from "./evidence/identity.js";
export { selectPlanningComparisons } from "./comparison/selection.js";
export {
  assessRotations,
  rotationWeatherNeeds,
  rotationScenarioNeeds,
  rotationNearTermNeeds,
  RotationInputError,
} from "./rotation/assess.js";
export {
  HistoricalInputError,
  HistoricalLimitError,
  historicalLimits,
} from "./climate/weather.js";
export function assessHistoricalSequences(
  request: unknown,
  catalog: unknown,
  context: unknown,
  weather: unknown,
  policy: unknown,
) {
  return assessHistoricalCore(
    request,
    prepareCatalog(catalog).catalog,
    context,
    weather,
    policy,
    false,
  );
}
export function generateSequences(
  request: unknown,
  catalog: unknown,
  context: unknown,
) {
  return evaluateSequenceCore(
    request,
    prepareCatalog(catalog).catalog,
    context,
  );
}
export { addSoilCarbon, yieldRequestWeather } from "./rotation/assess.js";
export { syncStrategyRanks } from "./rotation/strategies.js";
export {
  attachYields,
  rankWithYields,
  textureClass,
  yieldSimulations,
} from "./rotation/yields.js";
export {
  clearPixel,
  vegetationHistory,
  monthlyTotals,
  VEGETATION_LIMITATIONS,
  type PixelObservation,
} from "./observations/vegetation.js";
export {
  analyzeVegetation,
  hlsGranulesFromList,
  rainSeries,
  vegetationAnalysisPolicy,
  VEGETATION_GLOSSARY,
  type VegetationGlossaryKey,
} from "./observations/vegetation-analysis.js";
export {
  analyzeVegetationHistory,
  vegetationHistoryPolicy,
  VEGETATION_HISTORY_GLOSSARY,
} from "./observations/vegetation-history.js";
export {
  GEDI_POLICY,
  GEDI_PROVENANCE,
  distanceKm,
  summarizeCanopyBiomass,
  type GediCell,
} from "./observations/gedi.js";
export {
  TERRAIN_POLICY,
  TERRAIN_PROVENANCE,
  TerrainInputError,
  FAO_SLOPE_CLASSES,
  faoSlopeClass,
  gradientAt,
  lsFactor,
  lsReferenceBand,
  rusleL,
  rusleS,
  summarizeTerrain,
  type ElevationGrid,
  type RingPoint,
} from "./terrain/terrain.js";
export {
  WATER_TREND_POLICY,
  WaterTrendError,
  waterStorageTrend,
  type StorageMonth,
} from "./terrain/water-trend.js";
export {
  ECOSTRESS_POLICY,
  ECOSTRESS_POLICY_V1,
  summarizeEcostress,
  type EcostressPolicyVersion,
  type EcostressPixel,
} from "./terrain/ecostress.js";
export { GLOSSARY, GLOSSARY_VERSION, glossaryFor } from "./glossary/index.js";

export {
  rankResearchCandidates,
  syncResearchStrategies,
} from "./rotation/research.js";
