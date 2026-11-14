#!/usr/bin/env python3
"""Cuts the Morocco region out of the JPL GRACE / GRACE-FO mascon file.

Input: the global netCDF4 file GRCTellus.JPL.*.GLO.RL06.3M.MSCNv04CRI.nc, which
needs an Earthdata login to download (see docs/steps/15/p4-notes.md). Output: a
small JSON file that `pnpm grace:import` loads into the database. The tool
changes nothing else, never touches the network and never reads the .env file.

It refuses any file that is not what it expects (variable names, units, grid)
instead of guessing. Run it inside a virtual environment that has netCDF4:

    python3 -m venv .artifacts/grace-venv
    .artifacts/grace-venv/bin/pip install netCDF4==1.7.2
    .artifacts/grace-venv/bin/python tooling/earth-observations/grace-extract.py \
        --input ~/Downloads/GRCTellus.JPL.200204_202608.GLO.RL06.3M.MSCNv04CRI.nc \
        --output .artifacts/grace-morocco.json
"""
import argparse
import datetime
import hashlib
import json
import math
import os
import re
import sys


def fail(message):
    sys.exit("grace-extract: " + message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--product", help="Preserve an existing imported product identity")
    # Morocco and a margin, in degrees (south, north, west, east).
    parser.add_argument("--bbox", nargs=4, type=float, default=[26.0, 37.0, -14.0, 0.0])
    args = parser.parse_args()
    south, north, west, east = args.bbox
    if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        fail("invalid --bbox")
    try:
        import numpy
        from netCDF4 import Dataset
    except ImportError:
        fail("netCDF4 is not installed; see the usage text at the top of this file")
    sha = hashlib.sha256()
    with open(args.input, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            sha.update(block)
    ds = Dataset(args.input)
    try:
        for name in ("lwe_thickness", "lat", "lon", "time"):
            if name not in ds.variables:
                fail("missing variable " + name)
        lwe = ds.variables["lwe_thickness"]
        if getattr(lwe, "units", "") != "cm":
            fail("lwe_thickness is not in cm: " + str(getattr(lwe, "units", None)))
        if lwe.dimensions != ("time", "lat", "lon"):
            fail("unexpected dimensions " + str(lwe.dimensions))
        time_units = getattr(ds.variables["time"], "units", "")
        match = re.fullmatch(r"days since (\d{4}-\d{2}-\d{2})(?: 00:00:00|T00:00:00Z)?", time_units)
        if not match:
            fail("unexpected time units: " + time_units)
        origin = datetime.date.fromisoformat(match.group(1))
        lats = [float(v) for v in ds.variables["lat"][:]]
        lons = [float(v) for v in ds.variables["lon"][:]]
        # The file stores longitude from 0 to 360; Morocco lies west of 0.
        lons = [v - 360.0 if v > 180.0 else v for v in lons]
        months = []
        for day in ds.variables["time"][:]:
            date = origin + datetime.timedelta(days=float(day))
            months.append("%04d-%02d" % (date.year, date.month))
        # The real file has a few months with two partial solutions (found on
        # 2026-11-09: 2012-01 and 2015-04). Choosing one would invent a value,
        # so those months are left out and reported.
        counts = {}
        for month in months:
            counts[month] = counts.get(month, 0) + 1
        duplicated = sorted(m for m, c in counts.items() if c > 1)
        keep = [k for k, month in enumerate(months) if counts[month] == 1]
        if duplicated:
            print("grace-extract: left out months with two solutions: " + ", ".join(duplicated))
        lat_index = [i for i, v in enumerate(lats) if south <= v <= north]
        lon_index = [i for i, v in enumerate(lons) if west <= v <= east]
        if not lat_index or not lon_index:
            fail("the bounding box holds no cells")
        cells = []
        for i in lat_index:
            for j in lon_index:
                series = lwe[:, i, j]
                values = []
                for k in keep:
                    month = months[k]
                    value = series[k]
                    # Masked or non-finite values are months without data.
                    if numpy.ma.is_masked(value):
                        continue
                    number = float(value)
                    if not math.isfinite(number) or abs(number) > 2000:
                        continue
                    values.append([month, round(number, 3)])
                if values:
                    cells.append(
                        {"latitude": round(lats[i], 3), "longitude": round(lons[j], 3), "months": values}
                    )
        if not cells:
            fail("no cell holds data")
        title = os.path.basename(args.input)
        title = re.sub(r"\.nc$", "", title)
        product = args.product if args.product is not None else title[:200]
        if not 1 <= len(product) <= 200:
            fail("--product must be 1 to 200 characters")
        out = {"product": product, "sourceSha256": sha.hexdigest(), "cells": cells}
    finally:
        ds.close()
    with open(args.output, "w") as handle:
        json.dump(out, handle, separators=(",", ":"))
    print(
        "wrote %s: %d cells, months %s to %s, source sha256 %s"
        % (args.output, len(cells), months[keep[0]], months[keep[-1]], sha.hexdigest()[:12])
    )


if __name__ == "__main__":
    main()
