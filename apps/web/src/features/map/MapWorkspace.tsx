import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useMatch, useNavigate } from "react-router";
import { fieldIdParamsSchema } from "@rotavise/contracts";
import {
  AddField,
  DataError,
  FieldList,
  rowsPerPage,
  useFieldWorkspace,
  type FieldSort,
} from "../fields/index.js";
import { useMessages } from "../../i18n/messages.js";
import { Button, IconButton } from "../../design/primitives/controls.js";
import { ReminderBar, Skeleton } from "../../design/primitives/feedback.js";
import { ApiFailure } from "../../app/http.js";
import { MapView } from "./MapView.js";
import "./map.css";
import type { MapRenderer } from "./mapRenderer.js";
const FieldDetail = lazy(() => import("../fields/detail/FieldDetail.js"));
const FieldCreation = lazy(() =>
  import("../fields/creation/FieldCreation.js").then((m) => ({
    default: m.FieldCreation,
  })),
);

const PhoneSheet = lazy(() =>
  import("../../app/PhoneSheet.js").then(({ PhoneSheet }) => ({
    default: PhoneSheet,
  })),
);
const phoneQuery = "(max-width: 767px)";

export function Component() {
  const creating = !!useMatch("/fields/new");
  const fieldMatch = useMatch("/fields/:id");
  const historyMatch = useMatch("/fields/:id/history");
  const match = fieldMatch ?? historyMatch;
  const parsed =
    !creating &&
    match &&
    fieldIdParamsSchema.safeParse({ id: match.params.id });
  if (parsed && !parsed.success) return <InvalidField />;
  return (
    <MapWorkspace
      id={parsed ? parsed.data?.id : undefined}
      creating={creating}
    />
  );
}

function InvalidField() {
  const { t } = useMessages();
  const navigate = useNavigate();
  return (
    <section className="f1-page">
      <h1>{t("error.notFound")}</h1>
      <p>{t("error.notFoundText")}</p>
      <Button onClick={() => void navigate("/map")}>{t("common.back")}</Button>
      <ReminderBar text={t("shell.reminder")} />
    </section>
  );
}

function MapWorkspace({
  id,
  creating,
}: {
  id: string | undefined;
  creating: boolean;
}) {
  const [renderer, setRenderer] = useState<MapRenderer>();
  const { language, t } = useMessages();
  const { search: routeSearch, key: routeKey } = useLocation();
  const navigate = useNavigate();
  const data = useFieldWorkspace(id);
  const [phone, setPhone] = useState(() => matchMedia(phoneQuery).matches);
  const [listOpen, setListOpen] = useState(true);
  const [initialDetent, setInitialDetent] = useState<"peek" | "half">(() =>
    routeSearch.includes("panel=fields") ? "half" : "peek",
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<FieldSort>("recent");
  const [page, setPage] = useState(0);
  const [sheetVersion, setSheetVersion] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailIdentity = useRef(id);
  detailIdentity.current = id;
  const focusedDetail = useRef<string | undefined>(undefined);
  const connectDetail = useCallback((node: HTMLHeadingElement | null) => {
    detailHeading.current = node;
    // A responsive reparent must not steal focus from an open map control.
    // Focus a newly selected field once, even if its data mounts asynchronously.
    if (
      node &&
      detailIdentity.current &&
      focusedDetail.current !== detailIdentity.current
    ) {
      focusedDetail.current = detailIdentity.current;
      const active = document.activeElement;
      requestAnimationFrame(() => {
        if (
          node.isConnected &&
          (document.activeElement === active ||
            document.activeElement === document.body)
        )
          node.focus({ preventScroll: true });
      });
    }
  }, []);
  const previousFocus = useRef<HTMLElement | null>(null);
  const focusSearch = useRef(false);
  const prevId = useRef(id);

  useEffect(() => {
    const query = matchMedia(phoneQuery);
    const resize = () => setPhone(query.matches);
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!id) {
      setListOpen(true);
      setInitialDetent(routeSearch.includes("panel=fields") ? "half" : "peek");
      setSheetVersion((value) => value + 1);
    }
  }, [routeKey, routeSearch, id]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (prevId.current && !id) {
        focusedDetail.current = undefined;
        const target = previousFocus.current?.isConnected
          ? previousFocus.current
          : document.querySelector<HTMLElement>(".f2-search-chip");
        target?.focus({ preventScroll: true });
      }
      prevId.current = id;
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);
  const connectSearch = (node: HTMLInputElement | null) => {
    searchInput.current = node;
    if (node && focusSearch.current) {
      requestAnimationFrame(() => node.focus({ preventScroll: true }));
      focusSearch.current = false;
    }
  };
  function searchFields() {
    focusSearch.current = true;
    setListOpen(true);
    if (phone) {
      setInitialDetent("half");
      setSheetVersion((value) => value + 1);
    }
    if (id && (phone || matchMedia("(max-width: 1023px)").matches))
      void navigate("/map?panel=fields");
    else if (!phone && searchInput.current) {
      focusSearch.current = false;
      searchInput.current.focus({ preventScroll: true });
    }
  }
  function selectField(next: string) {
    if (next === id) {
      detailHeading.current?.focus();
      return;
    }
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void navigate(`/fields/${next}`);
  }
  function closeDetail() {
    void navigate("/map");
  }
  function closeList() {
    setListOpen(false);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".f2-search-chip")?.focus(),
    );
  }
  useEffect(() => {
    if (phone || !id) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector(".rv-dialog[data-state=open]")
      )
        closeDetail();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [phone, id, navigate]);

  const collator = new Intl.Collator(language, {
    sensitivity: "base",
    numeric: true,
  });
  const matches = data.listed
    .filter(({ field }) =>
      field.profile.name
        .toLocaleLowerCase(language)
        .includes(search.trim().toLocaleLowerCase(language)),
    )
    .sort((a, b) =>
      sort === "name"
        ? collator.compare(a.field.profile.name, b.field.profile.name)
        : sort === "area"
          ? (b.boundary?.hectares ?? -1) - (a.boundary?.hectares ?? -1)
          : b.field.updatedAt.localeCompare(a.field.updatedAt),
    );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / rowsPerPage) - 1),
  );
  const hasNext = (currentPage + 1) * rowsPerPage < matches.length;
  const empty = !!data.fields.data && !data.listed.length;
  const pageError = data.fields.error;
  const notFound =
    data.detail.error instanceof ApiFailure && data.detail.error.status === 404;
  const list = (
    <FieldList
      rows={matches.slice(
        currentPage * rowsPerPage,
        (currentPage + 1) * rowsPerPage,
      )}
      plans={data.plans.data}
      selected={id}
      onSelect={selectField}
      onHide={closeList}
      searchRef={connectSearch}
      search={search}
      onSearch={(value) => {
        setSearch(value);
        setPage(0);
      }}
      sort={sort}
      onSort={(value) => {
        setSort(value);
        setPage(0);
      }}
      offline={data.offline}
      unavailable={data.unavailable}
      waiting={data.fields.isPending && data.fields.isFetching}
      blank={empty && !pageError}
      reminder={!phone}
      problem={
        !data.offline && (
          <>
            {pageError && (
              <DataError
                error={pageError}
                retry={() =>
                  void (data.fields.isFetchNextPageError
                    ? data.fields.fetchNextPage()
                    : data.fields.refetch())
                }
                busy={data.fields.isFetching}
              />
            )}
            {data.outlines.error && (
              <DataError
                error={data.outlines.error}
                retry={data.outlines.retry}
                busy={data.outlines.pending}
              />
            )}
            {data.plans.error && (
              <DataError
                error={data.plans.error}
                retry={() => void data.plans.refetch()}
                busy={data.plans.isFetching}
              />
            )}
          </>
        )
      }
      footer={
        <div className="f2-list-pagination">
          {currentPage > 0 && (
            <IconButton
              icon="chevron-left"
              label={t("previous")}
              onClick={() => setPage(currentPage - 1)}
            />
          )}
          {hasNext && (
            <IconButton
              icon="chevron-right"
              label={t("more")}
              onClick={() => setPage(currentPage + 1)}
            />
          )}
          {data.fields.hasNextPage &&
            !hasNext &&
            !data.offline &&
            !data.fields.isFetchNextPageError && (
              <Button
                size="small"
                loading={data.fields.isFetchingNextPage}
                onClick={async () => {
                  const result = await data.fields.fetchNextPage();
                  if (result.data && !result.isError && !search)
                    setPage(currentPage + 1);
                }}
              >
                {t("field.loadMore")}
              </Button>
            )}
        </div>
      }
    />
  );
  const detail = id && (
    <Suspense
      fallback={
        <aside className="f2-panel f2-field-detail">
          <Skeleton shape="row" />
        </aside>
      }
    >
      <FieldDetail
        key={id}
        renderer={renderer}
        entry={notFound ? undefined : data.selected}
        plan={data.plans.data?.[id]}
        onClose={closeDetail}
        headingRef={connectDetail}
        phone={phone}
      >
        {data.unavailable && <p>{t("capability.plansOff")}</p>}
        {data.offline && (
          <p>
            {t(data.selected ? "field.offlineCached" : "field.offlineEmpty")}
          </p>
        )}
        {notFound && <p role="status">{t("field.notFound")}</p>}
        {!data.offline && !notFound && data.detail.error && (
          <DataError
            error={data.detail.error}
            retry={() => void data.detail.refetch()}
            busy={data.detail.isFetching}
          />
        )}
        {!data.offline && data.selected && data.outlines.error && (
          <DataError
            error={data.outlines.error}
            retry={data.outlines.retry}
            busy={data.outlines.pending}
          />
        )}
        {data.detail.isFetching && !data.selected && <Skeleton shape="row" />}
      </FieldDetail>
    </Suspense>
  );
  const map = (
    <MapView
      fields={data.mapped}
      selected={data.selected}
      onSelect={
        new URLSearchParams(routeSearch).get("edit") === "outline"
          ? () => {}
          : selectField
      }
      onSearch={searchFields}
      onRenderer={setRenderer}
    />
  );
  return (
    <div className="f2-workspace" data-detail={!!id} data-creating={creating}>
      <h1 className="rv-sr">{t("nav.map")}</h1>
      {!creating && !phone && listOpen && list}
      {!creating && !phone && detail}
      {creating && (
        <Suspense
          fallback={
            <aside className="f2-panel">
              <Skeleton shape="row" />
            </aside>
          }
        >
          <FieldCreation
            renderer={renderer}
            onClose={closeDetail}
            phone={phone}
          />
        </Suspense>
      )}
      {map}
      {!creating && phone && (id || listOpen) && (
        <Suspense fallback={null}>
          <PhoneSheet
            key={id ?? sheetVersion}
            title={t(id ? "progress.field" : "field.mine")}
            initial={id ? "full" : initialDetent}
            embedded
            peekAction={
              !id && !data.offline && !data.unavailable ? (
                <AddField />
              ) : undefined
            }
            onClose={id ? closeDetail : closeList}
          >
            {id ? detail : list}
          </PhoneSheet>
        </Suspense>
      )}
      {!creating && phone && !id && !listOpen && (
        <Button
          className="f1-open-sheet f2-reopen-sheet"
          onClick={searchFields}
        >
          {t("shell.openPanel")}
        </Button>
      )}
    </div>
  );
}
