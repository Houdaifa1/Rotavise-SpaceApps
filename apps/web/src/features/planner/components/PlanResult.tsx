import { timestamp } from "../../../i18n/format.js";
import type {
  CatalogOptions,
  ConstraintReason,
  SequenceSchedule,
} from "@rotavise/contracts";
import type { AnyPlan } from "../api/planner-client.js";

const readable = (code: string) => code.toLowerCase().replaceAll("_", " ");
function Reasons({
  items,
  catalog,
}: {
  items: ConstraintReason[];
  catalog: CatalogOptions;
}) {
  if (!items.length) return <p>No specific rule was recorded.</p>;
  return (
    <ul className="reason-list">
      {items.map((reason, index) => (
        <li key={`${reason.code}-${index}`}>
          <strong>{readable(reason.code)}</strong>{" "}
          <span className={`badge badge-${reason.effect}`}>
            {reason.effect}
          </span>
          {reason.inputPaths.length > 0 && (
            <span> · input: {reason.inputPaths.join(", ")}</span>
          )}
          {reason.ruleIds.length > 0 && (
            <span> · rules: {reason.ruleIds.join(", ")}</span>
          )}
          {reason.citations.map((citation, i) => {
            const source = catalog.sources.find(
              (s) => s.id === citation.sourceId,
            );
            return (
              <span key={i}>
                {" "}
                ·{" "}
                {source ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                ) : (
                  citation.sourceId
                )}{" "}
                ({citation.locator})
              </span>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
function Timeline({
  schedule,
  catalog,
}: {
  schedule: SequenceSchedule;
  catalog: CatalogOptions;
}) {
  const name = (id: string) =>
    catalog.crops.find((c) => c.id === id)?.name ?? id;
  return (
    <ol className="timeline">
      <li>
        <strong>{name(schedule.first.cropId)}</strong>
        <span>
          Sow {schedule.first.sownOn} · harvest {schedule.first.harvestEarliest}
          –{schedule.first.harvestLatest}
        </span>
      </li>
      <li>
        <strong>{name(schedule.second.cropId)}</strong>
        <span>
          Sow {schedule.second.sownOn} · harvest{" "}
          {schedule.second.harvestEarliest}–{schedule.second.harvestLatest}
        </span>
      </li>
    </ol>
  );
}
export function PlanResult({
  plan,
  catalog,
}: {
  plan: AnyPlan;
  catalog: CatalogOptions;
}) {
  if (plan.status === "failed")
    return (
      <section className="feature-panel" aria-labelledby="result-title">
        <h2 id="result-title">Assessment failed</h2>
        <p>
          The worker reported an operational failure:{" "}
          {plan.error ? readable(plan.error.code) : "The result is unavailable"}
          . This is not evidence that the field or crop is unsuitable. Retry by
          submitting a new request after the service recovers.
        </p>
      </section>
    );
  if (plan.status !== "completed")
    return (
      <section className="feature-panel" aria-labelledby="result-title">
        <h2 id="result-title">Assessment in progress</h2>
        <p role="status">
          {readable(plan.stage)} · attempt {plan.attempts}
        </p>
        <p>
          We keep checking the saved request. You can safely leave this page and
          return in this browser session.
        </p>
      </section>
    );
  if (
    !("intakeEvidence" in plan) ||
    !plan.result ||
    plan.result.kind !== "planning_assessment"
  )
    return (
      <section className="feature-panel">
        <h2>Intake record</h2>
        <p>
          This older request completed intake only. No crop assessment was
          calculated.
        </p>
      </section>
    );
  if (plan.result.synthetic)
    return (
      <section className="feature-panel">
        <h2>Result unavailable</h2>
        <p>
          Test-only synthetic evidence cannot be displayed as farmer advice.
        </p>
      </section>
    );
  const { assessment, comparisons, processing } = plan.result;
  const sequence = assessment.sequence;
  const findSchedule = (id: string) =>
    sequence.pairs.flatMap((p) => p.schedules).find((s) => s.id === id);
  const name = (id: string) =>
    catalog.crops.find((c) => c.id === id)?.name ?? id;
  return (
    <section
      className="feature-panel result-stack"
      aria-labelledby="result-title"
    >
      <div className="section-heading">
        <p className="eyebrow">SAVED ASSESSMENT</p>
        <h2 id="result-title">Your result</h2>
      </div>
      <p className="muted">
        Catalog {plan.intakeEvidence.catalogId}{" "}
        {plan.intakeEvidence.catalogVersion} · engine{" "}
        {plan.versions.engineVersion} · updated{" "}
        {timestamp(plan.updatedAt, "en")}
      </p>
      {comparisons.length ? (
        <div className="notice">
          <strong>Comparable crop sequences are available.</strong> Rankings
          apply only inside each evidence group and use uncalibrated weights.
          They are not predictions of yield, profit or crop success.
        </div>
      ) : (
        <div className="notice caution">
          <strong>No supported crop recommendation can be made yet.</strong>{" "}
          Outcome: {readable(assessment.outcome)}. The real catalog still lacks
          reviewed local calendars, durations and applicability. We will not
          show invented planting dates.
        </div>
      )}
      {comparisons.map((group, index) => (
        <article className="result-card" key={group.groupId}>
          <h3>Comparison group {index + 1}</h3>
          <p>
            {group.sensitive || group.topSensitive
              ? "Ranking changes under tested weights; treat the order as sensitive."
              : "No rank change in tested weights."}
          </p>
          {group.mainScheduleIds.map((id) => {
            const schedule = findSchedule(id);
            return schedule ? (
              <div key={id}>
                <h4>Main or tied choice</h4>
                <Timeline schedule={schedule} catalog={catalog} />
                <details>
                  <summary>Reasons and source references</summary>
                  <Reasons items={schedule.reasons} catalog={catalog} />
                </details>
              </div>
            ) : null;
          })}
          {group.alternativeScheduleIds.map((id) => {
            const schedule = findSchedule(id);
            return schedule ? (
              <div key={id}>
                <h4>Alternative</h4>
                <Timeline schedule={schedule} catalog={catalog} />
                <details>
                  <summary>Reasons and source references</summary>
                  <Reasons items={schedule.reasons} catalog={catalog} />
                </details>
              </div>
            ) : null;
          })}
        </article>
      ))}
      <article className="result-card">
        <h3>Crops you considered</h3>
        {sequence.consideredChoices.length ? (
          <ul>
            {sequence.consideredChoices.map((choice) => (
              <li key={choice.cropId}>
                <strong>{name(choice.cropId)}</strong>:{" "}
                {readable(choice.status)} · {choice.pairIds.length} two-crop
                pairs assessed.
              </li>
            ))}
          </ul>
        ) : (
          <p>
            You asked the engine to suggest options. Every catalog pair was
            checked against the same evidence rules.
          </p>
        )}
      </article>
      <article className="result-card">
        <h3>All crop pairs and rejected reasons</h3>
        <p>
          {sequence.counts.pairs} pairs examined; {sequence.counts.schedules}{" "}
          dated schedules generated.
        </p>
        {sequence.pairs.map((pair) => (
          <details key={pair.id}>
            <summary>
              {name(pair.firstCropId)} → {name(pair.secondCropId)} ·{" "}
              {readable(pair.status)} · {pair.schedules.length} schedules
            </summary>
            <Reasons items={pair.reasons} catalog={catalog} />
            {pair.schedules.map((schedule) => (
              <details key={schedule.id}>
                <summary>
                  Schedule {schedule.first.sownOn} → {schedule.second.sownOn} ·{" "}
                  {readable(schedule.status)}
                </summary>
                <Timeline schedule={schedule} catalog={catalog} />
                <Reasons items={schedule.reasons} catalog={catalog} />
              </details>
            ))}
          </details>
        ))}
      </article>
      <article className="result-card">
        <h3>Evidence and limits</h3>
        <p>
          Weather: {processing.weather.replaceAll("_", " ")}. Ranking:{" "}
          {processing.ranking.replaceAll("_", " ")}. Irrigation adequacy:
          unknown. Agronomic validation: pending.
        </p>
        <p>
          {assessment.evidence.length} weather snapshots. Historical differences
          describe past periods, not a forecast.
        </p>
        {assessment.evidence.length > 0 && (
          <details>
            <summary>Weather evidence identities</summary>
            <ul>
              {assessment.evidence.map((e) => (
                <li key={e.snapshotId}>
                  {e.snapshotId} · {e.sources.join(", ")} · retrieved{" "}
                  {e.retrievedAt}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p>
          Full comparison method: {plan.versions.rankingVersion}; selection{" "}
          {plan.result.selectionVersion}. Source catalog checksum:{" "}
          {plan.intakeEvidence.catalogSha256}.
        </p>
      </article>
    </section>
  );
}
