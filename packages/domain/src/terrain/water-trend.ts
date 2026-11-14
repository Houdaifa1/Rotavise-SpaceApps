// Long-term trend in GRACE / GRACE-FO terrestrial water storage anomalies for
// one grid cell. Ordinary least squares with an annual and a semi-annual cycle
// fitted beside the trend, and a standard error widened for month-to-month
// autocorrelation (lag-1 residual correlation, effective-sample inflation).
// Regional context only: the satellites resolve water storage over areas of
// hundreds of kilometres, not a field.
export const WATER_TREND_POLICY = Object.freeze({
  version: "water-trend-policy-1",
  minimumMonths: 36,
  minimumSpanYears: 5,
  maximumAutocorrelation: 0.95,
});
export class WaterTrendError extends Error {
  constructor(readonly code: "INVALID_SERIES" | "SERIES_TOO_SHORT") {
    super(code);
  }
}
export type StorageMonth = { month: string; lweCm: number };
const monthText = /^(\d{4})-(0[1-9]|1[0-2])$/;
const round = (v: number, n: number) => Number(v.toFixed(n));
// Solves A x = b by Gaussian elimination with partial pivoting.
function solve(a: number[][], b: number[]) {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12)
      throw new WaterTrendError("INVALID_SERIES");
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = col + 1; r < n; r++) {
      const f = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= n; c++) m[r]![c] = m[r]![c]! - f * m[col]![c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= m[r]![c]! * x[c]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}
export function waterStorageTrend(
  series: StorageMonth[],
  policy = WATER_TREND_POLICY,
) {
  const sorted = [...series].sort((a, b) => (a.month < b.month ? -1 : 1));
  const seen = new Set<string>();
  const points = sorted.map((s) => {
    const m = monthText.exec(s.month);
    if (
      !m ||
      !Number.isFinite(s.lweCm) ||
      Math.abs(s.lweCm) > 2000 ||
      seen.has(s.month)
    )
      throw new WaterTrendError("INVALID_SERIES");
    seen.add(s.month);
    const index = Number(m[1]) * 12 + Number(m[2]) - 1;
    return { ...s, index, month0: Number(m[2]) - 1 };
  });
  if (points.length < policy.minimumMonths)
    throw new WaterTrendError("SERIES_TOO_SHORT");
  const first = points[0]!.index;
  const last = points[points.length - 1]!;
  const spanYears = (last.index - first) / 12;
  if (spanYears < policy.minimumSpanYears)
    throw new WaterTrendError("SERIES_TOO_SHORT");
  const design = points.map((p) => {
    const phase = (2 * Math.PI * p.month0) / 12;
    return [
      1,
      (p.index - first) / 12,
      Math.sin(phase),
      Math.cos(phase),
      Math.sin(2 * phase),
      Math.cos(2 * phase),
    ];
  });
  const k = 6;
  const xtx = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) =>
      design.reduce((s, row) => s + row[i]! * row[j]!, 0),
    ),
  );
  const xty = Array.from({ length: k }, (_, i) =>
    design.reduce((s, row, n) => s + row[i]! * points[n]!.lweCm, 0),
  );
  const beta = solve(xtx, xty);
  const residuals = design.map(
    (row, n) => points[n]!.lweCm - row.reduce((s, v, i) => s + v * beta[i]!, 0),
  );
  const sigma2 = residuals.reduce((s, r) => s + r * r, 0) / (points.length - k);
  // Variance of the trend coefficient: sigma^2 * [(X'X)^-1]_11.
  const unit = solve(xtx, [0, 1, 0, 0, 0, 0]);
  let numerator = 0,
    denominator = 0;
  for (let i = 0; i < residuals.length; i++) {
    denominator += residuals[i]! * residuals[i]!;
    if (i > 0) numerator += residuals[i]! * residuals[i - 1]!;
  }
  const r1 = Math.min(
    policy.maximumAutocorrelation,
    Math.max(0, denominator > 0 ? numerator / denominator : 0),
  );
  const inflation = Math.sqrt((1 + r1) / (1 - r1));
  const standardError = Math.sqrt(Math.max(0, sigma2 * unit[1]!)) * inflation;
  const trend = beta[1]!;
  const half = 1.96 * standardError;
  const months = points.length;
  const spanMonths = last.index - first + 1;
  return {
    months,
    missingMonths: spanMonths - months,
    period: { start: points[0]!.month, end: last.month },
    trendCmPerYear: round(trend, 2),
    standardErrorCmPerYear: round(standardError, 2),
    interval95CmPerYear: [round(trend - half, 2), round(trend + half, 2)] as [
      number,
      number,
    ],
    residualStdCm: round(Math.sqrt(sigma2), 2),
    autocorrelation: round(r1, 2),
    direction:
      Math.abs(trend) <= half
        ? ("no_clear_trend" as const)
        : trend < 0
          ? ("declining" as const)
          : ("rising" as const),
    latest: { month: last.month, anomalyCm: round(last.lweCm, 2) },
  };
}
