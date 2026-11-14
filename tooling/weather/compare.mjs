import { readFile, writeFile } from "node:fs/promises";
const directory = process.argv[2] ?? ".artifacts/weather-evidence";
const nasa = JSON.parse(
  await readFile(`${directory}/nasa-power-beni-mellal-season.json`, "utf8"),
);
const era5 = JSON.parse(
  await readFile(
    `${directory}/open-meteo-era5-beni-mellal-season.json`,
    "utf8",
  ),
);
const mapping = {
  T2M_MIN: "temperature_2m_min",
  T2M_MAX: "temperature_2m_max",
  T2M: "temperature_2m_mean",
  PRECTOTCORR: "precipitation_sum",
};
const statistics = {
  purpose: "inter-provider-differences-not-accuracy-or-ground-truth",
  days: era5.daily.time.length,
  variables: {},
};
for (const [key, variable] of Object.entries(mapping)) {
  const differences = era5.daily[variable].map((value, index) => {
    const original =
      nasa.properties.parameter[key][
        era5.daily.time[index].replaceAll("-", "")
      ];
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(original) ||
      original === -999
    )
      throw new Error("COMPARISON_INCOMPLETE");
    return Math.abs(value - original);
  });
  statistics.variables[key] = {
    meanAbsoluteDifference: Number(
      (differences.reduce((a, b) => a + b, 0) / differences.length).toFixed(4),
    ),
    maxAbsoluteDifference: Number(Math.max(...differences).toFixed(4)),
  };
}
statistics.precipitationTotal = {
  nasaPower: Number(
    Object.values(nasa.properties.parameter.PRECTOTCORR)
      .reduce((a, b) => a + b, 0)
      .toFixed(2),
  ),
  openMeteoERA5: Number(
    era5.daily.precipitation_sum.reduce((a, b) => a + b, 0).toFixed(2),
  ),
  unit: "mm",
};
await writeFile(
  `${directory}/comparison.json`,
  JSON.stringify(statistics, null, 2) + "\n",
);
console.log(JSON.stringify(statistics));
