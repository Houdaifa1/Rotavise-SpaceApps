import {
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router";
import { useOffline } from "../../../app/providers/Runtime.js";
import {
  Button,
  IconButton,
  Tabs,
} from "../../../design/primitives/controls.js";
import {
  Popover,
  ReminderBar,
  Skeleton,
} from "../../../design/primitives/feedback.js";
import { useMessages, type MessageKey } from "../../../i18n/messages.js";
import { number, quantity } from "../../../i18n/format.js";
import type { MapRenderer } from "../../map/mapRenderer.js";
import type { MappedField, PlanSummary } from "../useFieldWorkspace.js";
import { useHistory } from "./fieldData.js";
import { PlanState } from "./PlanState.js";
import "./field-detail.css";

const Rename = lazy(() =>
  import("./FieldActions.js").then(({ Rename }) => ({ default: Rename })),
);
const DeleteField = lazy(() =>
  import("./FieldActions.js").then(({ DeleteField }) => ({
    default: DeleteField,
  })),
);
const History = lazy(() =>
  import("./History.js").then(({ History }) => ({ default: History })),
);
const Inputs = lazy(() =>
  import("./Inputs.js").then(({ Inputs }) => ({ default: Inputs })),
);
const Nasa = lazy(() =>
  import("./Nasa.js").then(({ Nasa }) => ({ default: Nasa })),
);
const FieldPlans = lazy(() =>
  import("./FieldPlans.js").then(({ FieldPlans }) => ({ default: FieldPlans })),
);
const Outline = lazy(() => import("./Outline.js"));
const tabs = ["status", "history", "inputs", "nasa", "plans"] as const;
type Tab = (typeof tabs)[number];
export default function FieldDetail({
  entry,
  plan,
  children,
  onClose,
  headingRef,
  phone,
  renderer,
}: {
  entry: MappedField | undefined;
  plan: PlanSummary | undefined;
  children?: ReactNode;
  onClose: () => void;
  headingRef: Ref<HTMLHeadingElement>;
  phone: boolean;
  renderer: MapRenderer | undefined;
}) {
  const { t, language } = useMessages();
  const heading = useId();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const historyRoute = !!useMatch("/fields/:id/history");
  const id = entry?.field.id;
  const tab = historyRoute
    ? "history"
    : (tabs.find((item) => item === params.get("tab")) ?? "status");
  const editingOutline = params.get("edit") === "outline";
  const offline = useOffline();
  const actions = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState<"name" | "delete">();
  const [menu, setMenu] = useState(false);
  const open = (next: "name" | "delete") => {
    setMenu(false);
    setEdit(next);
  };
  const restore = () =>
    actions.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const close = () => {
    setEdit(undefined);
    requestAnimationFrame(restore);
  };
  const { latitude, longitude } = entry?.field.profile.location ?? {};
  const coords =
    latitude !== undefined && longitude !== undefined
      ? t("f4.coords", {
          latitude: number(Math.abs(latitude), language, 2),
          longitude: number(Math.abs(longitude), language, 2),
          northSouth: t(latitude >= 0 ? "f4.north" : "f4.south"),
          eastWest: t(longitude >= 0 ? "f4.east" : "f4.west"),
        })
      : undefined;
  function go(next: Tab) {
    if (!id || (next === tab && !editingOutline)) return;
    if (historyRoute) void navigate(`/fields/${id}?tab=${next}`);
    else setParams({ tab: next });
  }
  return (
    <aside
      className="f2-panel f2-field-detail f4-detail"
      aria-labelledby={heading}
    >
      <header className="f2-panel-heading">
        <div>
          <h2 id={heading} tabIndex={-1} ref={headingRef}>
            {entry?.field.profile.name ?? t("progress.field")}
          </h2>
          {entry && edit === "name" && (
            <Suspense fallback={<Skeleton shape="row" />}>
              <Rename
                field={entry.field}
                onClose={close}
                restoreFocus={restore}
              />
            </Suspense>
          )}
          {entry && (
            <p>
              {entry.boundary
                ? t("field.areaValue", {
                    area: quantity(entry.boundary.hectares, "ha", language),
                  })
                : entry.boundary === null
                  ? t("field.noOutline")
                  : null}
              {entry.boundary !== undefined && coords && " · "}
              {coords}
            </p>
          )}
        </div>
        <div className="f4-header-actions" ref={actions}>
          {entry && !editingOutline && (
            <>
              <IconButton
                icon="edit"
                label={t("f4.rename")}
                variant="ghost"
                disabled={offline}
                onClick={() => open("name")}
              />
              <Popover
                title={t("f4.fieldActions")}
                open={menu}
                onOpenChange={setMenu}
                trigger={
                  <Button
                    variant="ghost"
                    size="small"
                    aria-label={t("f4.fieldActions")}
                    disabled={offline}
                  >
                    ···
                  </Button>
                }
              >
                <div className="f4-menu">
                  <Button variant="ghost" onClick={() => open("name")}>
                    {t("f4.rename")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={entry.boundary === undefined}
                    onClick={() => {
                      setMenu(false);
                      setParams({ tab, edit: "outline" });
                    }}
                  >
                    {t(entry.boundary ? "f4.editOutline" : "f4.addOutline")}
                  </Button>
                  <Button variant="ghost" onClick={() => open("delete")}>
                    {t("f4.deleteField")}
                  </Button>
                </div>
              </Popover>
            </>
          )}
          {!phone && (
            <IconButton
              icon="close"
              label={t("field.closeDetail")}
              variant="ghost"
              onClick={onClose}
            />
          )}
        </div>
      </header>
      <div
        className="f2-panel-body"
        tabIndex={0}
        aria-label={t("progress.field")}
      >
        {children}
        {entry &&
          (editingOutline ? (
            <Suspense fallback={<Skeleton shape="row" />}>
              <Outline
                entry={entry}
                renderer={renderer}
                onClose={() => {
                  setParams({ tab }, { replace: true });
                  requestAnimationFrame(restore);
                }}
              />
            </Suspense>
          ) : (
            <Tabs
              label={t("progress.field")}
              value={tab}
              onChange={(next) => go(next as Tab)}
              items={tabs.map((value) => ({
                value,
                label: t(`f4.${value}`),
                content:
                  value !== tab ? null : (
                    <Suspense fallback={<Skeleton shape="row" />}>
                      {
                        {
                          status: (
                            <Status
                              entry={entry}
                              plan={plan}
                              go={go}
                              addOutline={() =>
                                setParams({ tab, edit: "outline" })
                              }
                            />
                          ),
                          history: <History id={entry.field.id} />,
                          inputs: <Inputs field={entry.field} />,
                          nasa: (
                            <Nasa
                              id={entry.field.id}
                              outline={
                                entry.boundary === undefined
                                  ? undefined
                                  : !!entry.boundary
                              }
                              evidence
                            />
                          ),
                          plans: <FieldPlans id={entry.field.id} />,
                        }[value]
                      }
                    </Suspense>
                  ),
              }))}
            />
          ))}
      </div>
      {!phone && <ReminderBar text={t("shell.reminder")} />}
      {entry && edit === "delete" && (
        <Suspense fallback={<Skeleton shape="row" />}>
          <DeleteField
            entry={entry}
            onCancel={close}
            onDelete={onClose}
            restoreFocus={restore}
          />
        </Suspense>
      )}
    </aside>
  );
}
function Status({
  entry,
  plan,
  go,
  addOutline,
}: {
  entry: MappedField;
  plan: PlanSummary | undefined;
  go: (tab: Tab) => void;
  addOutline: () => void;
}) {
  const { t } = useMessages();
  const offline = useOffline();
  const navigate = useNavigate();
  const history = useHistory(entry.field.id);
  const gaps: [MessageKey, Tab][] = [];
  if (history.data?.length === 0) gaps.push(["f4.noHistory", "history"]);
  if (entry.field.profile.soil.status === "unknown")
    gaps.push(["f4.noSoil", "inputs"]);
  return (
    <div className="f4-stack f4-status">
      <section className="f4-stack f4-status-intro">
        <Button
          size="small"
          variant="primary"
          disabled={offline}
          onClick={() => void navigate(`/fields/${entry.field.id}/plan/new`)}
        >
          {t("f4.compare")}
        </Button>
        {(gaps.length > 0 || entry.boundary === null) && (
          <ul>
            {gaps.map(([label, destination]) => (
              <li key={destination}>
                <button
                  type="button"
                  className="f4-inline-link"
                  onClick={() => go(destination)}
                >
                  {t(label)}
                </button>
              </li>
            ))}
            {entry.boundary === null && (
              <li>
                <button
                  type="button"
                  className="f4-inline-link"
                  disabled={offline}
                  onClick={addOutline}
                >
                  {t("f4.addOutline")}
                </button>
              </li>
            )}
          </ul>
        )}
        {plan && (
          <button
            type="button"
            className="f4-inline-link"
            onClick={() => go("plans")}
          >
            {t("field.latestPlan")} <PlanState plan={plan} />
          </button>
        )}
        {offline && <p>{t("f4.offline")}</p>}
      </section>
      <Suspense fallback={<Skeleton shape="row" />}>
        <Nasa
          id={entry.field.id}
          outline={entry.boundary === undefined ? undefined : !!entry.boundary}
          evidence={false}
        />
      </Suspense>
    </div>
  );
}
