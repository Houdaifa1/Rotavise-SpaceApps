import type { CSSProperties } from "react";
import type { CatalogOptions } from "@rotavise/contracts";
import { cropColor } from "../../shared/cropColor.js";
import { useMessages } from "../../i18n/messages.js";
import { Tooltip } from "./feedback.js";

export type CatalogueCrop = CatalogOptions["crops"][number];
export type NameMode = "fr" | "en" | "ar" | "ary" | "all";
type CropLabel = {
  language: "fr" | "en" | "ar" | "ary";
  name: string;
  confidence?: "low" | "medium" | "high" | undefined;
  fallback?: boolean;
};
export function cropLabels(
  crop: {
    name: string;
    localNames: readonly (Omit<CropLabel, "language" | "confidence"> & {
      language: string;
      confidence?: CropLabel["confidence"] | null;
      preferred?: boolean | null | undefined;
    })[];
  },
  mode: NameMode,
): CropLabel[] {
  const names = (["fr", "en", "ar", "ary"] as const).flatMap<CropLabel>(
    (language) => {
      const candidates = crop.localNames.filter((n) => n.language === language);
      const preferred = candidates.find((n) => n.preferred) ?? candidates[0];
      return preferred
        ? [
            {
              ...preferred,
              language,
              confidence: preferred.confidence ?? undefined,
            },
          ]
        : language === "en"
          ? [{ language, name: crop.name }]
          : [];
    },
  );
  const requested = mode === "all" ? "fr" : mode;
  const primary =
    names.find((n) => n.language === requested) ??
    (mode === "ary" ? names.find((n) => n.language === "ar") : undefined) ??
    names.find((n) => n.language === "fr") ??
    names.find((n) => n.language === "en")!;
  return [
    { ...primary, fallback: mode === "ary" && primary.language === "ar" },
    ...names.filter((n) => n.language !== primary.language),
  ];
}
export function CropName({
  cropId,
  crop,
  nameMode = "fr",
  compact = false,
}: {
  cropId: string;
  crop?: { id: string } & Parameters<typeof cropLabels>[0];
  nameMode?: NameMode;
  compact?: boolean;
}) {
  const { t } = useMessages();
  if (!crop || crop.id !== cropId)
    return (
      <span className="rv-crop-name" title={t("unknownCrop")}>
        {cropId}
      </span>
    );
  return (
    <span className={`rv-crop-name ${compact ? "rv-name-compact" : ""}`}>
      {cropLabels(crop, nameMode).map((name, i) => (
        <span
          key={name.language}
          className={`${i ? "rv-name-secondary" : "rv-name-primary"} ${name.confidence === "low" ? "rv-name-unconfirmed" : ""}`}
          title={name.confidence === "low" ? t("unconfirmed") : undefined}
        >
          {i > 0 && <span aria-hidden="true"> · </span>}
          <bdi dir="auto" lang={name.language === "ary" ? "ar" : name.language}>
            {name.name}
          </bdi>
          {name.fallback && <small> ({t("arabic")})</small>}
        </span>
      ))}
    </span>
  );
}
export function CropSwatch({
  cropId,
  family,
  label,
}: {
  cropId: string;
  family?: string;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`rv-crop-swatch ${family ? "" : "rv-hatched"}`}
      style={family ? { background: cropColor(cropId, family) } : undefined}
    />
  );
}
export type CropSlot = {
  id: string;
  cropId?: string;
  crop?: CatalogueCrop;
  label?: string;
  duration?: number;
  title?: string;
  inert?: boolean;
};
export function CropStrip({
  slots,
  size = "regular",
  interactive = false,
  selected,
  onSelect,
  label,
  nameMode,
}: {
  slots: CropSlot[];
  size?: "small" | "regular";
  interactive?: boolean;
  selected?: string;
  onSelect?: (id: string, trigger: HTMLButtonElement) => void;
  nameMode?: NameMode | undefined;
  label: string;
}) {
  const { t } = useMessages();
  return (
    <div
      className={`rv-crop-strip rv-strip-${size}`}
      role="group"
      aria-label={label}
    >
      {slots.map((slot) => {
        const known = !!slot.crop && slot.crop.id === slot.cropId;
        const content = (
          <>
            <span
              className={`rv-strip-color ${!known ? "rv-hatched" : ""}`}
              style={
                known
                  ? ({
                      "--crop-color": cropColor(
                        slot.crop!.id,
                        slot.crop!.family,
                      ),
                    } as CSSProperties)
                  : undefined
              }
            />
            <span className="rv-strip-label">
              {slot.label ??
                (slot.cropId ? (
                  known ? (
                    <CropName
                      cropId={slot.cropId}
                      crop={slot.crop!}
                      nameMode={nameMode ?? "fr"}
                      compact
                    />
                  ) : (
                    t("unknownSlot")
                  )
                ) : (
                  t("emptySlot")
                ))}
            </span>
          </>
        );
        const style = { flexGrow: Math.max(0.1, slot.duration ?? 1) };
        return interactive && !slot.inert ? (
          <button
            key={slot.id}
            type="button"
            style={style}
            aria-pressed={selected === slot.id}
            title={slot.title}
            onClick={(event) => onSelect?.(slot.id, event.currentTarget)}
          >
            {content}
          </button>
        ) : (
          <span
            key={slot.id}
            className="rv-strip-slot"
            style={style}
            title={slot.title}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}
export function CropNameHelp({ children }: { children: React.ReactNode }) {
  const { t } = useMessages();
  return <Tooltip content={t("unconfirmed")}>{children}</Tooltip>;
}
