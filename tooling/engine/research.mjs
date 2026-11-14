// Explicit, small public GET probes. Research evidence only; never called by the engine or CI.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = process.argv[2] ?? ".artifacts/step-05-api-review";
await mkdir(directory, { recursive: true });
const nasa = (parameters) => {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.search = new URLSearchParams({
    parameters,
    community: "AG",
    longitude: "-6.3498",
    latitude: "32.3373",
    start: "20240227",
    end: "20240302",
    format: "JSON",
    "time-standard": "UTC",
  }).toString();
  return url.href;
};
const samples = [
  {
    id: "nasa-power-manager",
    kind: "metadata_only",
    url: "https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=daily",
  },
  {
    id: "nasa-power-current",
    kind: "weather_data",
    url: nasa("T2M_MIN,T2M_MAX,T2M,PRECTOTCORR"),
  },
  {
    id: "nasa-power-additional",
    kind: "weather_data",
    url: nasa("T2M_MIN,T2M_MAX,T2M,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN,PS"),
  },
  { id: "nasa-power-imerg", kind: "weather_data", url: nasa("IMERG_PRECTOT") },
  {
    id: "open-meteo-era5",
    kind: "weather_data",
    url: "https://archive-api.open-meteo.com/v1/archive?latitude=32.3373&longitude=-6.3498&start_date=2024-02-27&end_date=2024-03-02&daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum,et0_fao_evapotranspiration&models=era5&timezone=GMT&elevation=nan&cell_selection=nearest",
  },
  {
    id: "gpm-imerg-collection",
    kind: "metadata_only",
    url: "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=GPM_3IMERGDF&version=07&page_size=5",
  },
  {
    id: "smap-collection",
    kind: "metadata_only",
    url: "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=SPL4SMGP&version=008&page_size=5",
  },
  {
    id: "smap-appeears-layers",
    kind: "metadata_only",
    url: "https://appeears.earthdatacloud.nasa.gov/api/product/SPL4SMGP.008",
  },
  {
    id: "soilgrids-ph",
    kind: "soil_prediction",
    url: "https://rest.isric.org/soilgrids/v2.0/properties/query?lon=-6.3498&lat=32.3373&property=phh2o&depth=0-5cm&value=mean&value=Q0.05&value=Q0.95",
  },
];
const manifest = {
  purpose:
    "Small connectivity/data/metadata observations, not accuracy or uptime evidence; no new integration selected",
  samples: [],
};
const selectedIds = process.argv[3]?.split(",");
if (selectedIds?.some((id) => !samples.some((s) => s.id === id)))
  throw new Error("UNKNOWN_RESEARCH_SAMPLE");
for (const sample of samples.filter(
  (s) => !selectedIds || selectedIds.includes(s.id),
)) {
  const started = performance.now();
  const entry = { ...sample, retrievedAt: new Date().toISOString() };
  try {
    const response = await fetch(sample.url, {
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const body = await response.text();
    Object.assign(entry, {
      finalUrl: response.url,
      status: response.status,
      elapsedMs: Math.round(performance.now() - started),
      bytes: Buffer.byteLength(body),
      sha256: createHash("sha256").update(body).digest("hex"),
      contentType: response.headers.get("content-type"),
      rawFile: `${sample.id}.raw`,
      observations: null,
    });
    await writeFile(`${directory}/${entry.rawFile}`, body);
    if (response.ok) {
      const data = JSON.parse(body);
      if (sample.id === "nasa-power-manager")
        entry.observations = {
          parameters: Object.fromEntries(
            Object.entries(data).filter(([key]) =>
              [
                "T2M_MIN",
                "T2M_MAX",
                "T2M",
                "PRECTOTCORR",
                "RH2M",
                "WS2M",
                "ALLSKY_SFC_SW_DWN",
                "PS",
                "IMERG_PRECTOT",
              ].includes(key),
            ),
          ),
        };
      else if (sample.id.startsWith("nasa-power"))
        entry.observations = {
          header: data.header,
          units: data.parameters,
          daysPerParameter: Object.fromEntries(
            Object.entries(data.properties.parameter).map(([k, values]) => [
              k,
              Object.keys(values).length,
            ]),
          ),
          data: data.properties.parameter,
        };
      else if (sample.id === "open-meteo-era5")
        entry.observations = {
          latitude: data.latitude,
          longitude: data.longitude,
          elevation: data.elevation,
          utcOffsetSeconds: data.utc_offset_seconds,
          units: data.daily_units,
          data: data.daily,
        };
      else if (sample.id.endsWith("collection"))
        entry.observations = {
          entries: data.feed.entry.map((e) => ({
            id: e.id,
            shortName: e.short_name,
            version: e.version_id,
            title: e.title,
            doi: e.doi,
            start: e.time_start,
            end: e.time_end,
            links: e.links,
          })),
        };
      else if (sample.id === "smap-appeears-layers")
        entry.observations = {
          layers: Object.fromEntries(
            Object.entries(data).filter(([key]) =>
              /sm_rootzone|sm_surface/.test(key),
            ),
          ),
        };
      else entry.observations = data;
      if (sample.kind === "weather_data") {
        const series = sample.id.startsWith("nasa-power")
          ? Object.values(data.properties.parameter)
          : Object.entries(data.daily)
              .filter(([key]) => key !== "time")
              .map(([, values]) => values);
        entry.assessment =
          series.length > 0 &&
          series.every(
            (values) =>
              Object.values(values).length === 5 &&
              Object.values(values).every(
                (value) => Number.isFinite(value) && value !== -999,
              ),
          )
            ? "data_returned"
            : "no_data";
      } else if (sample.kind === "metadata_only") {
        entry.assessment =
          sample.id === "nasa-power-manager"
            ? Object.keys(entry.observations.parameters).length === 9
              ? "metadata_returned"
              : "no_data"
            : sample.id.endsWith("collection")
              ? entry.observations.entries.length > 0
                ? "metadata_returned"
                : "no_data"
              : Object.keys(entry.observations.layers).length > 0
                ? "metadata_returned"
                : "no_data";
      } else {
        entry.assessment = data.properties.layers.some((layer) =>
          layer.depths.some((depth) =>
            Object.values(depth.values).some((value) => Number.isFinite(value)),
          ),
        )
          ? "data_returned"
          : "no_data";
      }
    }
  } catch (error) {
    Object.assign(entry, {
      elapsedMs: Math.round(performance.now() - started),
      error: error.name,
    });
  }
  entry.assessment ??= "request_failed";
  manifest.samples.push(entry);
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      id: entry.id,
      status: entry.status ?? null,
      elapsedMs: entry.elapsedMs,
      bytes: entry.bytes ?? null,
      error: entry.error ?? null,
      assessment: entry.assessment,
    }),
  );
}
if (
  manifest.samples.some(
    (s) => s.status !== 200 || s.error || s.assessment === "no_data",
  )
)
  process.exitCode = 1;
