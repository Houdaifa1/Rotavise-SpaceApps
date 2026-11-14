// Records the exact supplier responses behind Step 11's access decisions:
// POWER values inside and across grid cells, and one NEX-GDDP-CMIP6 v2.0
// tile per calendar type. Usage: node tooling/climate-scenarios/record-evidence.mjs <directory>
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("DIRECTORY_REQUIRED");
await mkdir(directory, { recursive: true });
const manifest = [];
async function record(name, url, file) {
  const started = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(join(directory, file), bytes);
  manifest.push({
    name,
    url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    retrievedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    file,
  });
}

// Points inside one MERRA-2 cell (centre 32.5, -6.25) and just across its
// edges at latitude 32.25 and longitude -6.5625; solar edges at 32 and -6.
const points = [
  [32.3, -6.4],
  [32.7, -6.1],
  [32.5, -6.28125],
  [32.26, -6.4],
  [32.24, -6.4],
  [32.3, -6.55],
  [32.3, -6.58],
  [31.99, -6.4],
  [32.3, -5.99],
];
for (const [latitude, longitude] of points) {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  for (const [key, value] of Object.entries({
    parameters: "T2M_MIN,T2M_MAX,T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN",
    community: "AG",
    format: "JSON",
    "time-standard": "UTC",
    latitude,
    longitude,
    start: "20200101",
    end: "20200107",
  }))
    url.searchParams.set(key, String(value));
  await record(
    `power-${latitude}-${longitude}`,
    url.href,
    `power-${latitude}_${longitude}.json`,
  );
}

const NCSS = "https://ds.nccs.nasa.gov/thredds/ncss/grid/AMES/NEX/GDDP-CMIP6";
const units = [
  ["MRI-ESM2-0", "r1i1p1f1", "gn", "historical", "tasmax", 1988],
  ["IPSL-CM6A-LR", "r1i1p1f1", "gr", "ssp585", "tasmin", 2052],
  ["GFDL-ESM4", "r1i1p1f1", "gr1", "ssp245", "tas", 2052],
  ["UKESM1-0-LL", "r1i1p1f2", "gn", "historical", "tasmax", 2000],
];
for (const [model, variant, grid, experiment, variable, year] of units) {
  const file = `${variable}_day_${model}_${experiment}_${variant}_${grid}_${year}_v2.0.nc`;
  const url = `${NCSS}/${model}/${experiment}/${variant}/${variable}/${file}?var=${variable}&north=32.875&south=32.125&west=-6.875&east=-6.125&temporal=all&accept=netcdf3`;
  await record(`nex-${model}-${experiment}-${variable}-${year}`, url, file);
}
await writeFile(
  join(directory, "manifest.json"),
  JSON.stringify(
    {
      purpose:
        "Step 11 access evidence: POWER grid-cell behaviour and NEX-GDDP-CMIP6 v2.0 tile responses",
      attribution: {
        power:
          "NASA Langley Research Center POWER Project; https://power.larc.nasa.gov/",
        nexGddpCmip6:
          "NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6) v2.0, NASA Center for Climate Simulation; Thrasher et al. 2022, Scientific Data 9, 262. File metadata states cmip6_license CC-BY-SA 4.0; the AWS registry entry states CC0 since September 2022.",
      },
      responses: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(manifest.map((m) => [m.name, m.bytes, m.elapsedMs])),
);
