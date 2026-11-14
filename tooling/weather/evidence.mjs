// Explicit live provider evaluation, never part of the deterministic CI gate.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = process.argv[2] ?? ".artifacts/weather-evidence";
await mkdir(directory, { recursive: true });
const samples = [
  {
    name: "beni-mellal-leap",
    latitude: 32.3373,
    longitude: -6.3498,
    start: "2024-02-27",
    end: "2024-03-02",
  },
  {
    name: "sydney-year",
    latitude: -33.8688,
    longitude: 151.2093,
    start: "2023-12-30",
    end: "2024-01-03",
  },
  {
    name: "beni-mellal-season",
    latitude: 32.3373,
    longitude: -6.3498,
    start: "2023-12-01",
    end: "2024-03-31",
  },
];
const manifest = [];
for (const sample of samples) {
  for (const provider of ["nasa-power", "open-meteo-era5"]) {
    const url = new URL(
      provider === "nasa-power"
        ? "https://power.larc.nasa.gov/api/temporal/daily/point"
        : "https://archive-api.open-meteo.com/v1/archive",
    );
    const params =
      provider === "nasa-power"
        ? {
            parameters: "T2M_MIN,T2M_MAX,T2M,PRECTOTCORR",
            community: "AG",
            format: "JSON",
            "time-standard": "UTC",
            latitude: sample.latitude,
            longitude: sample.longitude,
            start: sample.start.replaceAll("-", ""),
            end: sample.end.replaceAll("-", ""),
          }
        : {
            daily:
              "temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum",
            models: "era5",
            timezone: "GMT",
            temperature_unit: "celsius",
            precipitation_unit: "mm",
            elevation: "nan",
            cell_selection: "nearest",
            latitude: sample.latitude,
            longitude: sample.longitude,
            start_date: sample.start,
            end_date: sample.end,
          };
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, String(value));
    const started = performance.now();
    const entry = {
      provider,
      sample,
      url: url.href,
      retrievedAt: new Date().toISOString(),
    };
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60000),
        redirect: "error",
      });
      const raw = await response.text();
      Object.assign(entry, {
        status: response.status,
        elapsedMs: Math.round(performance.now() - started),
        bytes: Buffer.byteLength(raw),
        sha256: createHash("sha256").update(raw).digest("hex"),
        file: `${provider}-${sample.name}.json`,
      });
      await writeFile(`${directory}/${entry.file}`, raw);
    } catch (error) {
      Object.assign(entry, {
        status: null,
        elapsedMs: Math.round(performance.now() - started),
        error: error.name,
      });
    }
    manifest.push(entry);
    await writeFile(
      `${directory}/manifest.json`,
      JSON.stringify(manifest, null, 2) + "\n",
    );
    console.log(JSON.stringify(entry));
  }
}
