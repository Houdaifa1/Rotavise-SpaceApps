import { describe, expect, test } from "@jest/globals";
import {
  alphaCoverage,
  tileCoverage,
  centreTile,
  previousDays,
  tileUrl,
  validDate,
} from "../../apps/web/src/features/map/gibs.js";
import { requestPool } from "../../apps/web/src/shared/requestPool.js";

test("GIBS uses the two advertised matrix sets with row before column", () => {
  const tile = centreTile([-6.3498, 32.3373], 12);
  expect(tile).toEqual({ z: 12, x: 1975, y: 1658 });
  expect(tileUrl("hls", "2026-11-04", tile)).toMatch(
    /HLS_S30_Nadir_BRDF_Adjusted_Reflectance\/default\/2026-11-04\/GoogleMapsCompatible_Level12\/12\/1658\/1975\.png$/,
  );
  expect(tileUrl("modis", "default")).toMatch(
    /MODIS_Terra_CorrectedReflectance_TrueColor\/default\/default\/GoogleMapsCompatible_Level9\/\{z\}\/\{y\}\/\{x\}\.jpeg$/,
  );
});

test("imagery availability comes from alpha pixels and dates stay UTC calendar days", () => {
  expect(alphaCoverage(new Uint8ClampedArray([255, 20, 33, 0]))).toBe("empty");
  expect(alphaCoverage(new Uint8ClampedArray([0, 0, 0, 255]))).toBe("present");
  expect(alphaCoverage(new Uint8ClampedArray([1, 2, 3, 0, 1, 2, 3, 255]))).toBe(
    "partial",
  );
  expect(previousDays("2024-03-01", 3)).toEqual([
    "2024-03-01",
    "2024-02-29",
    "2024-02-28",
  ]);
  expect(validDate("2026-02-29")).toBe(false);
  expect(validDate("2024-02-29")).toBe(true);
});

describe.each([6, 8])("request cap of %i", (limit) => {
  test("queues excess work, cancels queued requests and releases the next slot", async () => {
    const run = requestPool(limit);
    const signal = new AbortController().signal;
    const cancelled = new AbortController();
    let release = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let peak = 0;
    const request = async () => {
      peak = Math.max(peak, ++active);
      await barrier;
      active--;
    };
    const running = Array.from({ length: limit }, () => run(signal, request));
    let called = false;
    const aborted = run(cancelled.signal, async () => {
      called = true;
    });
    const extra = run(signal, request);
    cancelled.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(called).toBe(false);
    expect(active).toBe(limit);
    release();
    await Promise.all([...running, extra]);
    expect(peak).toBe(limit);
    expect(active).toBe(0);
  });
});

test("MODIS rejects opaque all-black no-data while HLS preserves alpha semantics", () => {
  const black = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]);
  expect(tileCoverage(black, "modis")).toBe("empty");
  expect(tileCoverage(black, "hls")).toBe("present");
  const image = new Uint8ClampedArray([0, 0, 0, 255, 5, 12, 3, 255]);
  expect(tileCoverage(image, "modis")).toBe("present");
});
