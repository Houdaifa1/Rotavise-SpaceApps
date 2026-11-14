import { useEffect, useState, type FormEvent } from "react";
import {
  planRequestSchema,
  type CatalogOptions,
  type PlanRequest,
  type FieldProfile,
  type CropHistoryEntry,
} from "@rotavise/contracts";
import { errorMessage } from "../../../app/http.js";
import { saveFieldWithHistory } from "../../account/index.js";

const dateAfter = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
type History = { crop_id: string; planted_on: string; harvested_on: string };
type Health = {
  crop_id: string;
  kind: "disease" | "pest";
  name: string;
  observed_on: string;
  source: "farmer_report" | "specialist_report" | "laboratory_report";
  confirmation: "reported" | "confirmed";
};
export function PlanForm({
  catalog,
  account,
  onSubmit,
  prefilling,
}: {
  catalog: CatalogOptions;
  account: boolean;
  onSubmit: (input: PlanRequest) => Promise<void>;
  prefilling?: { profile: FieldProfile; history: History[] } | null;
}) {
  const [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [historyKnown, setHistoryKnown] = useState(false),
    [historyComplete, setHistoryComplete] = useState(false);
  const [history, setHistory] = useState<History[]>([]);
  const [healthKnown, setHealthKnown] = useState(false),
    [health, setHealth] = useState<Health[]>([]);
  const [soilKnown, setSoilKnown] = useState(false),
    [soilPh, setSoilPh] = useState(""),
    [soilMethod, setSoilMethod] = useState<"unknown" | "water" | "cacl2">(
      "unknown",
    );
  const [water, setWater] = useState<
    "unknown" | "rainfed" | "irrigation_limited" | "irrigation_available"
  >("unknown");
  const [first, setFirst] = useState(dateAfter(14)),
    [last, setLast] = useState(dateAfter(74)),
    [end, setEnd] = useState(dateAfter(740));
  const [mode, setMode] = useState<"consider" | "suggest">("suggest"),
    [considered, setConsidered] = useState<string[]>([]),
    [excluded, setExcluded] = useState<string[]>([]);
  const [priority, setPriority] = useState<
    "lower_water_demand" | "soil_health"
  >("lower_water_demand");
  const [review, setReview] = useState<PlanRequest | null>(null),
    [issues, setIssues] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!prefilling) return;
    setLatitude(String(prefilling.profile.location.latitude));
    setLongitude(String(prefilling.profile.location.longitude));
    setFieldName(prefilling.profile.name);
    if (prefilling.profile.soil.status === "known") {
      const p = prefilling.profile.soil.observations.find(
        (o) => o.metric === "ph",
      );
      if (p && p.metric === "ph") {
        setSoilKnown(true);
        setSoilPh(String(p.value));
        setSoilMethod(p.method);
      }
    }
    if (prefilling.profile.water.status === "reported")
      setWater(prefilling.profile.water.availability);
    if (prefilling.profile.crop_health.status === "reported") {
      setHealthKnown(true);
      setHealth(
        prefilling.profile.crop_health.observations.map((o) => ({ ...o })),
      );
    }
    if (prefilling.history.length) {
      setHistoryKnown(true);
      setHistory(prefilling.history);
    }
    setReview(null);
    setMessage(
      "Saved field loaded. Review its details before submitting a new plan.",
    );
  }, [prefilling]);
  function build(): PlanRequest | null {
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      (soilKnown && !soilPh.trim())
    ) {
      setIssues([
        "Enter your field coordinates and any soil pH you marked as known.",
      ]);
      setReview(null);
      return null;
    }
    const input = {
      schema_version: "1",
      location: { latitude: Number(latitude), longitude: Number(longitude) },
      history: historyKnown
        ? {
            status: "known",
            completeness: historyComplete ? "complete" : "partial",
            entries: history.map((h) => ({
              crop_id: h.crop_id,
              planted_on: h.planted_on || null,
              harvested_on: h.harvested_on || null,
            })),
          }
        : { status: "unknown" },
      crop_health: healthKnown
        ? { status: "reported", observations: health }
        : { status: "unknown" },
      soil: soilKnown
        ? {
            status: "known",
            observations: [
              {
                metric: "ph",
                value: Number(soilPh),
                unit: "pH",
                method: soilMethod,
                measured_on: null,
                source: "farmer_observation",
              },
            ],
          }
        : { status: "unknown" },
      water:
        water === "unknown"
          ? { status: "unknown" }
          : { status: "reported", availability: water },
      planning: {
        cycles: 2,
        earliest_start_date: first,
        latest_start_date: last,
        search_end_date: end,
      },
      preferences: {
        mode,
        considered_next_crop_ids: mode === "consider" ? considered : [],
        excluded_crop_ids: excluded,
        priority,
      },
    };
    const parsed = planRequestSchema.safeParse(input);
    if (!parsed.success) {
      setIssues(
        parsed.error.issues.map(
          (i) => `${i.path.join(" / ") || "Form"}: ${i.message}`,
        ),
      );
      setReview(null);
      return null;
    }
    setIssues([]);
    return parsed.data;
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const input = build();
    if (input) setReview(input);
  }
  async function save() {
    const input = build();
    if (!input) return;
    if (!fieldName.trim()) {
      setIssues(["Field name is required to save a field."]);
      return;
    }
    const dated: CropHistoryEntry[] = [];
    if (input.history.status === "known")
      for (const item of input.history.entries) {
        if (!item.planted_on || !item.harvested_on) {
          setIssues([
            "Saving history needs both planting and harvest dates for every previous crop. You can still submit the plan with unknown dates.",
          ]);
          return;
        }
        dated.push({
          schema_version: "1",
          crop_id: item.crop_id,
          planted_on: item.planted_on,
          harvested_on: item.harvested_on,
        });
      }
    setBusy(true);
    setMessage("");
    try {
      const profile: FieldProfile = {
        schema_version: "1",
        name: fieldName.trim(),
        location: input.location,
        soil: input.soil,
        water: input.water,
        crop_health: input.crop_health,
      };
      await saveFieldWithHistory(profile, dated);
      setMessage(
        `Field saved with ${dated.length} dated history entries. Saving does not validate agronomy or change an existing plan.`,
      );
    } catch (error) {
      setMessage(
        errorMessage(error) +
          " The server saves the field and history together. If the connection failed, check saved fields before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  const toggle = (array: string[], id: string, set: (v: string[]) => void) =>
    set(array.includes(id) ? array.filter((v) => v !== id) : [...array, id]);
  return (
    <section className="feature-panel" aria-labelledby="plan-title">
      <div className="section-heading">
        <p className="eyebrow">FIELD PLANNING</p>
        <h2 id="plan-title">Plan two crop cycles</h2>
      </div>
      <p>
        Tell us what you know. Unknown answers stay unknown. The current catalog
        is research evidence and has no reviewed local planting rules, so a real
        plan will explain missing evidence rather than invent dates.
      </p>
      <form onSubmit={prepare} className="form-stack">
        <fieldset>
          <legend>1. Your field</legend>
          <div className="form-grid">
            <label>
              Latitude (WGS84)
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </label>
            <label>
              Longitude (WGS84)
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </label>
            {account && (
              <label>
                Field name for saving (optional)
                <input
                  value={fieldName}
                  maxLength={80}
                  onChange={(e) => setFieldName(e.target.value)}
                />
              </label>
            )}
          </div>
          <p className="muted">
            Use coordinates from a map pin or GPS. Location is not proof of
            local cultivar or soil conditions.
          </p>
        </fieldset>
        <fieldset>
          <legend>2. Previous crop and health</legend>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={historyKnown}
              onChange={(e) => {
                setHistoryKnown(e.target.checked);
                if (e.target.checked && !history.length)
                  setHistory([
                    { crop_id: "", planted_on: "", harvested_on: "" },
                  ]);
              }}
            />{" "}
            I know at least one previous crop
          </label>
          {historyKnown && (
            <>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={historyComplete}
                  onChange={(e) => setHistoryComplete(e.target.checked)}
                />{" "}
                This history is complete for the relevant period
              </label>
              {history.map((item, index) => (
                <div className="form-grid subentry" key={index}>
                  <label>
                    Previous crop ID
                    <input
                      value={item.crop_id}
                      list="crop-options"
                      onChange={(e) =>
                        setHistory(
                          history.map((h, i) =>
                            i === index ? { ...h, crop_id: e.target.value } : h,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    Planted on (if known)
                    <input
                      type="date"
                      value={item.planted_on}
                      onChange={(e) =>
                        setHistory(
                          history.map((h, i) =>
                            i === index
                              ? { ...h, planted_on: e.target.value }
                              : h,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Harvested on (if known)
                    <input
                      type="date"
                      value={item.harvested_on}
                      onChange={(e) =>
                        setHistory(
                          history.map((h, i) =>
                            i === index
                              ? { ...h, harvested_on: e.target.value }
                              : h,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button-text"
                    onClick={() =>
                      setHistory(history.filter((_, i) => i !== index))
                    }
                  >
                    Remove crop
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button-secondary"
                disabled={history.length >= 20}
                onClick={() =>
                  setHistory([
                    ...history,
                    { crop_id: "", planted_on: "", harvested_on: "" },
                  ])
                }
              >
                Add previous crop
              </button>
            </>
          )}
          <label className="inline-check">
            <input
              type="checkbox"
              checked={healthKnown}
              onChange={(e) => {
                setHealthKnown(e.target.checked);
                if (e.target.checked && !health.length)
                  setHealth([
                    {
                      crop_id: "",
                      kind: "disease",
                      name: "",
                      observed_on: dateAfter(-1),
                      source: "farmer_report",
                      confirmation: "reported",
                    },
                  ]);
              }}
            />{" "}
            I have disease or pest observations
          </label>
          {healthKnown && (
            <>
              {health.map((item, index) => (
                <div className="form-grid subentry" key={index}>
                  <label>
                    Crop ID
                    <input
                      value={item.crop_id}
                      list="crop-options"
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index ? { ...h, crop_id: e.target.value } : h,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={item.kind}
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index
                              ? { ...h, kind: e.target.value as Health["kind"] }
                              : h,
                          ),
                        )
                      }
                    >
                      <option value="disease">Disease</option>
                      <option value="pest">Pest</option>
                    </select>
                  </label>
                  <label>
                    Observed issue
                    <input
                      value={item.name}
                      maxLength={120}
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index ? { ...h, name: e.target.value } : h,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    Observed on
                    <input
                      type="date"
                      value={item.observed_on}
                      max={dateAfter(0)}
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index
                              ? { ...h, observed_on: e.target.value }
                              : h,
                          ),
                        )
                      }
                      required
                    />
                  </label>
                  <label>
                    Source
                    <select
                      value={item.source}
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index
                              ? {
                                  ...h,
                                  source: e.target.value as Health["source"],
                                  confirmation: "reported",
                                }
                              : h,
                          ),
                        )
                      }
                    >
                      <option value="farmer_report">Farmer report</option>
                      <option value="specialist_report">
                        Specialist report
                      </option>
                      <option value="laboratory_report">
                        Laboratory report
                      </option>
                    </select>
                  </label>
                  <label>
                    Confirmation
                    <select
                      value={item.confirmation}
                      onChange={(e) =>
                        setHealth(
                          health.map((h, i) =>
                            i === index
                              ? {
                                  ...h,
                                  confirmation: e.target
                                    .value as Health["confirmation"],
                                }
                              : h,
                          ),
                        )
                      }
                    >
                      <option value="reported">Reported</option>
                      {item.source !== "farmer_report" && (
                        <option value="confirmed">Confirmed by source</option>
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button-text"
                    onClick={() =>
                      setHealth(health.filter((_, i) => i !== index))
                    }
                  >
                    Remove observation
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button-secondary"
                disabled={health.length >= 20}
                onClick={() =>
                  setHealth([
                    ...health,
                    {
                      crop_id: "",
                      kind: "disease",
                      name: "",
                      observed_on: dateAfter(-1),
                      source: "farmer_report",
                      confirmation: "reported",
                    },
                  ])
                }
              >
                Add observation
              </button>
              <p className="muted">A farmer report is not a diagnosis.</p>
            </>
          )}
        </fieldset>
        <fieldset>
          <legend>3. Soil and water</legend>
          <div className="form-grid">
            <label>
              Soil information
              <select
                value={soilKnown ? "known" : "unknown"}
                onChange={(e) => setSoilKnown(e.target.value === "known")}
              >
                <option value="unknown">Unknown</option>
                <option value="known">I have a pH observation</option>
              </select>
            </label>
            {soilKnown && (
              <>
                <label>
                  Soil pH
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="any"
                    value={soilPh}
                    onChange={(e) => setSoilPh(e.target.value)}
                    required
                  />
                </label>
                <label>
                  pH method
                  <select
                    value={soilMethod}
                    onChange={(e) =>
                      setSoilMethod(e.target.value as typeof soilMethod)
                    }
                  >
                    <option value="unknown">Unknown</option>
                    <option value="water">Water</option>
                    <option value="cacl2">Calcium chloride</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Water availability
              <select
                value={water}
                onChange={(e) => setWater(e.target.value as typeof water)}
              >
                <option value="unknown">Unknown</option>
                <option value="rainfed">Rainfed</option>
                <option value="irrigation_limited">Limited irrigation</option>
                <option value="irrigation_available">
                  Irrigation available
                </option>
              </select>
            </label>
          </div>
          <p className="muted">
            Reported supply does not establish irrigation adequacy.
          </p>
        </fieldset>
        <fieldset>
          <legend>4. Planting window</legend>
          <div className="form-grid">
            <label>
              Earliest first planting
              <input
                type="date"
                value={first}
                min={dateAfter(0)}
                onChange={(e) => setFirst(e.target.value)}
                required
              />
            </label>
            <label>
              Latest first planting
              <input
                type="date"
                value={last}
                min={first}
                onChange={(e) => setLast(e.target.value)}
                required
              />
            </label>
            <label>
              End of two-cycle search
              <input
                type="date"
                value={end}
                min={last}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>5. Crop choices</legend>
          <label className="inline-check">
            <input
              type="radio"
              name="choice-mode"
              checked={mode === "suggest"}
              onChange={() => setMode("suggest")}
            />{" "}
            Suggest options
          </label>
          <label className="inline-check">
            <input
              type="radio"
              name="choice-mode"
              checked={mode === "consider"}
              onChange={() => setMode("consider")}
            />{" "}
            Assess crops I am considering
          </label>
          <div className="choice-grid">
            {catalog.crops.map((crop) => (
              <div className="crop-choice" key={crop.id}>
                <strong>{crop.name}</strong>
                <small>
                  {crop.scientificName} ·{" "}
                  {crop.reviewStatus === "pending"
                    ? "Local review pending"
                    : "Reviewed"}
                </small>
                {mode === "consider" && (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={considered.includes(crop.id)}
                      onChange={() => {
                        toggle(considered, crop.id, setConsidered);
                        setExcluded(excluded.filter((v) => v !== crop.id));
                      }}
                    />{" "}
                    Consider first
                  </label>
                )}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={excluded.includes(crop.id)}
                    onChange={() => {
                      toggle(excluded, crop.id, setExcluded);
                      setConsidered(considered.filter((v) => v !== crop.id));
                    }}
                  />{" "}
                  Exclude
                </label>
              </div>
            ))}
          </div>
          <datalist id="crop-options">
            {catalog.crops.map((crop) => (
              <option value={crop.id} key={crop.id}>
                {crop.name}
              </option>
            ))}
          </datalist>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="lower_water_demand">
                Lower relative water demand
              </option>
              <option value="soil_health">Sourced rotation/soil proxy</option>
            </select>
          </label>
          <p className="muted">
            Priorities use uncalibrated comparison weights. They are not yield
            or profit predictions.
          </p>
        </fieldset>
        {issues.length > 0 && (
          <div role="alert" className="notice error">
            <strong>Please fix these inputs:</strong>
            <ul>
              {issues.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="button-primary">
            Review plan request
          </button>
          {account && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => void save()}
            >
              Save field and dated history
            </button>
          )}
        </div>
      </form>
      {review && (
        <div className="review-box">
          <h3>Review before submitting</h3>
          <p>
            Two future cycles · {review.planning.earliest_start_date} to{" "}
            {review.planning.latest_start_date} first start · search through{" "}
            {review.planning.search_end_date}
          </p>
          <p>
            Coordinates: {review.location.latitude}, {review.location.longitude}
            . First crop:{" "}
            {review.preferences.mode === "suggest"
              ? "suggest options"
              : review.preferences.considered_next_crop_ids.join(", ")}
            . Priority: {review.preferences.priority.replaceAll("_", " ")}.
          </p>
          <p>
            Previous crop: {review.history.status}. Crop health:{" "}
            {review.crop_health.status}. Soil: {review.soil.status}. Water:{" "}
            {review.water.status}.
          </p>
          <p className="muted">
            Results may be insufficient because local agronomic rules have not
            been reviewed.
          </p>
          <div className="actions">
            <button
              type="button"
              className="button-primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onSubmit(review)
                  .catch((e: unknown) => setMessage(errorMessage(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Submit for assessment
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setReview(null);
                document.getElementById("plan-title")?.scrollIntoView();
              }}
            >
              Change inputs
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
