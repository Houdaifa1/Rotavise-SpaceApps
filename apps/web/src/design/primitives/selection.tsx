import { useId } from "react";
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 5,
  step = 1,
  unit = "",
  disabled = false,
  error,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="rv-field">
      <label htmlFor={id}>
        {label}{" "}
        <span className="rv-numeric">
          {value} {unit}
        </span>
      </label>
      <input
        id={id}
        className="rv-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-valuetext={`${value} ${unit}`}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {error && (
        <small id={`${id}-error`} className="rv-error-text">
          {error}
        </small>
      )}
    </div>
  );
}
