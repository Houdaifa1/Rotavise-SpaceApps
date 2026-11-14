import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMessages } from "../../i18n/messages.js";
import { Button } from "./controls.js";
import { StepProgress } from "./progress.js";
import { Icon } from "../icons/index.js";
import { number } from "../../i18n/format.js";

export function photoFileError(
  file: File,
  accept: string[],
  maxBytes: number,
): "photoInvalid" | "photoLarge" | undefined {
  if (!accept.includes(file.type)) return "photoInvalid";
  if (file.size > maxBytes) return "photoLarge";
}
export function PhotoPicker({
  accept = ["image/jpeg", "image/png", "image/webp"],
  maxBytes,
  file,
  onChange,
}: {
  accept?: string[];
  maxBytes: number;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const { t, language } = useMessages();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<"photoInvalid" | "photoLarge">();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const receive = (next: File | undefined) => {
    if (!next) return;
    const failure = photoFileError(next, accept, maxBytes);
    setError(failure);
    onChange(failure ? null : next);
  };
  return (
    <div
      className="rv-photo"
      data-dragging={dragging}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        receive(e.dataTransfer.files[0]);
      }}
    >
      <Icon name="camera" />
      <label htmlFor={id} className="rv-sr">
        {t("photo")}
      </label>
      <Button onClick={() => input.current?.click()}>{t("photo")}</Button>
      <p id={`${id}-hint`}>{t("photoHint")}</p>
      <p className="rv-caption">
        {t("maximum")}: {number(maxBytes / 1_000_000, language)}{" "}
        {t("megabytes")} ·{" "}
        {accept.map((type) => type.split("/")[1]?.toUpperCase()).join(", ")}
      </p>
      <input
        ref={input}
        id={id}
        type="file"
        hidden
        accept={accept.join(",")}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        onChange={(e) => {
          receive(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="rv-error-text">
          {t(error)}
        </p>
      )}
      {file && (
        <div className="rv-photo-preview">
          {preview && (
            <img
              src={preview}
              alt={t("photoReady")}
              onError={() => {
                setError("photoInvalid");
                onChange(null);
              }}
            />
          )}
          <p role="status">
            {t("photoReady")}: <span data-code>{file.name}</span>
          </p>
          <Button
            onClick={() => {
              onChange(null);
              setError(undefined);
            }}
          >
            {t("remove")}
          </Button>
        </div>
      )}
    </div>
  );
}
export function StepWizard({
  steps,
  current,
  onCurrentChange,
  onComplete,
}: {
  steps: { id: string; label: string; content: ReactNode; valid?: boolean }[];
  current: number;
  onCurrentChange: (step: number) => void;
  onComplete: () => void;
}) {
  const { t } = useMessages();
  const step = steps[current];
  if (!step) throw new RangeError("Wizard step outside range");
  return (
    <section className="rv-wizard">
      <StepProgress steps={steps.map((s) => s.label)} current={current} />
      <div tabIndex={-1} key={step.id} className="rv-wizard-content">
        {step.content}
      </div>
      <footer>
        <Button
          disabled={current === 0}
          onClick={() => onCurrentChange(current - 1)}
        >
          {t("back")}
        </Button>
        <Button
          disabled={step.valid === false}
          onClick={() => {
            if (current < steps.length - 1) onCurrentChange(current + 1);
            else onComplete();
          }}
        >
          {t(current === steps.length - 1 ? "finish" : "next")}
        </Button>
      </footer>
    </section>
  );
}
