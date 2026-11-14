import { timestamp } from "../../../i18n/format.js";
import { useEffect, useState, type FormEvent } from "react";
import {
  weatherRequestSchema,
  weatherVariableDefinitions,
  type WeatherCapabilities,
  type WeatherResponse,
  type WeatherVariable,
} from "@rotavise/contracts";
import { errorMessage } from "../../../app/http.js";
import { getWeatherCapabilities, queryWeather } from "../api/weather-client.js";

function Chart({
  response,
  variable,
}: {
  response: WeatherResponse;
  variable: WeatherVariable;
}) {
  const values = response.snapshot.days.map((d) => d.values[variable] ?? null);
  const observed = values.filter((v): v is number => v !== null);
  if (!observed.length)
    return <p>No values are available for this measurement in this range.</p>;
  const min = Math.min(...observed),
    max = Math.max(...observed),
    span = Math.max(max - min, 1);
  const width = 640,
    height = 160,
    margin = 18;
  const segments: string[] = [];
  let current = "";
  values.forEach((value, i) => {
    if (value === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    const x =
      margin + (i / Math.max(values.length - 1, 1)) * (width - 2 * margin);
    const y = height - margin - ((value - min) / span) * (height - 2 * margin);
    current += `${current ? " L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (current) segments.push(current);
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${variable} daily values, from ${min} to ${max} ${weatherVariableDefinitions[variable].unit}`}
      >
        <line
          x1={margin}
          x2={width - margin}
          y1={height - margin}
          y2={height - margin}
          stroke="currentColor"
          opacity=".35"
        />
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="chart-scale">
        <span>
          {min.toFixed(1)} {weatherVariableDefinitions[variable].unit}
        </span>
        <span>
          {max.toFixed(1)} {weatherVariableDefinitions[variable].unit}
        </span>
      </div>
    </div>
  );
}

export function WeatherExplorer() {
  const [capabilities, setCapabilities] = useState<WeatherCapabilities | null>(
    null,
  );
  const [result, setResult] = useState<WeatherResponse | null>(null);
  const [resultVariables, setResultVariables] = useState<WeatherVariable[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [start, setStart] = useState("2020-01-01");
  const [end, setEnd] = useState("2020-01-31");
  const [selected, setSelected] = useState<WeatherVariable[]>([
    "temperatureMean",
    "precipitation",
  ]);
  useEffect(() => {
    const controller = new AbortController();
    void getWeatherCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    const parsed = weatherRequestSchema.safeParse({
      latitude: latitude.trim() ? Number(latitude) : NaN,
      longitude: longitude.trim() ? Number(longitude) : NaN,
      startDate: start,
      endDate: end,
      variables: selected,
    });
    if (
      !parsed.success ||
      !capabilities ||
      end > capabilities.latestAllowedDate
    ) {
      setError(
        "Check coordinates, dates, selected measurements and the available date range.",
      );
      return;
    }
    setBusy(true);
    try {
      const next = await queryWeather(parsed.data);
      setResult(next);
      setResultVariables(parsed.data.variables);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel" aria-labelledby="weather-title">
      <div className="section-heading">
        <p className="eyebrow">HISTORICAL EVIDENCE</p>
        <h2 id="weather-title">Weather explorer</h2>
      </div>
      <p>
        Explore NASA POWER daily grid estimates. These are historical values,
        not field measurements or forecasts. Changing chart variables does not
        change crop scoring.
      </p>
      {capabilities ? (
        <form onSubmit={(e) => void submit(e)} className="form-stack">
          <div className="form-grid">
            <label>
              Latitude{" "}
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
              Longitude{" "}
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
            <label>
              From{" "}
              <input
                type="date"
                value={start}
                min={capabilities.earliestDate}
                max={capabilities.latestAllowedDate}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
            <label>
              To{" "}
              <input
                type="date"
                value={end}
                min={start}
                max={capabilities.latestAllowedDate}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <p className="muted">
            Maximum {capabilities.maxDays} inclusive days. Latest allowed date:{" "}
            {capabilities.latestAllowedDate} (120-day evidence buffer).
          </p>
          <fieldset>
            <legend>Measurements</legend>
            <div className="choice-grid">
              {capabilities.variables.map((item) => (
                <label className="choice" key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, item.id]
                          : selected.filter((v) => v !== item.id),
                      )
                    }
                  />
                  <span>
                    <strong>{item.id.replace(/([A-Z])/g, " $1")}</strong>
                    <small>
                      {item.unit} · from {item.earliestDate}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Loading historical weather…" : "Load weather"}
          </button>
        </form>
      ) : (
        <p role="status">Loading supported measurements…</p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {result && (
        <div className="result-stack">
          <div className="notice">
            <strong>
              NASA POWER · {result.snapshot.provenance.timeStandard}
            </strong>
            <br />
            {result.snapshot.provenance.attribution}
            <br />
            Dataset: {result.snapshot.provenance.sources.join(", ")} · retrieved{" "}
            {timestamp(result.snapshot.provenance.retrievedAt, "en")} · cache{" "}
            {result.cache}. Values are grid estimates.
          </div>
          {resultVariables.map((variable) => {
            const coverage = result.snapshot.coverage.find(
              (c) => c.variable === variable,
            );
            const definition = result.snapshot.provenance.variables.find(
              (v) => v.variable === variable,
            );
            if (!coverage || !definition) return null;
            return (
              <article className="weather-card" key={variable}>
                <h3>
                  {variable.replace(/([A-Z])/g, " $1")}{" "}
                  <span className="muted">({definition.unit})</span>
                </h3>
                <p>
                  {definition.definition}. Coverage:{" "}
                  {coverage.expectedDays - coverage.missingDates.length}/
                  {coverage.expectedDays} days; {coverage.missingDates.length}{" "}
                  missing. Source: {definition.parameter}.
                </p>
                <Chart response={result} variable={variable} />
                {coverage.missingDates.length > 0 && (
                  <p className="muted">
                    Missing dates:{" "}
                    {coverage.missingDates.slice(0, 12).join(", ")}
                    {coverage.missingDates.length > 12
                      ? " and more in the table"
                      : ""}
                    .
                  </p>
                )}
              </article>
            );
          })}
          <details>
            <summary>Daily values and missing data table</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date UTC</th>
                    {resultVariables.map((v) => (
                      <th scope="col" key={v}>
                        {v} ({weatherVariableDefinitions[v].unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.snapshot.days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{day.date}</th>
                      {resultVariables.map((v) => (
                        <td key={v}>
                          {day.values[v] === null ? "Missing" : day.values[v]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
