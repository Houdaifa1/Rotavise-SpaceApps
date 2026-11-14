import type {
  HistoricalAnalog,
  HistoricalCandidate,
  HistoricalPolicy,
  SampleStatistics,
} from "@rotavise/contracts";

export function sampleStatistics(values: number[]): SampleStatistics | null {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    populationStandardDeviation: Math.sqrt(
      values.reduce((n, v) => n + (v - mean) ** 2, 0) / values.length,
    ),
  };
}
const emptyStats = () => ({
  temperatureMeanDegC: null,
  rainfallMm: null,
  rainfallMmPerDay: null,
  longestDrySpellDays: null,
});
const emptyDifference = () => ({
  temperatureMeanDegC: null,
  rainfallMmPerDay: null,
  longestDrySpellDays: null,
});
export function summarizeAnalogs(
  analogs: HistoricalAnalog[],
  policy: HistoricalPolicy,
) {
  const complete = analogs.filter((a) => a.status === "complete");
  const earlier = complete.filter((a) => a.anchorYear <= policy.splitAfterYear);
  const later = complete.filter((a) => a.anchorYear > policy.splitAfterYear);
  const variable = (items: HistoricalAnalog[], cycle: 0 | 1) => ({
    temperatureMeanDegC: sampleStatistics(
      items.map((a) => a.cycles![cycle].latest.metrics.temperatureMean!.mean),
    ),
    rainfallMm: sampleStatistics(
      items.map((a) => a.cycles![cycle].latest.metrics.precipitation!.totalMm),
    ),
    rainfallMmPerDay: sampleStatistics(
      items.map(
        (a) => a.cycles![cycle].latest.metrics.precipitation!.meanMmPerDay,
      ),
    ),
    longestDrySpellDays: sampleStatistics(
      items.map(
        (a) =>
          a.cycles![cycle].latest.metrics.precipitation!.longestDrySpellDays,
      ),
    ),
  });
  const variability: HistoricalCandidate["variability"] =
    complete.length >= policy.minimumCompleteAnalogs
      ? [variable(complete, 0), variable(complete, 1)]
      : [emptyStats(), emptyStats()];
  const enough =
    earlier.length >= policy.minimumPeriodAnalogs &&
    later.length >= policy.minimumPeriodAnalogs;
  const delta = (cycle: 0 | 1) => {
    if (!enough) return emptyDifference();
    const e = variable(earlier, cycle),
      l = variable(later, cycle);
    return {
      temperatureMeanDegC:
        l.temperatureMeanDegC!.mean - e.temperatureMeanDegC!.mean,
      rainfallMmPerDay: l.rainfallMmPerDay!.mean - e.rainfallMmPerDay!.mean,
      longestDrySpellDays:
        l.longestDrySpellDays!.mean - e.longestDrySpellDays!.mean,
    };
  };
  const periodComparison: HistoricalCandidate["periodComparison"] = {
    earlierAnchorYears: earlier.map((a) => a.anchorYear),
    laterAnchorYears: later.map((a) => a.anchorYear),
    status: enough ? "available" : "insufficient_evidence",
    laterMinusEarlier: [delta(0), delta(1)],
  };
  return {
    completeAnchorYears: complete.map((a) => a.anchorYear),
    variability,
    periodComparison,
  };
}
