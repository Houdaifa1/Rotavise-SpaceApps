// Records real AppEEARS and Giovanni responses for Step 11 Part B. Reads the
// Earthdata credentials from the environment; never prints or stores them,
// tokens or signed download URLs. Points are on the public Tadla irrigated
// plain, not a farmer's field.
// Usage: node --env-file=.env tooling/earth-observations/record-evidence.mjs <directory>
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = process.argv[2];
const user = process.env.EARTHDATA_USERNAME;
const password = process.env.EARTHDATA_PASSWORD;
if (!directory || !user || !password)
  throw new Error("ARGUMENTS_OR_CREDENTIALS_MISSING");
await mkdir(directory, { recursive: true });
const basic = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
const API = "https://appeears.earthdatacloud.nasa.gov/api";
const manifest = [];
const sha = (b) => createHash("sha256").update(b).digest("hex");
async function save(name, file, bytes, meta = {}) {
  await writeFile(join(directory, file), bytes);
  manifest.push({
    name,
    file,
    bytes: bytes.byteLength,
    sha256: sha(bytes),
    retrievedAt: new Date().toISOString(),
    ...meta,
  });
}
// Brief network failures are retried; HTTP errors are returned to the caller.
async function call(path, init = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(API + path, {
        ...init,
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      if (attempt >= 5) throw error;
      console.log(
        JSON.stringify({ step: "network-retry", attempt: attempt + 1 }),
      );
      await delay(10000 * (attempt + 1));
    }
  }
}
// Four points about 30 m apart in one block of the irrigated plain.
const points = [
  [32.4, -6.55],
  [32.4003, -6.55],
  [32.4, -6.5496],
  [32.4003, -6.5496],
].map(([latitude, longitude], i) => ({
  id: `p${i + 1}`,
  category: "tadla-plain",
  latitude,
  longitude,
}));

const login = await call("/login", {
  method: "POST",
  headers: { authorization: basic, "content-length": "0" },
});
if (!login.ok) throw new Error(`APPEEARS_LOGIN_${login.status}`);
const { token } = await login.json();
const bearer = { authorization: `Bearer ${token}` };
console.log(JSON.stringify({ step: "appeears-login", ok: true }));
try {
  const task = {
    task_type: "point",
    task_name: "rotavise-step11-evidence",
    params: {
      dates: [{ startDate: "01-01-2023", endDate: "12-31-2024" }],
      layers: [
        { product: "HLSS30.020", layer: "B04" },
        { product: "HLSS30.020", layer: "B8A" },
        { product: "HLSS30.020", layer: "Fmask" },
        { product: "HLSL30.020", layer: "B04" },
        { product: "HLSL30.020", layer: "B05" },
        { product: "HLSL30.020", layer: "Fmask" },
        { product: "SPL4SMGP.008", layer: "Geophysical_Data_sm_rootzone_pctl" },
        { product: "SPL4SMGP.008", layer: "Geophysical_Data_sm_rootzone" },
      ],
      coordinates: points,
    },
  };
  await save(
    "appeears-task-request",
    "appeears-task-request.json",
    Buffer.from(JSON.stringify(task, null, 2) + "\n"),
  );
  // Resume a task this script already submitted instead of duplicating it.
  const existing = await (await call("/task", { headers: bearer })).json();
  let id = existing.find(
    (t) => t.task_name === task.task_name && t.status !== "error",
  )?.task_id;
  if (id) console.log(JSON.stringify({ step: "appeears-resumed" }));
  else {
    const submitted = await call("/task", {
      method: "POST",
      headers: { ...bearer, "content-type": "application/json" },
      body: JSON.stringify(task),
    });
    const submitBody = await submitted.text();
    if (!submitted.ok)
      throw new Error(
        `APPEEARS_SUBMIT_${submitted.status}: ${submitBody.slice(0, 300)}`,
      );
    id = JSON.parse(submitBody).task_id;
    console.log(
      JSON.stringify({ step: "appeears-submitted", status: submitted.status }),
    );
  }
  const started = Date.now();
  let status;
  for (;;) {
    const s = await call(`/task/${id}`, { headers: bearer });
    status = await s.json();
    if (status.status === "done" || status.status === "error") break;
    if (Date.now() - started > 12 * 3600000)
      throw new Error("APPEEARS_TASK_TIMEOUT");
    console.log(
      JSON.stringify({
        step: "appeears-waiting",
        status: status.status,
        minutes: Math.round((Date.now() - started) / 60000),
      }),
    );
    await delay(30000);
  }
  const publicStatus = { ...status };
  delete publicStatus.task_id;
  delete publicStatus.user_id;
  await save(
    "appeears-task-status",
    "appeears-task-status.json",
    Buffer.from(JSON.stringify(publicStatus, null, 2) + "\n"),
    { elapsedMinutes: Math.round((Date.now() - started) / 60000) },
  );
  if (status.status !== "done") throw new Error("APPEEARS_TASK_ERROR");
  const bundle = await (
    await call(`/bundle/${id}`, { headers: bearer })
  ).json();
  const files = bundle.files.map((f) => {
    const copy = { ...f };
    delete copy.file_id;
    return copy;
  });
  await save(
    "appeears-bundle",
    "appeears-bundle.json",
    Buffer.from(JSON.stringify({ files }, null, 2) + "\n"),
  );
  for (const f of bundle.files) {
    if (!/\.(csv|txt|json|xml)$/.test(f.file_name)) continue;
    const name = "appeears-" + f.file_name.replace(/[^A-Za-z0-9._-]/g, "_");
    // Files kept from an interrupted run are reused when their hash matches.
    const kept = await readFile(join(directory, name)).catch(() => null);
    if (kept && sha(kept) === f.sha256) {
      manifest.push({
        name: f.file_name,
        file: name,
        bytes: kept.byteLength,
        sha256: sha(kept),
        bundleSha256: f.sha256,
        matchesBundle: true,
        reusedFromInterruptedRun: true,
      });
      continue;
    }
    let r;
    for (let attempt = 0; ; attempt++) {
      try {
        r = await fetch(`${API}/bundle/${id}/${f.file_id}`, {
          headers: bearer,
          redirect: "follow",
          signal: AbortSignal.timeout(300000),
        });
        break;
      } catch (error) {
        if (attempt >= 3) throw error;
        await delay(10000);
      }
    }
    let bytes = Buffer.from(await r.arrayBuffer());
    if (!r.ok) throw new Error(`APPEEARS_DOWNLOAD_${r.status}`);
    // The bundled request file names the account; it is removed.
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(bytes.toString("utf8"));
      delete parsed.user_id;
      bytes = Buffer.from(JSON.stringify(parsed, null, 2) + "\n");
    }
    await save(f.file_name, name, bytes, {
      bundleSha256: f.sha256,
      matchesBundle: f.sha256 ? sha(bytes) === f.sha256 : null,
      contentType: r.headers.get("content-type"),
    });
  }
  const removed = await call(`/task/${id}`, {
    method: "DELETE",
    headers: bearer,
  });
  console.log(
    JSON.stringify({ step: "appeears-deleted", status: removed.status }),
  );
} finally {
  await call("/logout", {
    method: "POST",
    headers: { ...bearer, "content-length": "0" },
  }).catch(() => {});
}

// GES DISC Giovanni time series for GPM IMERG Final daily at one point.
const tokenResponse = await fetch(
  "https://urs.earthdata.nasa.gov/api/users/find_or_create_token",
  {
    method: "POST",
    headers: { authorization: basic },
    signal: AbortSignal.timeout(60000),
  },
);
if (!tokenResponse.ok) throw new Error(`EDL_TOKEN_${tokenResponse.status}`);
const edl = (await tokenResponse.json()).access_token;
console.log(JSON.stringify({ step: "edl-token", ok: !!edl }));
const url = new URL("https://api.giovanni.earthdata.nasa.gov/timeseries");
url.searchParams.set("data", "GPM_3IMERGDF_07_precipitation");
url.searchParams.set("location", "[32.40,-6.55]");
url.searchParams.set("time", "2023-01-01T00:00:00/2023-03-31T23:59:59");
const g = await fetch(url, {
  headers: { authorization: `Bearer ${edl}` },
  signal: AbortSignal.timeout(300000),
});
const gBytes = Buffer.from(await g.arrayBuffer());
await save("giovanni-gpm-imerg", "giovanni-gpm-imerg-daily.csv", gBytes, {
  url: url.href,
  status: g.status,
  contentType: g.headers.get("content-type"),
});
console.log(
  JSON.stringify({
    step: "giovanni",
    status: g.status,
    bytes: gBytes.byteLength,
  }),
);
await writeFile(
  join(directory, "manifest.json"),
  JSON.stringify(
    {
      purpose:
        "Step 11 Part B access evidence: AppEEARS point task (HLS v2.0, SMAP L4) and Giovanni GPM IMERG time series",
      points: "Public Tadla irrigated plain, not a farmer's field",
      responses: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ step: "done", files: manifest.length }));
