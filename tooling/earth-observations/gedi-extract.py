#!/usr/bin/env python3
"""Cuts the Morocco region out of the GEDI L4B 1 km gridded biomass rasters.

Input: the mean aboveground biomass density raster (and optionally its standard
error raster) from the ORNL DAAC bundle GEDI_L4B_Gridded_Biomass_V2_1_2299.zip
(doi:10.3334/ORNLDAAC/2299), which needs an Earthdata login to download (see
docs/steps/15/p5-notes.md). Output: a small JSON file that `pnpm gedi:import`
loads into the database. The tool changes nothing else, never touches the
network and never reads the .env file.

It refuses any file that is not what it expects (projected grid, cells of about
1 km, a declared no-data value, plausible values) instead of guessing. Run it
inside a virtual environment that has rasterio and pyproj:

    python3 -m venv .artifacts/gedi-venv
    .artifacts/gedi-venv/bin/pip install rasterio==1.4.3 pyproj==3.6.1 numpy
    .artifacts/gedi-venv/bin/python tooling/earth-observations/gedi-extract.py \
        --agbd path/to/mean_agbd.tif --se path/to/standard_error.tif \
        --output .artifacts/gedi-morocco.json
"""
import argparse
import hashlib
import json
import math
import sys

DEFAULT_PRODUCT = (
    "GEDI L4B Gridded Aboveground Biomass Density V2.1 (1 km), "
    "doi:10.3334/ORNLDAAC/2299"
)
MAX_CELLS = 2_000_000


def fail(message):
    sys.exit("gedi-extract: " + message)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--agbd", required=True, help="mean AGBD raster, Mg/ha")
    parser.add_argument("--se", help="standard error raster, Mg/ha (optional)")
    parser.add_argument("--output", required=True)
    parser.add_argument("--product", default=DEFAULT_PRODUCT)
    # Morocco and a margin, in degrees (south, north, west, east).
    parser.add_argument("--bbox", nargs=4, type=float, default=[26.0, 37.0, -14.0, 0.0])
    args = parser.parse_args()
    south, north, west, east = args.bbox
    if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        fail("invalid --bbox")
    if not 1 <= len(args.product) <= 200:
        fail("--product must be 1 to 200 characters")
    try:
        import numpy
        import pyproj
        import rasterio
        from rasterio.transform import xy
        from rasterio.windows import Window, from_bounds
    except ImportError:
        fail("rasterio, pyproj and numpy are required; see the usage text at the top of this file")

    def open_grid(path, label):
        ds = rasterio.open(path)
        if ds.crs is None or not ds.crs.is_projected:
            fail(label + " is not on a projected grid")
        if ds.crs.linear_units.lower() not in ("metre", "meter", "metres", "meters"):
            fail(label + " grid is not in metres: " + str(ds.crs.linear_units))
        if not (900 <= abs(ds.transform.a) <= 1100 and 900 <= abs(ds.transform.e) <= 1100):
            fail(
                label
                + " cells are not about 1 km: "
                + "%.1f x %.1f" % (abs(ds.transform.a), abs(ds.transform.e))
            )
        if ds.nodata is None and ds.dtypes[0].startswith(("int", "uint")):
            fail(label + " declares no no-data value; refusing to treat every cell as data")
        return ds

    source_hash = sha256(args.agbd)
    agbd_ds = open_grid(args.agbd, "the biomass raster")
    se_ds = open_grid(args.se, "the standard error raster") if args.se else None
    try:
        if se_ds is not None and (
            se_ds.crs != agbd_ds.crs
            or se_ds.transform != agbd_ds.transform
            or (se_ds.width, se_ds.height) != (agbd_ds.width, agbd_ds.height)
        ):
            fail("the two rasters do not share one grid")
        to_grid = pyproj.Transformer.from_crs("EPSG:4326", agbd_ds.crs, always_xy=True)
        to_geo = pyproj.Transformer.from_crs(agbd_ds.crs, "EPSG:4326", always_xy=True)
        # Edge midpoints too, because a projected rectangle bulges.
        lons = [west, east, west, east, (west + east) / 2, (west + east) / 2, west, east]
        lats = [south, south, north, north, south, north, (south + north) / 2, (south + north) / 2]
        gx, gy = to_grid.transform(lons, lats)
        left, right, bottom, top = min(gx), max(gx), min(gy), max(gy)
        window = from_bounds(left, bottom, right, top, agbd_ds.transform)
        # Cover every pixel intersecting the transformed bounds. Rounding a
        # length independently of its offset can lose the last eastern column.
        first_col, first_row = math.floor(window.col_off), math.floor(window.row_off)
        last_col = math.ceil(window.col_off + window.width)
        last_row = math.ceil(window.row_off + window.height)
        window = Window(first_col, first_row, last_col - first_col, last_row - first_row)
        try:
            window = window.intersection(Window(0, 0, agbd_ds.width, agbd_ds.height))
        except Exception:
            fail("the bounding box lies outside the raster")
        data = agbd_ds.read(1, window=window, masked=True).astype("float64")
        se_data = se_ds.read(1, window=window, masked=True).astype("float64") if se_ds else None
        # Non-finite values are cells without an estimate.
        data = numpy.ma.masked_invalid(data)
        rows, cols = numpy.nonzero(~numpy.ma.getmaskarray(data))
        if rows.size == 0:
            fail("no cell in the bounding box holds an estimate")
        values = numpy.asarray(data[rows, cols], dtype="float64")
        if values.min() < 0 or values.max() > 5000:
            fail(
                "biomass values outside 0 to 5000 (min %.2f, max %.2f): wrong file or units"
                % (values.min(), values.max())
            )
        win_transform = agbd_ds.window_transform(window)
        xs, ys = xy(win_transform, rows, cols, offset="center")
        lon, lat = to_geo.transform(numpy.asarray(xs), numpy.asarray(ys))
        inside = (lat >= south) & (lat <= north) & (lon >= west) & (lon <= east)
        cells = []
        for k in numpy.nonzero(inside)[0]:
            se_value = None
            if se_data is not None:
                raw = se_data[rows[k], cols[k]]
                if not numpy.ma.is_masked(raw) and numpy.isfinite(raw):
                    se_value = float(raw)
                    if se_value < 0 or se_value > 5000:
                        fail("standard error values outside 0 to 5000: wrong file or units")
                    se_value = round(se_value, 3)
            cells.append([round(float(lat[k]), 4), round(float(lon[k]), 4), round(float(values[k]), 3), se_value])
        if not cells:
            fail("no cell with an estimate lies inside the bounding box")
        if len(cells) > MAX_CELLS:
            fail("%d cells exceed the limit of %d; narrow --bbox" % (len(cells), MAX_CELLS))
    finally:
        agbd_ds.close()
        if se_ds is not None:
            se_ds.close()
    with open(args.output, "w") as handle:
        json.dump({"product": args.product, "sourceSha256": source_hash, "cells": cells}, handle, separators=(",", ":"))
    print("wrote %s: %d cells, source sha256 %s" % (args.output, len(cells), source_hash[:12]))


if __name__ == "__main__":
    main()
