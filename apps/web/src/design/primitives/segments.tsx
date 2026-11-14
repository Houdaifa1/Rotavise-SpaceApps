import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { Option } from "./controls.js";
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      className="rv-segments"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      aria-label={label}
      disabled={disabled}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
