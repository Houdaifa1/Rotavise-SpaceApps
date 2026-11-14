// FAO-56 crop water use with temperature data only. Reference evapotranspiration
// follows the Hargreaves equation (FAO-56 eq. 52) with extraterrestrial radiation
// from eq. 21 converted by eq. 20; the crop curve follows the single coefficient
// method (Kc ini, mid, end over four stage lengths, chapter 6).
const SOLAR_CONSTANT = 0.082; // MJ m-2 min-1
export function extraterrestrialRadiationMm(
  latitude: number,
  dayOfYear: number,
) {
  const phi = (latitude * Math.PI) / 180;
  const angle = (2 * Math.PI * dayOfYear) / 365;
  const dr = 1 + 0.033 * Math.cos(angle);
  const delta = 0.409 * Math.sin(angle - 1.39);
  const ws = Math.acos(
    Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta))),
  );
  const mj =
    ((24 * 60) / Math.PI) *
    SOLAR_CONSTANT *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  return 0.408 * mj;
}
export function referenceEvapotranspirationMm(
  temperatureMax: number,
  temperatureMin: number,
  latitude: number,
  dayOfYear: number,
) {
  const mean = (temperatureMax + temperatureMin) / 2;
  const range = Math.max(0, temperatureMax - temperatureMin);
  return Math.max(
    0,
    0.0023 *
      (mean + 17.8) *
      Math.sqrt(range) *
      extraterrestrialRadiationMm(latitude, dayOfYear),
  );
}
export type CropCurve = {
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  stageLengths: readonly [number, number, number, number];
};
// Kc on a position (0 to 1) through the cycle; FAO's stage lengths are scaled
// to the crop's duration by their shares.
export function cropCoefficient(curve: CropCurve, position: number) {
  const [ini, dev, mid, late] = curve.stageLengths;
  const total = ini + dev + mid + late;
  const at = position * total;
  if (at <= ini) return curve.kcIni;
  if (at <= ini + dev)
    return curve.kcIni + ((at - ini) / dev) * (curve.kcMid - curve.kcIni);
  if (at <= ini + dev + mid) return curve.kcMid;
  return (
    curve.kcMid + ((at - ini - dev - mid) / late) * (curve.kcEnd - curve.kcMid)
  );
}
