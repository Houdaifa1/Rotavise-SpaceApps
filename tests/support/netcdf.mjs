// Writes classic netCDF-3 tiles shaped like the NCCS subset responses. These
// are synthetic test fixtures for the tile pipeline: invented temperatures in
// a disposable database, never stored or presented as NASA evidence.
import {
  calendarOrdinal,
  calendarYearLength,
} from "../../packages/contracts/dist/index.js";

const pad = (n) => Math.ceil(n / 4) * 4;
class Writer {
  parts = [];
  u32(v) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(v);
    this.parts.push(b);
  }
  text(s) {
    const raw = Buffer.from(s, "utf8");
    this.u32(raw.length);
    this.parts.push(raw, Buffer.alloc(pad(raw.length) - raw.length));
  }
  attributes(map) {
    const entries = Object.entries(map);
    if (!entries.length) return (this.u32(0), this.u32(0));
    this.u32(12);
    this.u32(entries.length);
    for (const [key, value] of entries) {
      this.text(key);
      if (typeof value === "string") {
        this.u32(2);
        this.text(value);
      } else {
        this.u32(5);
        this.u32(1);
        const b = Buffer.alloc(4);
        b.writeFloatBE(value);
        this.parts.push(b);
      }
    }
  }
  get length() {
    return this.parts.reduce((n, p) => n + p.length, 0);
  }
}
// kelvin(day, row, column) gives the value or null for the fill value.
export function syntheticTile(identity, kelvin, overrides = {}) {
  const { model, experiment, variable, year, tile } = identity;
  const days = calendarYearLength(model.calendar, year);
  const first = calendarOrdinal(model.calendar, year, 1, 1);
  const lat = [0, 1, 2, 3].map((i) => tile.latitude + 0.125 + i * 0.25);
  const lon = [0, 1, 2, 3].map((j) => {
    const v = tile.longitude + 0.125 + j * 0.25;
    return v < 0 ? v + 360 : v;
  });
  const global = {
    activity: "NEX-GDDP-CMIP6",
    frequency: "day",
    variant_label: model.variant,
    scenario: experiment,
    version: "2.0",
    cmip6_source_id: model.id,
    cmip6_license: variable === "pr" ? "CC-BY 4.0" : "CC-BY-SA 4.0",
    comment: "Synthetic Rotavise test fixture; not NASA data",
    ...overrides.global,
  };
  const variables = [
    ["lon", [0], { units: "degrees_east" }, 6, lon],
    [
      "time",
      [1],
      {
        units: overrides.timeUnits ?? "days since 1850-01-01",
        calendar: model.calendar,
      },
      6,
      Array.from({ length: days }, (_, k) => first + k + 0.5),
    ],
    ["lat", [2], { units: "degrees_north" }, 6, lat],
    [
      variable,
      [1, 2, 0],
      {
        units: variable === "pr" ? "kg m-2 s-1" : "K",
        _FillValue: 1e20,
        missing_value: 1e20,
      },
      5,
      Array.from({ length: days * 16 }, (_, n) => {
        const v = kelvin(Math.floor(n / 16), Math.floor((n % 16) / 4), n % 4);
        return v === null ? 1e20 : v;
      }),
    ],
  ];
  const header = (begins) => {
    const w = new Writer();
    w.parts.push(Buffer.from("CDF\x01", "latin1"));
    w.u32(0);
    w.u32(10);
    w.u32(3);
    for (const [name, size] of [
      ["lon", 4],
      ["time", days],
      ["lat", 4],
    ]) {
      w.text(name);
      w.u32(size);
    }
    w.attributes(global);
    w.u32(11);
    w.u32(variables.length);
    variables.forEach(([name, dims, attrs, type, data], i) => {
      w.text(name);
      w.u32(dims.length);
      for (const d of dims) w.u32(d);
      w.attributes(attrs);
      w.u32(type);
      w.u32(pad(data.length * (type === 6 ? 8 : 4)));
      w.u32(begins[i]);
    });
    return w;
  };
  const size = header([0, 0, 0, 0]).length;
  const begins = [];
  let at = size;
  for (const [, , , type, data] of variables) {
    begins.push(at);
    at += pad(data.length * (type === 6 ? 8 : 4));
  }
  const w = header(begins);
  for (const [, , , type, data] of variables) {
    const b = Buffer.alloc(pad(data.length * (type === 6 ? 8 : 4)));
    data.forEach((v, i) =>
      type === 6 ? b.writeDoubleBE(v, i * 8) : b.writeFloatBE(v, i * 4),
    );
    w.parts.push(b);
  }
  return new Uint8Array(Buffer.concat(w.parts));
}
// Invented seasonal temperatures in kelvin, warmer under the scenarios.
export function syntheticKelvin(identity) {
  const days = calendarYearLength(identity.model.calendar, identity.year);
  const warming = { historical: 0, ssp245: 1.5, ssp585: 3 }[
    identity.experiment
  ];
  return (k, i, j) => {
    const season = Math.sin((2 * Math.PI * ((k / days) * 365 - 110)) / 365);
    const max = 24 + 13 * season + warming + 0.1 * i - 0.1 * j;
    const value =
      identity.variable === "tasmax"
        ? max
        : identity.variable === "tasmin"
          ? max - 12
          : max - 6;
    // Rain in kg m-2 s-1: 4 mm on every sixth day.
    if (identity.variable === "pr") return k % 6 === 0 ? 4 / 86400 : 0;
    return value + 273.15;
  };
}
