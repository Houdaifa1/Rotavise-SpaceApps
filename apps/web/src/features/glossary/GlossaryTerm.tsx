import { Link } from "react-router";
import type {
  GlossaryEntry,
  GlossaryGroup,
  GlossaryResponse,
} from "@rotavise/contracts";
import { Popover } from "../../design/primitives/feedback.js";
import { useMessages } from "../../i18n/messages.js";
import { findTerm } from "../../shared/glossaryText.js";
import { useGlossaryQuery } from "../../app/providers/Runtime.js";

export function Provenance({ glossary }: { glossary: GlossaryResponse }) {
  const { t } = useMessages();
  return (
    <p className="f1-caption">
      {t(
        glossary.provenance.text === "human_reviewed"
          ? "glossary.reviewed"
          : "glossary.provenance",
      )}{" "}
      <span>{glossary.provenance.note}</span>
    </p>
  );
}
export function Entry({ entry }: { entry: GlossaryEntry }) {
  return (
    <>
      <h2>{entry.term}</h2>
      <p>{entry.meaning}</p>
      <code data-code>{entry.code}</code>
      {entry.evidence && (
        <ul className="f1-citations">
          {entry.evidence.citations.map((citation, index) => (
            <li key={index}>
              <a href={citation.url} target="_blank" rel="noopener noreferrer">
                {citation.title}
              </a>
              <span>{citation.quote}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
export function GlossaryTerm({
  code,
  group = "term",
  label,
}: {
  code: string;
  group?: GlossaryGroup;
  label?: string;
}) {
  const query = useGlossaryQuery();
  const { t } = useMessages();
  const entry = findTerm(query.data, code, group);
  const title = label ?? entry?.term ?? t("glossary.detailsUnavailable");
  return (
    <Popover
      title={title}
      trigger={
        <button type="button" className="rv-term">
          {title}
        </button>
      }
    >
      {entry ? (
        <Entry entry={entry} />
      ) : (
        <p>{t("glossary.detailsUnavailable")}</p>
      )}
      {query.data && <Provenance glossary={query.data} />}
      <Link data-code to={`/glossary#${encodeURIComponent(code)}`}>
        {t("glossary.seeAll")}
      </Link>
    </Popover>
  );
}
