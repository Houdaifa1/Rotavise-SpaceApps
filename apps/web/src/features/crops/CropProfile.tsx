import type { CropDetail } from "@rotavise/contracts";
import { useBoot } from "../../app/providers/Runtime.js";
import { findTerm } from "../../shared/glossaryText.js";
import { CropName } from "../../design/primitives/crops.js";
import { Chip } from "../../design/primitives/feedback.js";
import { useMessages } from "../../i18n/messages.js";
import { monthDay, number } from "../../i18n/format.js";
import { ShortList } from "../../shared/ShortList.js";
import { useCropNameMode } from "../../shared/cropNamePreference.js";

type Citations = {
  sourceId: string;
  locator: string;
  quote?: string | undefined;
  note?: string;
  page?: number | null | undefined;
}[];
function Sources({
  citations,
  sources,
}: {
  citations: Citations;
  sources: CropDetail["sources"];
}) {
  const { t } = useMessages();
  if (!citations.length) return null;
  return (
    <details>
      <summary>{t("crops.sources")}</summary>
      <ShortList
        items={citations}
        render={(citation) => {
          const source = sources.find(({ id }) => id === citation.sourceId);
          return (
            <>
              {source && (
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title} · {source.publisher}
                </a>
              )}
              <p>{citation.locator}</p>
              {citation.quote && <blockquote>{citation.quote}</blockquote>}
              {citation.note && <p>{citation.note}</p>}
            </>
          );
        }}
      />
    </details>
  );
}
function Evidence({
  status,
}: {
  status: "sourced" | "model_recall" | "not_applicable" | "no_data";
}) {
  const { t } = useMessages();
  return (
    <Chip
      kind={status === "model_recall" ? "caution" : "neutral"}
      text={t(`crops.evidence.${status}`)}
      icon={status === "model_recall" ? "warning" : "source"}
    />
  );
}
function Rule({
  item,
  crop,
}: {
  item: CropDetail["calendar"]["plantingWindows"][number];
  crop: CropDetail;
}) {
  const { t, language } = useMessages();
  const { rule } = item;
  const n = (value: number) => number(value, language);
  let value = "";
  switch (rule.metric) {
    case "planting_window":
      value = t("f4.range", {
        start: monthDay(rule.start, language),
        end: monthDay(rule.end, language),
      });
      break;
    case "cycle_duration":
      value = t("crops.dayRange", {
        start: n("minDays" in rule ? rule.minDays : rule.min),
        end: n("maxDays" in rule ? rule.maxDays : rule.max),
      });
      break;
    case "preferred_predecessor_family":
    case "prohibited_predecessor_family":
      value = rule.family;
      break;
    case "minimum_return_interval":
      value = t("crops.years", {
        count: "years" in rule ? rule.years : rule.minimumYears,
      });
      break;
    case "crop_health_break":
      value = t("crops.days", { count: rule.minimumBreakDays });
      break;
    default:
      return null;
  }
  return (
    <>
      <p>
        <strong>{t(`crops.rule.${rule.metric}`)}</strong> · {value}
      </p>
      <p>{rule.conditions}</p>
      <Evidence status={item.evidence} />
      <Sources citations={rule.citations} sources={crop.sources} />
    </>
  );
}
export function CropProfile({ crop }: { crop: CropDetail }) {
  const { t, language } = useMessages();
  const [nameMode] = useCropNameMode();
  const { glossary } = useBoot();
  const research = crop.research;
  const records = research?.benefits.records ?? [];
  const findings = research?.benefits.findings ?? [];
  const byFinding = new Map(
    [...findings, ...records].map((finding) => [finding.id, finding]),
  );
  const role = research?.roleExplanations.find(
    (response) => response.language === language,
  );
  const rules = [
    ...crop.calendar.plantingWindows,
    ...crop.calendar.durationRanges,
    ...crop.rotationRules.predecessorFamilies,
    ...crop.rotationRules.returnIntervals,
    ...crop.rotationRules.healthBreaks,
  ];
  const facts = [...crop.benefits, ...crop.facts];
  return (
    <>
      <header>
        <h2>
          <CropName
            cropId={crop.cropId}
            crop={{
              id: crop.cropId,
              name: crop.identity.name,
              localNames: crop.identity.names,
            }}
            nameMode={nameMode}
          />
        </h2>
        <p>
          <i>{crop.identity.scientificName}</i> · {crop.identity.family}
          {crop.modelType && ` · ${t(`crops.type.${crop.modelType}`)}`}
        </p>
        <Evidence status={crop.identity.evidence} />
        <Sources citations={crop.identity.citations} sources={crop.sources} />
      </header>
      <details open>
        <summary>{t("crops.effects")}</summary>
        <ShortList
          items={research?.benefitEffects ?? []}
          render={(effect) => {
            const related = effect.findingIds.flatMap((id) => {
              const finding = byFinding.get(id);
              return finding ? [finding] : [];
            });
            const gaps =
              research?.benefits.gaps.filter(
                (gap) => gap.category === effect.category,
              ) ?? [];
            return (
              <>
                <h3>{t(`crops.effect.${effect.category}`)}</h3>
                <Evidence status={effect.status} />
                {effect.confidence && (
                  <p>{t(`crops.confidence.${effect.confidence}`)}</p>
                )}
                {!!related.length && (
                  <details>
                    <summary>{t("crops.findings")}</summary>
                    <ShortList
                      items={related}
                      render={(record) => {
                        const magnitude =
                          "status" in record ? record.magnitude : undefined;
                        return (
                          <>
                            <p>{record.effect}</p>
                            <p>{record.region}</p>
                            {record.nonLocal && <p>{t("crops.nonLocal")}</p>}
                            {magnitude && (
                              <p>
                                {t("crops.magnitude", {
                                  value:
                                    "value" in magnitude
                                      ? magnitude.value
                                      : t("f4.range", {
                                          start: number(
                                            magnitude.min,
                                            language,
                                          ),
                                          end: number(magnitude.max, language),
                                        }),
                                  unit: magnitude.unit,
                                })}
                              </p>
                            )}
                            {"reason" in record && <p>{record.reason}</p>}
                            {!!record.conditions.length && (
                              <ShortList
                                items={record.conditions}
                                render={(condition) => condition}
                              />
                            )}
                            <Sources
                              citations={record.citations}
                              sources={crop.sources}
                            />
                          </>
                        );
                      }}
                    />
                  </details>
                )}
                {!!gaps.length && (
                  <ShortList items={gaps} render={(gap) => gap.reason} />
                )}
              </>
            );
          }}
        />
      </details>
      {role && (
        <details>
          <summary>{t("crops.roles")}</summary>
          <ShortList
            items={role.entries}
            render={(entry) => (
              <>
                <h3>{entry.term}</h3>
                <p>{entry.meaning}</p>
                {entry.evidence && (
                  <ShortList
                    items={entry.evidence.citations}
                    render={(citation) => (
                      <>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.title}
                        </a>
                        <p>{citation.locator}</p>
                        <blockquote>{citation.quote}</blockquote>
                      </>
                    )}
                  />
                )}
              </>
            )}
          />
          <p>{role.provenance.note}</p>
        </details>
      )}
      <details>
        <summary>{t("crops.calendarRules")}</summary>
        <ShortList
          items={rules}
          render={(item) => <Rule item={item} crop={crop} />}
        />
      </details>
      <details>
        <summary>{t("crops.issues")}</summary>
        <ShortList
          items={crop.issues}
          render={(issue) => (
            <>
              <CropName
                cropId={issue.issue_id}
                crop={{
                  id: issue.issue_id,
                  name: issue.name,
                  localNames: issue.names,
                }}
                nameMode={nameMode}
              />
              {issue.visibleSymptoms && <p>{issue.visibleSymptoms}</p>}
              <Evidence status={issue.evidence} />
              <Sources citations={issue.citations} sources={crop.sources} />
            </>
          )}
        />
      </details>
      <details>
        <summary>{t("crops.varieties")}</summary>
        <ShortList
          items={crop.cultivars}
          render={(variety) => (
            <>
              <CropName
                cropId={variety.id}
                crop={{
                  id: variety.id,
                  name: variety.name,
                  localNames: variety.names,
                }}
                nameMode={nameMode}
              />
              {variety.notes && <p>{variety.notes}</p>}
              <Evidence status={variety.evidence} />
              <Sources citations={variety.citations} sources={crop.sources} />
            </>
          )}
        />
      </details>
      <details>
        <summary>{t("crops.otherFacts")}</summary>
        <ShortList
          items={facts}
          render={(fact) => (
            <>
              <p>{fact.summary}</p>
              <Evidence status={fact.evidence} />
              <Sources citations={fact.citations} sources={crop.sources} />
            </>
          )}
        />
      </details>
      <details>
        <summary>{t("crops.gaps")}</summary>
        <ShortList items={crop.limitations} render={(reason) => reason} />
        {!!crop.gaps.length && (
          <ShortList
            items={crop.gaps}
            render={(gap) => (
              <>
                <strong>
                  {findTerm(glossary.data, gap.code, "reason_code")?.term ??
                    t("crops.gap")}
                </strong>
                <p>{gap.reason.replace(/\bnull\b/gi, "an unrecorded value")}</p>
              </>
            )}
          />
        )}
      </details>
      <p>{t("crops.release", { version: crop.catalogVersion })}</p>
    </>
  );
}
