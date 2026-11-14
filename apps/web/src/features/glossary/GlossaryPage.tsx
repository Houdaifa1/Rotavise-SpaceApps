import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import type { GlossaryGroup } from "@rotavise/contracts";
import { useMessages, type MessageKey } from "../../i18n/messages.js";
import { Button, TextField } from "../../design/primitives/controls.js";
import { useGlossaryQuery } from "../../app/providers/Runtime.js";
import { failureText } from "../../api/errors.js";
import { Entry, Provenance, GlossaryTerm } from "./GlossaryTerm.js";
import { RetryButton } from "../../shared/RetryButton.js";

const groups: GlossaryGroup[] = [
  "term",
  "reason_code",
  "strategy_note",
  "effect",
  "status",
  "evidence",
  "score",
  "error",
  "role",
];
export function Component() {
  const query = useGlossaryQuery();
  const { language, t } = useMessages();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<GlossaryGroup>("term");
  const [page, setPage] = useState(0);
  const [moreGroups, setMoreGroups] = useState(false);
  useEffect(() => {
    let code: string;
    try {
      code = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    if (!code || !query.data) return;
    const entry = query.data.entries.find((entry) => entry.code === code);
    if (entry) {
      setGroup(entry.group);
      setSearch("");
      setPage(
        Math.floor(
          query.data.entries
            .filter((e) => e.group === entry.group)
            .indexOf(entry) / 7,
        ),
      );
      requestAnimationFrame(() =>
        document.getElementById(`term-${entry.code}`)?.focus(),
      );
    }
  }, [location.hash, query.data]);
  const term = search.trim().toLocaleLowerCase(language);
  const entries =
    query.data?.entries.filter(
      (entry) =>
        entry.group === group &&
        `${entry.term} ${entry.meaning} ${entry.code}`
          .toLocaleLowerCase(language)
          .includes(term),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(entries.length / 7));
  return (
    <section className="f1-page f1-glossary">
      <h1>{t("glossary.title")}</h1>
      <TextField
        label={t("glossary.search")}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />
      <div
        className="f1-group-controls"
        role="group"
        aria-label={t("glossary.groups")}
      >
        {(moreGroups ? groups.slice(6) : groups.slice(0, 6)).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={group === value}
            onClick={() => {
              setGroup(value);
              setPage(0);
            }}
          >
            {t(`glossary.${value}` as MessageKey)}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={moreGroups}
          onClick={() => setMoreGroups(!moreGroups)}
        >
          {t(moreGroups ? "common.previous" : "common.more")}
        </button>
      </div>
      {query.isPending ? (
        <p role="status">{t("loading")}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{failureText(query.error, language)}</p>
          <RetryButton error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          {query.data && <Provenance glossary={query.data} />}
          {entries.length ? (
            <div className="f1-entries">
              {entries.slice(page * 7, page * 7 + 7).map((entry) => (
                <article
                  key={`${entry.group}-${entry.code}`}
                  id={`term-${entry.code}`}
                  data-code
                  tabIndex={-1}
                >
                  <Entry entry={entry} />
                  <GlossaryTerm code={entry.code} group={entry.group} />
                </article>
              ))}
            </div>
          ) : (
            <p>{t("glossary.noResults")}</p>
          )}
          <div className="f1-pagination">
            <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
              {t("common.previous")}
            </Button>
            <span>{t("glossary.page", { page: page + 1, pages })}</span>
            <Button
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
