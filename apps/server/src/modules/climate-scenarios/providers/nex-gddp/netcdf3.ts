// Strict reader for the netCDF classic formats (CDF-1 and CDF-2) that the
// THREDDS subset service returns. It supports only what those responses use:
// fixed-size variables (no record dimension) of the six classic types, with
// bounds checks on every offset. Anything else is rejected, never guessed.
// Format: https://docs.unidata.ucar.edu/netcdf-c/current/file_format_specifications.html
export class NetcdfError extends Error {
  constructor(readonly reason: string) {
    super(`NETCDF_INVALID:${reason}`);
  }
}
type Value = string | number[];
export type NetcdfVariable = {
  name: string;
  dimensions: string[];
  shape: number[];
  attributes: Map<string, Value>;
  type: number;
  begin: number;
  size: number;
};
export type NetcdfFile = {
  dimensions: Map<string, number>;
  attributes: Map<string, Value>;
  variables: Map<string, NetcdfVariable>;
  bytes: Uint8Array;
};
const SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 4, 6: 8 };
const LIMITS = { names: 256, items: 128, attributeBytes: 65536 };
const pad = (n: number) => Math.ceil(n / 4) * 4;
export function readNetcdf(input: Uint8Array): NetcdfFile {
  const bytes = input;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  const need = (n: number) => {
    if (n < 0 || at + n > bytes.byteLength) throw new NetcdfError("TRUNCATED");
  };
  const u32 = () => {
    need(4);
    const v = view.getUint32(at);
    at += 4;
    return v;
  };
  const text = (n: number) => {
    need(pad(n));
    const value = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(at, at + n),
    );
    at += pad(n);
    return value;
  };
  const name = () => {
    const n = u32();
    if (n < 1 || n > LIMITS.names) throw new NetcdfError("NAME");
    return text(n);
  };
  const list = (tag: number) => {
    const found = u32();
    const count = u32();
    if (found === 0 && count === 0) return 0;
    if (found !== tag || count > LIMITS.items) throw new NetcdfError("LIST");
    return count;
  };
  const values = (type: number, count: number): Value => {
    const size = SIZES[type];
    if (!size || count > LIMITS.attributeBytes / size)
      throw new NetcdfError("ATTRIBUTE");
    if (type === 2) return text(count);
    need(pad(count * size));
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const o = at + i * size;
      out.push(
        type === 1
          ? view.getInt8(o)
          : type === 3
            ? view.getInt16(o)
            : type === 4
              ? view.getInt32(o)
              : type === 5
                ? view.getFloat32(o)
                : view.getFloat64(o),
      );
    }
    at += pad(count * size);
    return out;
  };
  const attributes = () => {
    const map = new Map<string, Value>();
    for (let n = list(12); n > 0; n--) {
      const key = name();
      const type = u32();
      map.set(key, values(type, u32()));
    }
    return map;
  };
  need(4);
  if (bytes[0] !== 0x43 || bytes[1] !== 0x44 || bytes[2] !== 0x46)
    throw new NetcdfError("MAGIC");
  const version = bytes[3];
  if (version !== 1 && version !== 2) throw new NetcdfError("VERSION");
  at = 4;
  if (u32() !== 0) throw new NetcdfError("RECORDS_UNSUPPORTED");
  const dimensions = new Map<string, number>();
  const order: string[] = [];
  for (let n = list(10); n > 0; n--) {
    const key = name();
    const length = u32();
    if (length === 0) throw new NetcdfError("RECORDS_UNSUPPORTED");
    if (dimensions.has(key)) throw new NetcdfError("DUPLICATE");
    dimensions.set(key, length);
    order.push(key);
  }
  const global = attributes();
  const variables = new Map<string, NetcdfVariable>();
  for (let n = list(11); n > 0; n--) {
    const key = name();
    const rank = u32();
    if (rank > 8) throw new NetcdfError("RANK");
    const dims: string[] = [];
    for (let i = 0; i < rank; i++) {
      const id = u32();
      const dim = order[id];
      if (dim === undefined) throw new NetcdfError("DIMENSION");
      dims.push(dim);
    }
    const attrs = attributes();
    const type = u32();
    const size = SIZES[type];
    if (!size) throw new NetcdfError("TYPE");
    u32(); // vsize: recomputed from the shape below
    let begin: number;
    if (version === 1) begin = u32();
    else {
      need(8);
      const big = view.getBigUint64(at);
      at += 8;
      if (big > BigInt(Number.MAX_SAFE_INTEGER))
        throw new NetcdfError("OFFSET");
      begin = Number(big);
    }
    const shape = dims.map((d) => dimensions.get(d)!);
    const total = shape.reduce((a, b) => a * b, 1) * size;
    if (begin < at || begin + total > bytes.byteLength)
      throw new NetcdfError("BOUNDS");
    if (variables.has(key)) throw new NetcdfError("DUPLICATE");
    variables.set(key, {
      name: key,
      dimensions: dims,
      shape,
      attributes: attrs,
      type,
      begin,
      size: total,
    });
  }
  return { dimensions, attributes: global, variables, bytes };
}
// Numeric data of a float or double variable, in file order.
export function readNumbers(file: NetcdfFile, key: string) {
  const variable = file.variables.get(key);
  if (!variable || (variable.type !== 5 && variable.type !== 6))
    throw new NetcdfError("VARIABLE");
  const view = new DataView(
    file.bytes.buffer,
    file.bytes.byteOffset + variable.begin,
    variable.size,
  );
  const step = variable.type === 5 ? 4 : 8;
  const out = new Float64Array(variable.size / step);
  for (let i = 0; i < out.length; i++)
    out[i] =
      variable.type === 5
        ? view.getFloat32(i * step)
        : view.getFloat64(i * step);
  return out;
}
export function textAttribute(attributes: Map<string, Value>, key: string) {
  const value = attributes.get(key);
  return typeof value === "string" ? value.replace(/\0+$/, "") : null;
}
export function numberAttribute(attributes: Map<string, Value>, key: string) {
  const value = attributes.get(key);
  return Array.isArray(value) && value.length === 1 ? value[0]! : null;
}
