"""Stateless internal science service. It has no database and no farmer identity,
and answers only the TypeScript worker. Same input and same version, same output."""
import json
import os
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version

os.environ.setdefault("DEVELOPMENT", "1")
warnings.filterwarnings("ignore")
import pandas as pd  # noqa: E402
from aquacrop import (  # noqa: E402
    AquaCropModel,
    Crop,
    InitialWaterContent,
    IrrigationManagement,
    Soil,
)

SERVICE_VERSION = "1"
CROPS = {
    "WheatGDD", "BarleyGDD", "SugarBeetGDD", "SunflowerGDD", "PotatoGDD", "TomatoGDD", "MaizeGDD",
}
SOILS = {
    "Clay", "ClayLoam", "Loam", "LoamySand", "Sand", "SandyClay",
    "SandyClayLoam", "SandyLoam", "Silt", "SiltClayLoam", "SiltLoam", "SiltClay",
}
MAX_BYTES = 8 * 1024 * 1024
MAX_SIMULATIONS = 4000
# Irrigate when soil water falls below this share of what the crop can use, a
# declared stand-in for "water is available", not a farmer's schedule.
IRRIGATION_THRESHOLD = 60
SPIN_UP_DAYS = 75


class BadRequest(Exception):
    pass


def weather_frame(weather):
    days = len(weather["maxTemp"])
    if days < 366 or days > 16000:
        raise BadRequest("WEATHER_LENGTH")
    for key in ("minTemp", "rain", "referenceEt"):
        if len(weather[key]) != days:
            raise BadRequest("WEATHER_SHAPE")
    return pd.DataFrame(
        {
            "MinTemp": weather["minTemp"],
            "MaxTemp": weather["maxTemp"],
            "Precipitation": weather["rain"],
            "ReferenceET": weather["referenceEt"],
            "Date": pd.date_range(weather["start"], periods=days),
        }
    )


def simulate(frame, soil, irrigated, s):
    crop, sown, end = s["crop"], s["sown"], s["end"]
    if crop not in CROPS:
        raise BadRequest("CROP")
    options = {}
    if irrigated:
        options["irrigation_management"] = IrrigationManagement(
            irrigation_method=1, SMT=[IRRIGATION_THRESHOLD] * 4
        )
    # Dry soil at the end of summer, filled by autumn rain before sowing.
    start = pd.Timestamp(sown) - pd.Timedelta(days=SPIN_UP_DAYS)
    model = AquaCropModel(
        sim_start_time=start.strftime("%Y/%m/%d"),
        sim_end_time=pd.Timestamp(end).strftime("%Y/%m/%d"),
        weather_df=frame,
        soil=Soil(soil),
        crop=Crop(crop, planting_date=pd.Timestamp(sown).strftime("%m/%d")),
        initial_water_content=InitialWaterContent(value=["WP"]),
        **options,
    )
    model.run_model(till_termination=True)
    row = model.get_simulation_results().iloc[0]
    return {
        "yieldTPerHa": round(float(row["Dry yield (tonne/ha)"]), 3),
        "potentialTPerHa": round(float(row["Yield potential (tonne/ha)"]), 3),
        "irrigationMm": round(float(row["Seasonal irrigation (mm)"]), 1),
    }


def aquacrop(body):
    soil = body["soil"]
    if soil not in SOILS:
        raise BadRequest("SOIL")
    simulations = body["simulations"]
    if not isinstance(simulations, list) or len(simulations) > MAX_SIMULATIONS:
        raise BadRequest("SIMULATIONS")
    frame = weather_frame(body["weather"])
    results = []
    for s in simulations:
        try:
            results.append({**simulate(frame, soil, bool(body["irrigated"]), s)})
        except BadRequest:
            raise
        except Exception:  # A season the model cannot finish stays unknown.
            results.append(None)
    return {
        "model": "AquaCrop-OSPy",
        "modelVersion": version("aquacrop"),
        "serviceVersion": SERVICE_VERSION,
        "results": results,
    }


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self.reply(200, {"status": "ok", "serviceVersion": SERVICE_VERSION})
        else:
            self.reply(404, {"error": "NOT_FOUND"})

    def do_POST(self):
        size = int(self.headers.get("content-length") or 0)
        if self.path != "/aquacrop" or size < 1 or size > MAX_BYTES:
            self.reply(400, {"error": "REQUEST_INVALID"})
            return
        try:
            self.reply(200, aquacrop(json.loads(self.rfile.read(size))))
        except (BadRequest, KeyError, TypeError, ValueError) as error:
            self.reply(400, {"error": str(error)[:80] or "REQUEST_INVALID"})

    def log_message(self, *_):
        pass  # Requests carry weather only, and nothing needs logging.


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8090"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
