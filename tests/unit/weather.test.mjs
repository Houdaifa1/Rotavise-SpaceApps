import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  calendarDateSchema,
  datesBetween,
  weatherVariables,
  climateWeatherVariables,
  weatherResponseSchema,
  weatherSnapshotSchema,
  weatherVariableAvailability,
  weatherRequestSchema,
} from "../../packages/contracts/dist/index.js";
import { canonicalWeatherRequest } from "../../apps/server/dist/modules/weather/application/weather-request.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import {
  nasaUrl,
  NasaPowerProvider,
} from "../../apps/server/dist/modules/weather/providers/nasa-power/nasa-power.provider.js";
import { weatherCapabilities } from "../../apps/server/dist/modules/weather/application/weather-capabilities.js";
import { weatherRequestKey } from "../../apps/server/dist/modules/weather/application/weather-request.js";

export const request = {
  latitude: 32.3373,
  longitude: -6.3498,
  startDate: "2024-02-27",
  endDate: "2024-03-02",
  variables: [...climateWeatherVariables],
};
const directory = "docs/evidence/weather/2026-09-26/";
const raw = readFileSync(
  directory + "nasa-power-beni-mellal-leap.json",
  "utf8",
).trimEnd();
const fixture = () => JSON.parse(raw);
// Evidence recorded before adapter 3 was requested at exact coordinates; it
// is verified as adapter 2 evidence, exactly as stored plans re-verify it.
const exact = (input) => {
  const parsed = weatherRequestSchema.parse(input);
  return { ...parsed, variables: [...parsed.variables].sort() };
};
const normalized = (data) =>
  normalizeNasa(JSON.stringify(data), exact(request), undefined, "2");

describe("weather contracts and real recorded NASA evidence", () => {
  test("retained response hashes match the live manifest", () => {
    for (const entry of JSON.parse(
      readFileSync(directory + "manifest.json", "utf8"),
    )) {
      expect(entry.status).toBe(200);
      expect(
        createHash("sha256")
          .update(readFileSync(directory + entry.file, "utf8"))
          .digest("hex"),
      ).toBe(entry.sha256);
    }
  });
  test.each([
    "2024-02-30",
    "2023-02-29",
    "2024-13-01",
    "2024-1-01",
    "nonsense",
  ])("rejects invalid calendar date %s", (value) => {
    expect(calendarDateSchema.safeParse(value).success).toBe(false);
  });
  test("preserves leap day, UTC year transitions and capabilities policy", () => {
    expect(datesBetween("2024-02-27", "2024-03-02")).toContain("2024-02-29");
    expect(datesBetween("2023-12-31", "2024-01-01")).toEqual([
      "2023-12-31",
      "2024-01-01",
    ]);
    const cap = weatherCapabilities(new Date("2026-09-26T22:00:00Z"));
    expect(cap.latestAllowedDate).toBe("2026-05-29");
    expect(cap.variables).toHaveLength(7);
    expect(cap.timeStandard).toBe("UTC");
  });
  test.each([
    { latitude: "32.3" },
    { longitude: 181 },
    { latitude: Number.NaN },
    { variables: ["temperatureMean", "temperatureMean"] },
    { variables: ["humidity"] },
    { variables: [] },
    { endDate: "2024-02-26" },
    { startDate: "1980-12-31" },
    { endDate: "2026-09-26" },
    { startDate: "2023-01-01", endDate: "2024-03-02" },
    { provider: "arbitrary" },
  ])("rejects malformed or unsupported request %j", (change) => {
    expect(() => canonicalWeatherRequest({ ...request, ...change })).toThrow(
      "INVALID_WEATHER_REQUEST",
    );
  });
  test("key ignores variable order and input object order but includes location, range and selection", () => {
    expect(weatherRequestKey(request)).toBe(
      weatherRequestKey({
        variables: [...request.variables].reverse(),
        endDate: request.endDate,
        startDate: request.startDate,
        longitude: request.longitude,
        latitude: request.latitude,
      }),
    );
    // Points in the same POWER cell share one key; another cell does not.
    expect(weatherRequestKey({ ...request, latitude: 32.3374 })).toBe(
      weatherRequestKey(request),
    );
    for (const change of [
      { latitude: 32.2 },
      { startDate: "2024-02-28" },
      { variables: ["precipitation"] },
    ])
      expect(weatherRequestKey({ ...request, ...change })).not.toBe(
        weatherRequestKey(request),
      );
    const url = nasaUrl(canonicalWeatherRequest(request));
    expect(url.origin).toBe("https://power.larc.nasa.gov");
    expect(url.searchParams.get("time-standard")).toBe("UTC");
  });
  test("normalizes actual source data without disguising grid estimates as field measurements", () => {
    const snapshot = normalized(fixture());
    expect(snapshot.complete).toBe(true);
    expect(snapshot.days).toHaveLength(5);
    expect(snapshot.days[2].values).toEqual({
      temperatureMin: 2.63,
      temperatureMax: 18.79,
      temperatureMean: 9.77,
      precipitation: 0.01,
    });
    expect(snapshot.provenance.apiVersion).toBe("v2.10.0");
    expect(snapshot.provenance.sources).toContain("MERRA2");
    expect(
      snapshot.provenance.variables.find((v) => v.variable === "precipitation"),
    ).toMatchObject({ sourceUnit: "mm/day", unit: "mm" });
    expect(snapshot.provenance.spatialMeaning).toBe(
      "grid-estimate-not-field-measurement",
    );
    expect(
      weatherResponseSchema.safeParse({
        snapshotId: "e54aad5a-9ab7-4ca1-9ed7-2f8ef06ea7db",
        cache: "miss",
        expiresAt: "2026-10-01T00:00:00Z",
        snapshot,
      }).success,
    ).toBe(true);
  });
  test("synthetic missing-value injection yields explicit nulls and missing dates, never zero", () => {
    const data = fixture();
    data.properties.parameter.PRECTOTCORR["20240229"] = -999;
    delete data.properties.parameter.T2M["20240228"];
    const snapshot = normalized(data);
    expect(snapshot.complete).toBe(false);
    expect(snapshot.days[2].values.precipitation).toBeNull();
    expect(snapshot.days[1].values.temperatureMean).toBeNull();
    expect(
      snapshot.coverage.find((v) => v.variable === "precipitation")
        .missingDates,
    ).toEqual(["2024-02-29"]);
  });
  test.each([
    (v) => {
      v.header.time_standard = "LST";
    },
    (v) => {
      v.header.sources = ["GEOS"];
    },
    (v) => {
      v.header.fill_value = -1;
    },
    (v) => {
      v.parameters.T2M.units = "F";
    },
    (v) => {
      v.header.start = "20240228";
    },
    (v) => {
      v.geometry.coordinates[0] = 15;
    },
    (v) => {
      v.messages = ["synthetic warning"];
    },
    (v) => {
      v.properties.parameter.T2M["20240303"] = 8;
    },
    (v) => {
      v.properties.parameter.PRECTOTCORR["20240229"] = -0.1;
    },
    (v) => {
      v.properties.parameter.T2M_MIN["20240229"] = 50;
    },
    (v) => {
      v.properties.parameter.T2M["20240229"] = "9.77";
    },
  ])(
    "rejects controlled structural/semantic provider corruption %#",
    (mutate) => {
      const data = fixture();
      mutate(data);
      expect(() => normalized(data)).toThrow("WEATHER_UPSTREAM_INVALID");
    },
  );
});
test("all three actual NASA snapshots have complete daily coverage and verified metadata", () => {
  for (const entry of JSON.parse(
    readFileSync(directory + "manifest.json", "utf8"),
  ).filter((entry) => entry.provider === "nasa-power")) {
    const sample = entry.sample;
    const input = exact({
      latitude: sample.latitude,
      longitude: sample.longitude,
      startDate: sample.start,
      endDate: sample.end,
      variables: [...climateWeatherVariables],
    });
    const snapshot = normalizeNasa(
      readFileSync(directory + entry.file, "utf8"),
      input,
      entry.retrievedAt,
      "2",
    );
    expect(snapshot.complete).toBe(true);
    expect(snapshot.days.length).toBe(
      datesBetween(input.startDate, input.endDate).length,
    );
  }
});

// All loopback responses below are controlled synthetic HTTP fault fixtures.
async function upstream(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const provider = new NasaPowerProvider((_url, init) => fetch(origin, init));
  try {
    await run(provider);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
// Recorded 2026-10-17 at a POWER cell centre, as adapter 3 requests it.
const cellDirectory = "docs/evidence/climate-scenarios/2026-10-17/";
const cellRaw = readFileSync(
  cellDirectory + "power-32.5_-6.28125.json",
  "utf8",
);
const cellRequest = {
  latitude: 32.3373,
  longitude: -6.3498,
  startDate: "2020-01-01",
  endDate: "2020-01-07",
  variables: [...climateWeatherVariables, "solarRadiation"],
};
const json = (reply) => {
  reply.writeHead(200, { "content-type": "application/json" });
  reply.end(cellRaw);
};
test("retries controlled 429 and 503 within a finite budget then succeeds", async () => {
  let calls = 0;
  await upstream(
    (_req, reply) => {
      calls++;
      if (calls < 3) {
        reply.writeHead(calls === 1 ? 429 : 503, { "retry-after": "0" });
        reply.end("synthetic failure");
      } else json(reply);
    },
    async (provider) => {
      expect(
        (
          await provider.fetch(
            canonicalWeatherRequest(cellRequest),
            new AbortController().signal,
          )
        ).snapshot.complete,
      ).toBe(true);
    },
  );
  expect(calls).toBe(3);
});
test.each([400, 401, 404])(
  "never retries permanent HTTP %s",
  async (status) => {
    let calls = 0;
    await upstream(
      (_req, reply) => {
        calls++;
        reply.writeHead(status);
        reply.end("synthetic failure");
      },
      async (provider) => {
        await expect(
          provider.fetch(request, new AbortController().signal),
        ).rejects.toThrow("WEATHER_UPSTREAM_UNAVAILABLE");
      },
    );
    expect(calls).toBe(1);
  },
);
test("respects long Retry-After by failing instead of hammering upstream", async () => {
  let calls = 0;
  await upstream(
    (_req, reply) => {
      calls++;
      reply.writeHead(429, { "retry-after": "60" });
      reply.end();
    },
    async (provider) => {
      await expect(
        provider.fetch(request, new AbortController().signal),
      ).rejects.toThrow("WEATHER_UPSTREAM_UNAVAILABLE");
    },
  );
  expect(calls).toBe(1);
});
test.each([
  "invalid-json",
  "oversize-header",
  "oversize-stream",
  "html",
  "redirect",
])("bounds/rejects synthetic %s response", async (fault) => {
  await upstream(
    (_req, reply) => {
      if (fault === "redirect") {
        reply.writeHead(302, { location: "http://127.0.0.1:1/private" });
        reply.end();
      } else if (fault === "html") {
        reply.writeHead(200, { "content-type": "text/html" });
        reply.end("<html>synthetic</html>");
      } else if (fault === "oversize-header") {
        reply.writeHead(200, {
          "content-type": "application/json",
          "content-length": "1048577",
        });
        reply.end();
      } else {
        reply.writeHead(200, { "content-type": "application/json" });
        reply.end(
          fault === "invalid-json"
            ? "synthetic not JSON"
            : "x".repeat(1_048_577),
        );
      }
    },
    async (provider) => {
      await expect(
        provider.fetch(request, new AbortController().signal),
      ).rejects.toThrow(
        fault === "redirect"
          ? "WEATHER_UPSTREAM_UNAVAILABLE"
          : "WEATHER_UPSTREAM_INVALID",
      );
    },
  );
});
test("cancellation aborts a real hanging HTTP connection", async () => {
  await upstream(
    () => {},
    async (provider) => {
      const controller = new AbortController();
      const pending = provider.fetch(request, controller.signal);
      setTimeout(() => controller.abort(), 100);
      await expect(pending).rejects.toThrow("WEATHER_CANCELLED");
    },
  );
});
test("real HTTP stall reaches the deadline and bounded retries", async () => {
  let calls = 0;
  const started = Date.now();
  await upstream(
    () => {
      calls++;
    },
    async (provider) => {
      await expect(
        provider.fetch(request, new AbortController().signal),
      ).rejects.toThrow("WEATHER_TIMEOUT");
    },
  );
  expect(calls).toBeLessThanOrEqual(3);
  expect(Date.now() - started).toBeLessThan(18000);
});
test("exhausted synthetic 503 errors make exactly three attempts", async () => {
  let calls = 0;
  await upstream(
    (_req, reply) => {
      calls++;
      reply.writeHead(503);
      reply.end("synthetic persistent outage");
    },
    async (provider) => {
      await expect(
        provider.fetch(request, new AbortController().signal),
      ).rejects.toThrow("WEATHER_UPSTREAM_UNAVAILABLE");
    },
  );
  expect(calls).toBe(3);
});
test("shared response contract rejects fabricated completeness and coverage", () => {
  for (const mutate of [
    (s) => {
      s.complete = false;
    },
    (s) => {
      s.days.pop();
    },
    (s) => {
      s.days[0].values.precipitation = null;
    },
    (s) => {
      s.coverage[0].missingDates = ["2024-02-27"];
    },
    (s) => {
      s.provenance.variables[0].unit = "degC";
    },
  ]) {
    const snapshot = normalized(fixture());
    mutate(snapshot);
    expect(
      weatherResponseSchema.safeParse({
        snapshotId: "e54aad5a-9ab7-4ca1-9ed7-2f8ef06ea7db",
        cache: "miss",
        expiresAt: "2026-10-01T00:00:00Z",
        snapshot,
      }).success,
    ).toBe(false);
  }
});

const expandedDirectory = "docs/evidence/weather/2026-09-27/";
const expandedRaw = readFileSync(
  expandedDirectory + "nasa-power-expanded.json",
  "utf8",
);
const expandedRequest = { ...request, variables: [...weatherVariables] };
function selectedRecorded(variable) {
  // Deterministic subset derived from recorded data, not a new live response.
  const data = JSON.parse(expandedRaw);
  const parameter = {
    relativeHumidity: "RH2M",
    windSpeed: "WS2M",
    solarRadiation: "ALLSKY_SFC_SW_DWN",
  }[variable];
  data.properties.parameter = {
    [parameter]: data.properties.parameter[parameter],
  };
  data.parameters = { [parameter]: data.parameters[parameter] };
  data.header.sources = [weatherVariableAvailability[variable].source];
  return data;
}
test("four new live probes retain exact response bytes and hashes", () => {
  const manifest = JSON.parse(
    readFileSync(expandedDirectory + "manifest.json", "utf8"),
  );
  expect(manifest).toHaveLength(4);
  for (const e of manifest) {
    const bytes = readFileSync(expandedDirectory + e.file);
    expect(e.status).toBe(200);
    expect(bytes.length).toBe(e.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(e.sha256);
  }
});
test("all seven actual variables retain units, values, source datasets and coverage", () => {
  const s = normalizeNasa(expandedRaw, exact(expandedRequest), undefined, "2");
  expect(s.complete).toBe(true);
  expect(s.coverage).toHaveLength(7);
  expect(s.provenance.adapterVersion).toBe("2");
  expect(s.provenance.sources).toEqual(["SYN1DEG", "MERRA2", "POWER"]);
  expect(s.days[2].values).toEqual({
    temperatureMin: 2.63,
    temperatureMax: 18.79,
    temperatureMean: 9.77,
    precipitation: 0.01,
    relativeHumidity: 51.08,
    windSpeed: 1.32,
    solarRadiation: 21.14,
  });
  const cap = weatherCapabilities();
  expect(cap.variables.find((v) => v.id === "relativeHumidity")).toMatchObject({
    parameter: "RH2M",
    unit: "%",
    earliestDate: "1981-01-01",
  });
  expect(cap.variables.find((v) => v.id === "windSpeed")).toMatchObject({
    parameter: "WS2M",
    unit: "m/s",
  });
  expect(cap.variables.find((v) => v.id === "solarRadiation")).toMatchObject({
    unit: "MJ/m2/day",
    sourceUnit: "MJ/m^2/day",
    earliestDate: "2001-01-01",
    sourceResolution: { latitudeDegrees: 1, longitudeDegrees: 1 },
  });
});
test.each(["relativeHumidity", "windSpeed", "solarRadiation"])(
  "supports independently selected %s without requiring other parameters",
  (v) => {
    const s = normalizeNasa(
      JSON.stringify(selectedRecorded(v)),
      exact({ ...request, variables: [v] }),
      undefined,
      "2",
    );
    expect(s.request.variables).toEqual([v]);
    expect(Object.keys(s.days[0].values)).toEqual([v]);
    expect(s.complete).toBe(true);
  },
);
test.each(["solar-start", "solar-only", "meteorology-start"])(
  "normalizes the real %s probe with its actual source and date availability",
  (name) => {
    const e = JSON.parse(
      readFileSync(expandedDirectory + "manifest.json", "utf8"),
    ).find((e) => e.name === name);
    const url = new URL(e.url);
    const date = (key) => {
      const d = url.searchParams.get(key);
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    };
    const input = exact({
      ...request,
      startDate: date("start"),
      endDate: date("end"),
      variables:
        name === "meteorology-start"
          ? ["relativeHumidity", "windSpeed"]
          : ["solarRadiation"],
    });
    const s = normalizeNasa(
      readFileSync(expandedDirectory + e.file, "utf8"),
      input,
      e.retrievedAt,
      "2",
    );
    expect(s.complete).toBe(true);
  },
);
test("rejects a mixed request before solar availability without restricting meteorology to solar history", () => {
  expect(() =>
    canonicalWeatherRequest({
      ...expandedRequest,
      startDate: "2000-12-31",
      endDate: "2001-01-01",
    }),
  ).toThrow("INVALID_WEATHER_REQUEST");
  expect(() =>
    canonicalWeatherRequest({
      ...request,
      startDate: "1981-01-01",
      endDate: "1981-01-02",
      variables: ["relativeHumidity", "windSpeed"],
    }),
  ).not.toThrow();
});
test.each(["relativeHumidity", "windSpeed", "solarRadiation"])(
  "missing %s preserves null and exact per-variable coverage",
  (v) => {
    const data = selectedRecorded(v);
    const values = Object.values(data.properties.parameter)[0];
    values["20240229"] = -999;
    delete values["20240228"];
    const s = normalizeNasa(
      JSON.stringify(data),
      exact({ ...request, variables: [v] }),
      undefined,
      "2",
    );
    expect(s.complete).toBe(false);
    expect(s.days[1].values[v]).toBeNull();
    expect(s.days[2].values[v]).toBeNull();
    expect(s.coverage[0].missingDates).toEqual(["2024-02-28", "2024-02-29"]);
  },
);
test.each([
  ["RH2M", -0.01],
  ["RH2M", 100.01],
  ["WS2M", -0.01],
  ["ALLSKY_SFC_SW_DWN", -0.01],
])("rejects controlled impossible %s=%s", (parameter, value) => {
  const data = JSON.parse(expandedRaw);
  data.properties.parameter[parameter]["20240229"] = value;
  expect(() =>
    normalizeNasa(JSON.stringify(data), expandedRequest, undefined, "2"),
  ).toThrow("WEATHER_UPSTREAM_INVALID");
});
test.each(["RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"])(
  "rejects changed source units for %s",
  (parameter) => {
    const data = JSON.parse(expandedRaw);
    data.parameters[parameter].units = "synthetic-wrong-unit";
    expect(() =>
      normalizeNasa(JSON.stringify(data), expandedRequest, undefined, "2"),
    ).toThrow("WEATHER_UPSTREAM_INVALID");
  },
);
test.each([
  ["MERRA2"],
  ["SYN1DEG"],
  ["MERRA2", "SYN1DEG", "FLASHFLUX"],
  ["MERRA2", "SYN1DEG", "SYN1DEG"],
])(
  "rejects incomplete, unreviewed or duplicate mixed source metadata %j",
  (...sources) => {
    const data = JSON.parse(expandedRaw);
    data.header.sources = sources;
    expect(() =>
      normalizeNasa(JSON.stringify(data), expandedRequest, undefined, "2"),
    ).toThrow("WEATHER_UPSTREAM_INVALID");
  },
);
test("strict v2 snapshot contracts reject altered definitions, units, physical values and incomplete source claims", () => {
  for (const mutate of [
    (s) => {
      s.provenance.variables.find(
        (v) => v.variable === "solarRadiation",
      ).parameter = "UNREVIEWED";
    },
    (s) => {
      s.provenance.variables.find((v) => v.variable === "windSpeed").unit =
        "degC";
    },
    (s) => {
      s.days[0].values.relativeHumidity = 101;
    },
    (s) => {
      s.provenance.sources = ["MERRA2"];
    },
    (s) => {
      s.provenance.adapterVersion = "1";
    },
  ]) {
    const s = normalizeNasa(expandedRaw, expandedRequest, undefined, "2");
    mutate(s);
    expect(weatherSnapshotSchema.safeParse(s).success).toBe(false);
  }
});
test("v1 four-variable evidence remains readable while new requests have a separate cache identity", () => {
  const s = normalized(fixture());
  s.provenance.adapterVersion = "1";
  s.provenance.attribution =
    "NASA Langley Research Center POWER Project; MERRA-2; https://power.larc.nasa.gov/";
  expect(weatherSnapshotSchema.safeParse(s).success).toBe(true);
  const v1Key = createHash("sha256")
    .update(
      JSON.stringify({
        provider: "nasa-power",
        adapterVersion: "1",
        timeStandard: "UTC",
        request: canonicalWeatherRequest(request),
      }),
    )
    .digest("hex");
  expect(weatherRequestKey(request)).not.toBe(v1Key);
});

describe("adapter 3 sends POWER source-cell centres", () => {
  const manifest = JSON.parse(
    readFileSync(cellDirectory + "manifest.json", "utf8"),
  );
  const power = manifest.responses.filter((r) => r.name.startsWith("power-"));
  test("recorded responses keep their bytes and hashes", () => {
    expect(power).toHaveLength(9);
    for (const r of manifest.responses) {
      const bytes = readFileSync(cellDirectory + r.file);
      expect(r.status).toBe(200);
      expect(bytes.length).toBe(r.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(r.sha256);
    }
  });
  test("points snapped to the same centre returned identical values; other centres differed", () => {
    const groups = new Map();
    for (const r of power) {
      const url = new URL(r.url);
      const centre = canonicalWeatherRequest({
        ...cellRequest,
        latitude: Number(url.searchParams.get("latitude")),
        longitude: Number(url.searchParams.get("longitude")),
      });
      const key = `${centre.latitude},${centre.longitude}`;
      const values = JSON.stringify(
        JSON.parse(readFileSync(cellDirectory + r.file, "utf8")).properties
          .parameter,
      );
      groups.set(key, [...(groups.get(key) ?? []), values]);
    }
    expect([...groups.keys()].sort()).toEqual([
      "31.875,-6.28125",
      "32.125,-6.28125",
      "32.5,-5.96875",
      "32.5,-6.28125",
      "32.5,-6.78125",
    ]);
    expect(groups.get("32.5,-6.28125")).toHaveLength(5);
    for (const values of groups.values()) expect(new Set(values).size).toBe(1);
    expect(new Set([...groups.values()].map((v) => v[0])).size).toBe(5);
  });
  test("a farm position becomes the cell centre in requests, keys, URLs and snapshots", () => {
    const input = canonicalWeatherRequest(cellRequest);
    expect(input).toMatchObject({ latitude: 32.5, longitude: -6.28125 });
    const url = nasaUrl(input);
    expect(url.searchParams.get("latitude")).toBe("32.5");
    expect(url.searchParams.get("longitude")).toBe("-6.28125");
    const snapshot = normalizeNasa(cellRaw, input);
    expect(snapshot.provenance.adapterVersion).toBe("3");
    expect(snapshot.request.latitude).toBe(32.5);
    expect(JSON.stringify(snapshot)).not.toContain("32.3373");
    expect(weatherSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const moved = structuredClone(snapshot);
    moved.request.latitude = 32.3373;
    expect(weatherSnapshotSchema.safeParse(moved).success).toBe(false);
    expect(weatherCapabilities().location).toBe(
      "source-cell-centre-not-farm-position",
    );
  });
});
