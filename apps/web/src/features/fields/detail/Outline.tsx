import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { boundaryContains, fieldBoundarySchema } from "@rotavise/contracts";
import {
  useApi,
  useOffline,
  useSession,
  useToast,
} from "../../../app/providers/Runtime.js";
import { getFieldBoundary, saveFieldBoundary } from "../../../api/boundary.js";
import { keys } from "../../../api/keys.js";
import { Button } from "../../../design/primitives/controls.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { useMessages } from "../../../i18n/messages.js";
import type { MapRenderer } from "../../map/mapRenderer.js";
import { DataError } from "../../../shared/DataError.js";
import type { MappedField } from "../useFieldWorkspace.js";
import type { Point } from "../creation/geometry.js";
import type { attachEditor, EditorState } from "../creation/mapEditor.js";
import { GeometryWorker } from "../creation/workerClient.js";
import "../creation/creation.css";
import { isConflict } from "./fieldData.js";

type Props = {
  entry: MappedField;
  renderer: MapRenderer | undefined;
  onClose: () => void;
};
type Draft = { vertices: Point[]; closed: boolean };
export default function Outline(props: Props) {
  if (props.entry.boundary === undefined) return <Skeleton shape="row" />;
  return <OutlineEditor {...props} initial={props.entry.boundary} />;
}
function OutlineEditor({
  entry,
  renderer,
  onClose,
  initial,
}: Props & { initial: Exclude<MappedField["boundary"], undefined> }) {
  const { t } = useMessages();
  const [draft, setDraft] = useState<Draft>(() => ({
    vertices: initial?.boundary.coordinates[0].slice(0, -1) ?? [],
    closed: !!initial,
  }));
  const [version, setVersion] = useState(initial?.version ?? null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [failedEditor, setFailedEditor] = useState(false);
  const [editor, setEditor] = useState<ReturnType<typeof attachEditor>>();
  const offline = useOffline();
  const client = useApi();
  const { scope } = useSession();
  const cache = useQueryClient();
  const toast = useToast();
  const request = useRef<AbortController | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const state: EditorState = {
    mode: "draw",
    boundaries: [],
    pins: [],
    ...draft,
    snap: false,
    suggestions: [],
    locked: busy || offline,
  };
  const current = useRef({ state, t });
  current.current = { state, t };
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    if (!renderer) return;
    const worker = new GeometryWorker();
    let active = true;
    let instance: ReturnType<typeof attachEditor> | undefined;
    void import("../creation/mapEditor.js")
      .then(({ attachEditor }) => {
        if (!active) return;
        instance = attachEditor(renderer, worker, current.current.state, {
          onDraw: (vertices, closed) => setDraft({ vertices, closed }),
          vertexLabel: (n) => current.current.t("create.vertex", { n }),
          midpointLabel: (n) => current.current.t("create.midpoint", { n }),
          onPoint() {},
          onCells() {},
          onCount() {},
          onZoom() {},
          onError: () => setFailedEditor(true),
        });
        setEditor(instance);
      })
      .catch(() => {
        if (active) setFailedEditor(true);
      });
    return () => {
      active = false;
      instance?.destroy();
      worker.destroy();
    };
  }, [renderer]);
  useEffect(() => editor?.update(state), [editor, state]);
  const location = entry.field.profile.location;
  const parsed =
    draft.closed &&
    fieldBoundarySchema.safeParse({
      type: "Polygon",
      coordinates: [[...draft.vertices, draft.vertices[0]]],
    });
  const contains =
    parsed &&
    parsed.success &&
    boundaryContains(parsed.data, location.latitude, location.longitude);
  async function save() {
    if (offline || !parsed || !parsed.success || !contains || request.current)
      return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    const id = entry.field.id,
      params = { id },
      signal = controller.signal;
    const key = keys.boundary(scope, id);
    try {
      const boundary = await saveFieldBoundary(client, {
        params,
        signal,
        body: { expectedVersion: version, boundary: parsed.data },
      });
      cache.setQueryData(key, { boundary });
      toast(t("f4.saved"));
      onClose();
    } catch (failure) {
      if (signal.aborted) return;
      if (isConflict(failure)) {
        try {
          const latest = await getFieldBoundary(client, { params, signal });
          if (signal.aborted) return;
          cache.setQueryData(key, latest);
          setVersion(latest.boundary?.version ?? null);
          setConflict(true);
        } catch (reloadError) {
          if (!signal.aborted) setError(reloadError);
        }
      } else setError(failure);
    } finally {
      request.current = undefined;
      if (!signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="f4-stack">
      <h3 tabIndex={-1} ref={heading}>
        {t(initial ? "f4.editOutline" : "f4.addOutline")}
      </h3>
      <p>{t("f4.outlineHelp")}</p>
      {!renderer && <p>{t("f4.mapNeeded")}</p>}
      {offline && <p>{t("f4.offline")}</p>}
      {failedEditor && <p role="alert">{t("create.invalid")}</p>}
      {parsed && !parsed.success && <p role="alert">{t("create.invalid")}</p>}
      {parsed && parsed.success && !contains && (
        <p role="alert">{t("f4.outlineContains")}</p>
      )}
      {conflict && <p role="alert">{t("f4.conflict")}</p>}
      {error !== undefined && (
        <DataError
          error={error}
          retry={() => void save()}
          busy={busy || offline}
        />
      )}
      <div className="f4-actions">
        {draft.closed ? (
          <Button
            size="small"
            disabled={busy || offline}
            onClick={() => setDraft({ vertices: [], closed: false })}
          >
            {t("f4.redraw")}
          </Button>
        ) : (
          <Button
            size="small"
            disabled={busy || offline || draft.vertices.length < 3}
            onClick={() => setDraft({ ...draft, closed: true })}
          >
            {t("f4.closeOutline")}
          </Button>
        )}
      </div>
      <div className="f4-actions">
        <Button size="small" disabled={busy} onClick={onClose}>
          {t("secondary")}
        </Button>
        <Button
          size="small"
          variant="primary"
          loading={busy}
          disabled={!contains || offline || !editor || error !== undefined}
          onClick={() => void save()}
        >
          {t(conflict ? "f4.reapply" : "save")}
        </Button>
      </div>
    </section>
  );
}
