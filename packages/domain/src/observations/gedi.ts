// Tree and shrub context around a field from GEDI L4B 1 km mean aboveground
// biomass density cells. Pure: the caller supplies the stored cells.
export const GEDI_POLICY = {
  version: "gedi-policy-1",
  radiusKm: 3,
  // Half the diagonal of a 1 km cell: a cell centre farther than this cannot
  // be the cell that contains the field.
  fieldCellMaxKm: 0.75,
} as const;

export const GEDI_PROVENANCE = [
  {
    item: "GEDI L4B gridded aboveground biomass density, version 2.1",
    origin: "sourced" as const,
    reference:
      "Dubayah, R. et al. (2022) GEDI L4B Gridded Aboveground Biomass Density, Version 2.1, ORNL DAAC, doi:10.3334/ORNLDAAC/2299; mission weeks 19 to 223 (2019-04-18 to 2023-03-16)",
  },
  {
    item: "Nearest-cell and 3 km neighbourhood summary",
    origin: "engineering_judgment" as const,
    reference:
      "Rotavise summary: the cell holding the field, then the mean of cells with an estimate within 3 km; standard error of the mean assumes independent cells; no threshold is applied",
  },
] as const;

export type GediCell = {
  latitude: number;
  longitude: number;
  agbdMgHa: number;
  seMgHa: number | null;
};

const round = (v: number, digits = 3) => Number(v.toFixed(digits));
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
}

export function summarizeCanopyBiomass(
  cells: GediCell[],
  latitude: number,
  longitude: number,
) {
  const near = cells
    .map((c) => ({
      ...c,
      km: distanceKm(latitude, longitude, c.latitude, c.longitude),
    }))
    .filter((c) => c.km <= GEDI_POLICY.radiusKm)
    .sort((a, b) => a.km - b.km);
  const own =
    near[0] && near[0].km <= GEDI_POLICY.fieldCellMaxKm ? near[0] : null;
  const values = near.map((c) => c.agbdMgHa);
  const allSe = near.length > 0 && near.every((c) => c.seMgHa !== null);
  return {
    fieldCell: own
      ? {
          agbdMgHa: round(own.agbdMgHa),
          seMgHa: own.seMgHa === null ? null : round(own.seMgHa),
          distanceKm: round(own.km, 2),
        }
      : null,
    surroundings: {
      radiusKm: GEDI_POLICY.radiusKm,
      cellsInRadius: near.length,
      meanAgbdMgHa: near.length
        ? round(values.reduce((s, v) => s + v, 0) / near.length)
        : null,
      minAgbdMgHa: near.length ? round(Math.min(...values)) : null,
      maxAgbdMgHa: near.length ? round(Math.max(...values)) : null,
      standardErrorOfMeanMgHa: allSe
        ? round(
            Math.sqrt(near.reduce((s, c) => s + c.seMgHa! ** 2, 0)) /
              near.length,
          )
        : null,
    },
  };
}
