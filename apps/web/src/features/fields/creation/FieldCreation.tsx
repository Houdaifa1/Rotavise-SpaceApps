import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  boundaryHectares,
  fieldCreateRequestSchema,
  fieldWithHistoryRequestSchema,
  cropHistoryEntrySchema,
  type FieldBoundary,
  type FieldProfile,
  type CropHistoryEntry,
  type FieldSuggestion,
} from "@rotavise/contracts";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
  useToast,
  useDismissToast,
} from "../../../app/providers/Runtime.js";
import { ApiFailure } from "../../../app/http.js";
import { failureText } from "../../../api/errors.js";
import { createField, createFieldWithHistory } from "../../../api/fields.js";
import { getFieldBoundaryAt } from "../../../api/boundary.js";
import { keys } from "../../../api/keys.js";
import { useMessages, type MessageKey } from "../../../i18n/messages.js";
import { quantity } from "../../../i18n/format.js";
import {
  Button,
  IconButton,
  Select,
  TextField,
} from "../../../design/primitives/controls.js";
import { RetryButton } from "../../../shared/RetryButton.js";
import { Chip, ReminderBar } from "../../../design/primitives/feedback.js";
import type { MapRenderer } from "../../map/mapRenderer.js";
import { Thumbnail } from "../FieldPanels.js";
import type { attachEditor, Mode, EditorState } from "./mapEditor.js";
import { GeometryWorker } from "./workerClient.js";
import type { Point, Grid } from "./geometry.js";
import { useSuggestions } from "./useSuggestions.js";
import type { ImportedOutline } from "./importOutline.js";
import "./creation.css";
const PhoneSheet = lazy(() =>
  import("../../../app/PhoneSheet.js").then((m) => ({ default: m.PhoneSheet })),
);
const LastCrop = lazy(() =>
  import("./LastCrop.js").then((m) => ({ default: m.LastCrop })),
);
type Water =
  "unknown" | "rainfed" | "irrigation_limited" | "irrigation_available";
type Draft = {
  id: string;
  name: string;
  water: Water;
  boundary?: FieldBoundary;
  point?: Point;
  suggestion?: FieldSuggestion;
  filled?: boolean;
  narrow?: boolean;
  historyEnabled: boolean;
  history: Partial<CropHistoryEntry>;
  saved?: string;
};
type OutlineResult = {
  boundary: FieldBoundary;
  filled: boolean;
  narrow: boolean;
  cells?: string[];
};
type Draw = { vertices: Point[]; closed: boolean };
const modes: Mode[] = ["tap", "paint", "draw", "upload", "pin"];
const modeKey: Record<Mode, MessageKey> = {
  tap: "field.tap",
  paint: "field.paint",
  draw: "field.draw",
  upload: "field.upload",
  pin: "field.pin",
};
const issueKeys: Record<string, MessageKey> = {
  disconnected: "create.disconnected",
  hole: "create.hole",
  complex: "create.complex",
  invalid: "create.invalid",
  large: "create.large",
  area: "create.area",
  crossing: "create.crossing",
  worker: "create.worker",
};
export function FieldCreation({
  renderer,
  onClose,
  phone,
}: {
  phone: boolean;
  renderer: MapRenderer | undefined;
  onClose: () => void;
}) {
  const { t, language } = useMessages(),
    { capabilities, glossary } = useBoot(),
    client = useApi(),
    offline = useOffline(),
    session = useSession(),
    toast = useToast(),
    query = useQueryClient(),
    navigate = useNavigate();
  const dismissToast = useDismissToast();
  useEffect(dismissToast, [dismissToast]);
  const [params] = useSearchParams(),
    available = capabilities.data?.fieldBoundaries.available === true;
  const [mode, setMode] = useState<Mode>(() => {
    const p = params.get("mode") as Mode;
    return modes.includes(p) && (p !== "tap" || available)
      ? p
      : available
        ? "tap"
        : "paint";
  });
  const [rows, setRows] = useState<Draft[]>([]),
    [page, setPage] = useState(0),
    [draw, setDraw] = useState<Draw>({ vertices: [], closed: false }),
    [undo, setUndo] = useState<Draw[]>([]),
    [redo, setRedo] = useState<Draw[]>([]);
  const [snap, setSnap] = useState(available),
    [count, setCount] = useState(0),
    [zoom, setZoom] = useState(0),
    [issue, setIssue] = useState<string>(),
    [busy, setBusy] = useState(false),
    [processing, setProcessing] = useState(false),
    [error, setError] = useState<unknown>(),
    [uncertain, setUncertain] = useState(false),
    [wait, setWait] = useState(0);
  const [worker, setWorker] = useState<GeometryWorker>(),
    [merge, setMerge] = useState<string[]>([]);
  const [editor, setEditor] = useState<ReturnType<typeof attachEditor>>();
  const fileInput = useRef<HTMLInputElement>(null);
  const active = useRef("draft-0"),
    sequence = useRef(0),
    defaultNames = useRef(new Map<string, string>()),
    revision = useRef(0),
    live = useRef(true),
    request = useRef<AbortController | undefined>(undefined),
    drawCurrent = useRef(draw),
    inFlight = useRef(false);
  drawCurrent.current = draw;
  const suggestions = useSuggestions(
    renderer,
    available && (mode === "tap" || mode === "draw"),
  );
  const state: EditorState = {
    mode,
    boundaries: rows
      .filter((r) => r.id !== active.current || !draw.closed || mode !== "draw")
      .flatMap((r) => (r.boundary ? [r.boundary] : [])),
    pins: rows.flatMap((r) => (r.point ? [r.point] : [])),
    vertices: draw.vertices,
    closed: draw.closed,
    snap,
    suggestions: suggestions.fields,
    locked: busy || uncertain,
  };
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !busy) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, busy]);
  const current = useRef({ state, t, paint, changeDraw, point });
  current.current = { state, t, paint, changeDraw, point };
  useEffect(() => {
    live.current = true;
    const w = new GeometryWorker();
    setWorker(w);
    return () => {
      live.current = false;
      revision.current++;
      request.current?.abort();
      w.destroy();
    };
  }, []);
  useEffect(() => {
    if (!worker || !renderer) return;
    let cancelled = false,
      editor: ReturnType<typeof attachEditor> | undefined;
    void import("./mapEditor.js")
      .then(({ attachEditor }) => {
        if (cancelled) return;
        const e = attachEditor(renderer, worker, current.current.state, {
          onPoint: (p) => void current.current.point(p),
          onDraw: (v, c) => current.current.changeDraw(v, c),
          onCells: (c, g, finished) =>
            void current.current.paint(c, g, finished),
          onCount: setCount,
          onZoom: setZoom,
          onError: (e) => setIssue(e instanceof Error ? e.message : "invalid"),
          vertexLabel: (n) => current.current.t("create.vertex", { n }),
          midpointLabel: (n) => current.current.t("create.midpoint", { n }),
        });
        editor = e;
        setEditor(e);
      })
      .catch(() => {
        if (!cancelled) setIssue("worker");
      });
    return () => {
      cancelled = true;
      editor?.destroy();
      setEditor(undefined);
    };
  }, [renderer, worker]);
  useEffect(
    () => editor?.update(state),
    [
      editor,
      mode,
      rows,
      draw,
      snap,
      suggestions.fields,
      busy,
      uncertain,
      language,
    ],
  );
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  const issueText = issue ? t(issueKeys[issue] ?? "create.invalid") : undefined;
  const make = (id: string, values: Partial<Draft>): Draft => {
    let name = defaultNames.current.get(id);
    if (!name) {
      name = t("create.defaultName", { n: ++sequence.current });
      defaultNames.current.set(id, name);
    }
    return {
      id,
      name,
      water: "unknown",
      historyEnabled: false,
      history: { schema_version: "1" },
      ...values,
    };
  };

  function upsert(id: string, values: Partial<Draft>) {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === id);
      return exists
        ? prev.map((r) => (r.id === id ? { ...r, ...values } : r))
        : [...prev, make(id, values)];
    });
  }
  function patch(id: string, values: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...values } : r)));
  }
  function resetDraft() {
    revision.current++;
    active.current = `draft-${crypto.randomUUID()}`;
    setDraw({ vertices: [], closed: false });
    setUndo([]);
    setRedo([]);
    setCount(0);
    editor?.setCells([]);
    setIssue(undefined);
    setProcessing(false);
  }
  function choose(next: string) {
    resetDraft();
    setMode(next as Mode);
    setError(undefined);
  }
  function changeDraw(vertices: Point[], closed: boolean, remember = true) {
    if (remember) {
      setUndo((prev) => [...prev.slice(-49), drawCurrent.current]);
      setRedo([]);
    }
    const next = { vertices, closed };
    drawCurrent.current = next;
    setDraw(next);
    setIssue(undefined);
    const version = ++revision.current;
    if (!closed || vertices.length < 3) {
      setRows((prev) => prev.filter((r) => r.id !== active.current));
      setProcessing(false);
      return;
    }
    setProcessing(true);
    const id = active.current;
    void worker
      ?.run<OutlineResult>({
        kind: "normalize",
        polygon: { type: "Polygon", coordinates: [[...vertices, vertices[0]]] },
      })
      .then(
        (result) => {
          if (live.current && version === revision.current) {
            upsert(id, {
              boundary: result.boundary,
              filled: result.filled,
              narrow: result.narrow,
            });
          }
        },
        (e) => {
          if (live.current && version === revision.current) {
            setIssue(e.message);
            setRows((prev) => prev.filter((r) => r.id !== id));
          }
        },
      )
      .finally(() => {
        if (live.current && version === revision.current) setProcessing(false);
      });
  }
  async function paint(cells: string[], grid: Grid, finished = false) {
    const version = ++revision.current,
      id = active.current;
    setIssue(undefined);
    setProcessing(true);
    if (!cells.length) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setProcessing(false);
      return;
    }
    try {
      const result = await worker?.run<OutlineResult>({
        kind: "paint",
        cells,
        grid,
      });
      if (!result || !live.current || version !== revision.current) return;
      if (finished && result.cells) {
        editor?.setCells(result.cells);
        setCount(result.cells.length);
      }
      upsert(id, {
        boundary: result.boundary,
        filled: result.filled,
        narrow: result.narrow,
      });
    } catch (e) {
      if (live.current && version === revision.current) {
        setIssue(e instanceof Error ? e.message : "invalid");
        setRows((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      if (live.current && version === revision.current) setProcessing(false);
    }
  }
  async function point(p: Point) {
    if (busy || uncertain || inFlight.current) return;
    if (mode === "pin") {
      setRows((prev) => [...prev, make(crypto.randomUUID(), { point: p })]);
      return;
    }
    if (!available || offline || wait > 0) return;
    setIssue(undefined);
    inFlight.current = true;
    setProcessing(true);
    setError(undefined);
    request.current?.abort();
    request.current = new AbortController();
    const version = revision.current;
    try {
      const response = await getFieldBoundaryAt(client, {
        body: { longitude: p[0], latitude: p[1] },
        signal: request.current.signal,
      });
      if (!live.current || version !== revision.current) return;
      const f = response.field;
      const bounds = renderer?.nativeMap.getBounds();
      if (
        bounds &&
        f.geometry.coordinates[0].some((p) => !bounds.contains(p))
      ) {
        focusBoundary(f.geometry);
      }
      setRows((prev) => {
        const existing = prev.find(
          (r) => r.suggestion?.properties.id === f.properties.id,
        );
        return existing
          ? prev.filter((r) => r.id !== existing.id)
          : [
              ...prev,
              make(crypto.randomUUID(), {
                boundary: f.geometry,
                suggestion: f,
              }),
            ];
      });
    } catch (e) {
      if (live.current && version === revision.current) {
        if (e instanceof ApiFailure && e.code === "NO_FIELD_FOUND")
          setIssue("noField");
        else {
          setError(e);
          if (e instanceof ApiFailure) setWait(e.retryAfterSeconds ?? 0);
        }
      }
    } finally {
      inFlight.current = false;
      if (live.current && version === revision.current) setProcessing(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !worker) return;
    const version = ++revision.current;
    setIssue(undefined);
    setProcessing(true);
    try {
      if (file.size > 10000000) throw new Error("complex");
      const ext = file.name.split(".").at(-1)?.toLowerCase() ?? "";
      let results: ImportedOutline[];
      if (ext === "kml") {
        if (file.size > 1000000) throw new Error("complex");
        const text = await file.text();
        if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("invalid");
        const xml = new DOMParser().parseFromString(text, "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("invalid");
        const { kml } = await import("@tmcw/togeojson");
        results = await worker.run({ kind: "geojson", data: kml(xml) });
      } else
        results = await worker.run({
          kind: "import",
          buffer: await file.arrayBuffer(),
          extension: ext,
        });
      if (!live.current || version !== revision.current) return;
      const valid = results.filter((r) => r.boundary);
      setRows((prev) => [
        ...prev,
        ...valid.map((r) =>
          make(crypto.randomUUID(), {
            boundary: r.boundary!,
            filled: r.filled ?? false,
            narrow: r.narrow ?? false,
          }),
        ),
      ]);
      const errors = results.flatMap((r, i) =>
        r.issue ? [{ n: i + 1, issue: r.issue }] : [],
      );
      setImportErrors(errors);
      setPage(0);
      if (valid[0]?.boundary) focusBoundary(valid[0].boundary);
    } catch (e) {
      if (live.current && version === revision.current)
        setIssue(e instanceof Error ? e.message : "invalid");
    } finally {
      if (live.current && version === revision.current) setProcessing(false);
    }
  }
  const [importErrors, setImportErrors] = useState<
    { n: number; issue: string }[]
  >([]);
  function focusBoundary(boundary: FieldBoundary, maxZoom = 17) {
    const ring = boundary.coordinates[0],
      xs = ring.map((p) => p[0]),
      ys = ring.map((p) => p[1]);
    renderer?.nativeMap.fitBounds(
      [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      {
        padding: 60,
        maxZoom,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 380,
      },
    );
  }
  async function mergeRows() {
    if (!worker) return;
    setProcessing(true);
    try {
      const result = await worker.run<OutlineResult>({
        kind: "merge",
        boundaries: rows
          .filter((r) => merge.includes(r.id))
          .map((r) => r.boundary!),
      });
      if (!live.current) return;
      setRows((prev) => [
        ...prev.filter((r) => !merge.includes(r.id)),
        make(crypto.randomUUID(), {
          boundary: result.boundary,
          filled: result.filled,
          narrow: result.narrow,
        }),
      ]);
      setMerge([]);
    } catch (e) {
      if (live.current) setIssue(e instanceof Error ? e.message : "invalid");
    } finally {
      if (live.current) setProcessing(false);
    }
  }
  function profile(row: Draft, position: Point): FieldProfile {
    return {
      schema_version: "1",
      name: row.name,
      location: { longitude: position[0], latitude: position[1] },
      soil: { status: "unknown" },
      water:
        row.water === "unknown"
          ? { status: "unknown" }
          : { status: "reported", availability: row.water },
      crop_health: { status: "unknown" },
    };
  }
  const validRow = (r: Draft) =>
    fieldCreateRequestSchema.safeParse({
      ...profile(r, r.point ?? [0, 0]),
      ...(r.boundary ? { boundary: r.boundary } : {}),
    }).success &&
    (!r.historyEnabled || cropHistoryEntrySchema.safeParse(r.history).success);
  async function save() {
    if (
      !worker ||
      busy ||
      processing ||
      offline ||
      uncertain ||
      (issue && issue !== "noField") ||
      wait ||
      !rows.length ||
      !rows.every(validRow) ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setMerge([]);
    setError(undefined);
    request.current = new AbortController();
    let last = rows.findLast((r) => r.saved)?.saved;
    try {
      for (const row of rows) {
        if (row.saved) continue;
        const point = row.boundary
          ? await worker.run<Point>({ kind: "point", boundary: row.boundary })
          : row.point;
        if (!point) throw new Error("invalid");
        const boundary = row.boundary ? { boundary: row.boundary } : {};
        const field = profile(row, point);
        const result = row.historyEnabled
          ? await createFieldWithHistory(client, {
              signal: request.current.signal,
              body: fieldWithHistoryRequestSchema.parse({
                profile: field,
                history: [cropHistoryEntrySchema.parse(row.history)],
                ...boundary,
              }),
            })
          : await createField(client, {
              signal: request.current.signal,
              body: fieldCreateRequestSchema.parse({ ...field, ...boundary }),
            });
        if (!live.current) return;
        last = result.id;
        patch(row.id, { saved: result.id });
        query.setQueryData(
          keys.field(client.owner.snapshot().scope, result.id),
          result,
        );
      }
      await query.invalidateQueries({
        queryKey: keys.fieldPages(client.owner.snapshot().scope),
      });
      if (live.current && last) {
        toast(t("create.saved"));
        void navigate(`/fields/${last}`);
      }
    } catch (e) {
      if (live.current) {
        setError(e);
        void query.invalidateQueries({
          queryKey: keys.fieldPages(client.owner.snapshot().scope),
        });
        if (e instanceof ApiFailure) {
          setWait(e.retryAfterSeconds ?? 0);
          if (
            e.code === "INVALID_SERVER_RESPONSE" ||
            (e.status === 0 && e.code === "NETWORK_UNAVAILABLE")
          )
            setUncertain(true);
        }
      }
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 7) - 1),
  );
  const notReady =
    !rows.length ||
    (mode === "draw" && draw.vertices.length > 0 && !draw.closed) ||
    !rows.every(validRow) ||
    (!!issue && issue !== "noField") ||
    processing ||
    offline ||
    !capabilities.data?.plans ||
    session.signInRequired ||
    uncertain ||
    wait > 0;
  const panel = (
    <aside className="f2-panel f3-panel" aria-label={t("create.title")}>
      <header className="f2-panel-heading">
        <h2 ref={heading} tabIndex={-1}>
          {t("create.title")}
        </h2>
      </header>
      <div className="f2-panel-body f3-body" tabIndex={0}>
        <Select
          label={t("create.method")}
          value={mode}
          disabled={busy || uncertain}
          onChange={choose}
          options={modes
            .filter((m) => m !== "tap" || available)
            .map((m) => ({ value: m, label: t(modeKey[m]) }))}
        />
        {!available && <p>{t("field.detectionOff")}</p>}
        {!capabilities.data?.plans && <p>{t("capability.plansOff")}</p>}
        <p>
          {t(
            (
              {
                tap: "create.tapHint",
                paint: zoom < 15 ? "create.zoomHint" : "create.paintHint",
                draw: "create.drawHint",
                upload: "create.uploadHint",
                pin: "create.pinHint",
              } as const
            )[mode],
          )}
        </p>
        {(mode === "paint" || mode === "draw" || mode === "pin") && (
          <p className="f3-keyboard">
            {t(
              mode === "paint"
                ? "create.paintKeyboard"
                : mode === "draw"
                  ? "create.drawKeyboard"
                  : "create.pinKeyboard",
            )}
          </p>
        )}
        {mode === "paint" && (
          <output aria-live="polite">{t("create.cells", { count })}</output>
        )}
        {mode === "draw" && (
          <div className="f3-tools">
            <label>
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
                disabled={!suggestions.fields.length || busy}
              />
              {t("create.snap")}
            </label>
            {!suggestions.fields.length && <small>{t("create.snapOff")}</small>}
            <div>
              <IconButton
                icon="undo"
                label={t("create.undo")}
                disabled={!undo.length || busy}
                onClick={() => {
                  const prev = undo.at(-1)!;
                  setRedo((p) => [...p, draw]);
                  setUndo((p) => p.slice(0, -1));
                  changeDraw(prev.vertices, prev.closed, false);
                }}
              />
              <IconButton
                icon="redo"
                label={t("create.redo")}
                disabled={!redo.length || busy}
                onClick={() => {
                  const next = redo.at(-1)!;
                  setUndo((p) => [...p, draw]);
                  setRedo((p) => p.slice(0, -1));
                  changeDraw(next.vertices, next.closed, false);
                }}
              />
              <Button
                size="small"
                disabled={draw.vertices.length < 3 || draw.closed || busy}
                onClick={() => changeDraw(draw.vertices, true)}
              >
                {t("create.closeOutline")}
              </Button>
            </div>
          </div>
        )}
        {mode === "upload" && (
          <div className="f3-upload">
            <Button
              disabled={busy || processing || uncertain}
              onClick={() => fileInput.current?.click()}
            >
              {t("create.chooseFile")}
            </Button>
            <input
              hidden
              ref={fileInput}
              aria-label={t("create.chooseFile")}
              type="file"
              accept=".geojson,.json,.kml,.zip"
              disabled={busy || processing || uncertain}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}
        {(mode === "tap" || mode === "draw") && available && (
          <>
            <p className="f3-keyboard">{t("create.suggestionLimits")}</p>
            {suggestions.pending && (
              <p role="status">{t("create.loadingSuggestions")}</p>
            )}
            {mode === "tap" &&
              zoom >= 12 &&
              !suggestions.pending &&
              !suggestions.error &&
              !suggestions.fields.length &&
              issue !== "noField" && (
                <p role="status">{t("create.noCoverage")}</p>
              )}
            {!!suggestions.error && (
              <div role="status">
                <p>{failureText(suggestions.error, language, glossary.data)}</p>
                <RetryButton
                  error={suggestions.error}
                  retry={suggestions.retry}
                  busy={suggestions.pending || busy}
                />
              </div>
            )}
            <small>{t("create.ftwCredit")}</small>
          </>
        )}
        {processing && <p role="status">{t("create.processing")}</p>}
        {issue && (
          <p role="alert">
            {issue === "noField" ? t("create.noField") : issueText}
          </p>
        )}
        {!!importErrors.length && (
          <details open>
            <summary>
              {t("create.importProblems", { count: importErrors.length })}
            </summary>
            <ol>
              {importErrors.slice(0, 7).map((e, i) => (
                <li key={i}>
                  {t("create.polygonProblem", {
                    n: e.n,
                    reason: t(issueKeys[e.issue] ?? "create.invalid"),
                  })}
                </li>
              ))}
            </ol>
            {importErrors.length > 7 && <p>{t("create.moreProblems")}</p>}
          </details>
        )}
        {!rows.length && !processing && (
          <div className="f3-empty">
            <p>{t("create.empty")}</p>
          </div>
        )}
        <ul className="f3-selections">
          {rows.slice(currentPage * 7, currentPage * 7 + 7).map((row) => (
            <li key={row.id}>
              <div className="f3-row-heading">
                <Thumbnail
                  boundary={row.boundary ? { boundary: row.boundary } : null}
                />
                <span>
                  {row.boundary
                    ? t("create.areaValue", {
                        area: quantity(
                          boundaryHectares(row.boundary),
                          "ha",
                          language,
                        ),
                      })
                    : t("create.areaUnknown")}
                </span>
                <IconButton
                  icon="trash"
                  label={t("create.remove", { name: row.name })}
                  variant="ghost"
                  disabled={busy || !!row.saved || uncertain}
                  onClick={() => {
                    if (row.id === active.current) resetDraft();
                    setRows((p) => p.filter((r) => r.id !== row.id));
                    setMerge((p) => p.filter((id) => id !== row.id));
                  }}
                />
              </div>
              <TextField
                label={t("create.name")}
                maxLength={80}
                value={row.name}
                disabled={busy || !!row.saved || uncertain}
                {...(!fieldCreateRequestSchema.shape.name.safeParse(row.name)
                  .success
                  ? { error: t("create.nameError") }
                  : {})}
                onChange={(e) => patch(row.id, { name: e.target.value })}
              />
              <Select
                label={t("create.irrigation")}
                value={row.water}
                disabled={busy || !!row.saved || uncertain}
                onChange={(v) => patch(row.id, { water: v as Water })}
                options={(
                  [
                    "unknown",
                    "rainfed",
                    "irrigation_limited",
                    "irrigation_available",
                  ] as const
                ).map((value) => ({
                  value,
                  label: t(
                    (
                      {
                        unknown: "create.notSet",
                        rainfed: "create.rainfed",
                        irrigation_limited: "create.limited",
                        irrigation_available: "create.irrigated",
                      } as const
                    )[value],
                  ),
                }))}
              />
              {row.suggestion && (
                <>
                  <Chip text={t("create.suggested")} icon="warning" />
                  <div className="f3-row-actions">
                    <Button
                      size="small"
                      disabled={busy || !!row.saved}
                      onClick={() => {
                        resetDraft();
                        active.current = row.id;
                        setMode("draw");
                        focusBoundary(row.boundary!, 20);
                        changeDraw(
                          row.boundary!.coordinates[0].slice(0, -1),
                          true,
                        );
                      }}
                    >
                      {t("create.edit")}
                    </Button>
                    <Button
                      size="small"
                      disabled={busy || !!row.saved}
                      onClick={() => {
                        const boundary = row.suggestion!.geometry;
                        patch(row.id, { boundary });
                        if (row.id === active.current && mode === "draw")
                          changeDraw(
                            boundary.coordinates[0].slice(0, -1),
                            true,
                          );
                      }}
                    >
                      {t("create.reset")}
                    </Button>
                    <label>
                      <input
                        type="checkbox"
                        checked={merge.includes(row.id)}
                        disabled={busy || !!row.saved}
                        onChange={(e) =>
                          setMerge((p) =>
                            e.target.checked
                              ? [...p, row.id]
                              : p.filter((id) => id !== row.id),
                          )
                        }
                      />
                      {t("create.mergeChoice")}
                    </label>
                  </div>
                </>
              )}
              {row.filled && <p>{t("create.filled")}</p>}
              {row.narrow && <p>{t("create.narrow")}</p>}
              {!row.boundary && <p>{t("create.pinLimit")}</p>}
              <label className="f3-history-toggle">
                <input
                  type="checkbox"
                  checked={row.historyEnabled}
                  disabled={busy || !!row.saved || uncertain}
                  onChange={(e) =>
                    patch(row.id, { historyEnabled: e.target.checked })
                  }
                />
                {t("create.addLastCrop")}
              </label>
              {row.historyEnabled && (
                <Suspense fallback={<p>{t("loading")}</p>}>
                  <LastCrop
                    value={row.history}
                    disabled={busy || !!row.saved || uncertain}
                    onChange={(history) => patch(row.id, { history })}
                  />
                  {!cropHistoryEntrySchema.safeParse(row.history).success && (
                    <p role="status">{t("create.historyError")}</p>
                  )}
                </Suspense>
              )}
              {row.saved && <p role="status">{t("create.alreadySaved")}</p>}
            </li>
          ))}
        </ul>
        {rows.length > 7 && (
          <div className="f3-pagination">
            <IconButton
              icon="chevron-left"
              label={t("previous")}
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            />
            <IconButton
              icon="chevron-right"
              label={t("more")}
              disabled={(currentPage + 1) * 7 >= rows.length}
              onClick={() => setPage(currentPage + 1)}
            />
          </div>
        )}
        {merge.length >= 2 && (
          <Button
            disabled={busy || processing}
            size="small"
            onClick={() => void mergeRows()}
          >
            {t("create.merge")}
          </Button>
        )}
        {((mode === "draw" && draw.closed) ||
          (mode === "paint" && count > 0)) && (
          <Button
            disabled={busy || processing || !!issue}
            size="small"
            onClick={resetDraft}
          >
            {t("create.another")}
          </Button>
        )}
        {offline && <p role="status">{t("create.offline")}</p>}
        {!!error && (
          <p role="alert">
            {error instanceof ApiFailure && error.status === 409
              ? t("create.conflict")
              : failureText(error, language, glossary.data)}
          </p>
        )}
        {uncertain && (
          <p>
            {t("create.uncertain")}{" "}
            <button
              className="f2-inline"
              onClick={() => void navigate("/map?panel=fields")}
            >
              {t("create.checkSaved")}
            </button>
          </p>
        )}
        {wait > 0 && <p role="status">{t("error.wait", { seconds: wait })}</p>}
      </div>
      <footer className="f3-footer">
        <Button disabled={busy} onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={notReady}
          loading={busy}
          onClick={() => void save()}
        >
          {t("save")}
        </Button>
      </footer>
      <ReminderBar text={t("shell.reminder")} />
    </aside>
  );
  return phone ? (
    <Suspense fallback={null}>
      <PhoneSheet
        title={t("create.title")}
        initial="full"
        embedded
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        {panel}
      </PhoneSheet>
    </Suspense>
  ) : (
    panel
  );
}
