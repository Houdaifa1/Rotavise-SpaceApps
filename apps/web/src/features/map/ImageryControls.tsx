import { useId, useState, type ComponentPropsWithRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Icon } from "../../design/icons/index.js";
import { Button, IconButton } from "../../design/primitives/controls.js";
import { ReminderBar } from "../../design/primitives/feedback.js";
import { calendarDate } from "../../i18n/format.js";
import { useMessages } from "../../i18n/messages.js";
import type { BaseLayer } from "./basemap.js";
import { validDate, type Product } from "./gibs.js";
import { today, type useImagery } from "./useImagery.js";

export function ImageryControls({
  base,
  setBase,
  product,
  setProduct,
  date,
  choose,
  manual,
  scan,
  retry,
  earlier,
  recent,
  compare,
  setCompare,
  comparing,
  setComparing,
}: {
  base: BaseLayer;
  setBase: (base: BaseLayer) => void;
  product: Product;
  setProduct: (product: Product) => void;
  date: string | undefined;
  choose: (date: string, manual: boolean) => void;
  manual: string;
  scan: ReturnType<typeof useImagery>;
  retry: () => void;
  earlier: () => void;
  recent: (() => void) | undefined;
  compare: string | undefined;
  setCompare: (date: string) => void;
  comparing: boolean;
  setComparing: (value: boolean) => void;
}) {
  const { t, language } = useMessages();
  const [draft, setDraft] = useState(manual);
  const [invalid, setInvalid] = useState(false);
  const dateId = useId();
  const compareId = useId();
  const index = date ? scan.dates.indexOf(date) : -1;
  const move = (offset: number) => {
    const next = scan.dates[index + offset];
    if (next) choose(next, false);
  };
  const typed = manual && scan.coverage(manual);
  const choices = scan.dates.filter((value) => value !== date);
  return (
    <>
      <div className="rv-popover-header">
        <strong>{t("map.layers")}</strong>
        <Popover.Close asChild>
          <IconButton variant="ghost" icon="close" label={t("close")} />
        </Popover.Close>
      </div>
      <div className="f2-imagery-controls">
        <fieldset>
          <legend>{t("map.imagery")}</legend>
          <label>
            <input
              type="radio"
              name="base-layer"
              checked={base === "satellite"}
              onChange={() => setBase("satellite")}
            />
            {t("map.satellite")}
          </label>
          <p>{t("map.satelliteDetail")}</p>
          <label>
            <input
              type="radio"
              name="base-layer"
              checked={base === "nasa"}
              onChange={() => setBase("nasa")}
            />
            {t("map.nasa")}
          </label>
        </fieldset>
        {base === "nasa" && (
          <>
            <p>{t("map.nasaExplanation")}</p>
            <fieldset>
              <legend>{t("map.nasaProduct")}</legend>
              <label>
                <input
                  type="radio"
                  checked={product === "hls"}
                  onChange={() => setProduct("hls")}
                  name="imagery-product"
                />
                {t("map.hls")}
              </label>
              <label>
                <input
                  type="radio"
                  checked={product === "modis"}
                  onChange={() => setProduct("modis")}
                  name="imagery-product"
                />
                {t("map.modis")}
              </label>
            </fieldset>
            <div
              className="f2-date-step"
              role="group"
              aria-label={t("map.dates")}
            >
              <IconButton
                icon="chevron-left"
                label={t("map.older")}
                disabled={index < 0 || index >= scan.dates.length - 1}
                onClick={() => move(1)}
              />
              <output aria-live="polite">
                {date ? calendarDate(date, language) : t("map.noVerifiedDate")}
              </output>
              <IconButton
                icon="chevron-right"
                label={t("map.newer")}
                disabled={index <= 0}
                onClick={() => move(-1)}
              />
            </div>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const accepted = validDate(draft) && draft <= today;
                setInvalid(!accepted);
                if (accepted) choose(draft, true);
              }}
            >
              <label htmlFor={dateId}>{t("map.checkDate")}</label>
              <div className="f2-date-form">
                <input
                  id={dateId}
                  type="date"
                  max={today}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setInvalid(false);
                  }}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? dateId + "-error" : undefined}
                />
                <Button type="submit">{t("map.check")}</Button>
              </div>
              {invalid && (
                <p id={dateId + "-error"} role="status">
                  {t("map.invalidDate")}
                </p>
              )}
            </form>
            <div aria-live="polite">
              {scan.pending && <p>{t("map.checkingDates")}</p>}
              {typed === "empty" && (
                <p>
                  {t("map.noImage", { date: calendarDate(manual, language) })}
                </p>
              )}
              {typed === "partial" && <p>{t("map.partial")}</p>}
              {!scan.pending && scan.dates.length === 0 && !scan.failed && (
                <p>{t("map.noDates")}</p>
              )}
              {scan.failed && (
                <p>
                  {t("map.checkFailed")}{" "}
                  <button type="button" className="f2-inline" onClick={retry}>
                    {t("common.retry")}
                  </button>
                </p>
              )}
            </div>
            <button
              type="button"
              className="f2-inline"
              onClick={earlier}
              disabled={scan.pending}
            >
              {t("map.earlierDates")}
            </button>
            {recent && (
              <button type="button" className="f2-inline" onClick={recent}>
                {t("map.recentDates")}
              </button>
            )}
            <label className="f2-compare-option">
              <input
                type="checkbox"
                checked={comparing}
                disabled={!comparing && (!date || choices.length === 0)}
                onChange={(event) => setComparing(event.target.checked)}
              />
              {t("map.compare")}
            </label>
            {comparing && choices.length > 0 ? (
              <div>
                <span>{t("map.secondDate")}</span>
                <div
                  className="f2-date-step"
                  id={compareId}
                  role="group"
                  aria-label={t("map.secondDate")}
                >
                  <IconButton
                    icon="chevron-left"
                    label={t("map.olderCompare")}
                    disabled={
                      choices.indexOf(compare ?? "") >= choices.length - 1
                    }
                    onClick={() => {
                      const value = choices[choices.indexOf(compare ?? "") + 1];
                      if (value) setCompare(value);
                    }}
                  />
                  <output aria-live="polite">
                    {compare && calendarDate(compare, language)}
                  </output>
                  <IconButton
                    icon="chevron-right"
                    label={t("map.newerCompare")}
                    disabled={choices.indexOf(compare ?? "") <= 0}
                    onClick={() => {
                      const value = choices[choices.indexOf(compare ?? "") - 1];
                      if (value) setCompare(value);
                    }}
                  />
                </div>
              </div>
            ) : (
              <p>
                {t(
                  choices.length ? "map.compareHint" : "map.compareNeedsDates",
                )}
              </p>
            )}
            <p>{t("map.clouds")}</p>
          </>
        )}
      </div>
      <ReminderBar text={t("shell.reminder")} />
    </>
  );
}

export function LayerChip({
  title,
  caption,
  ...props
}: ComponentPropsWithRef<"button"> & { title: string; caption: string }) {
  return (
    <button type="button" className="f2-map-chip f2-layer-chip" {...props}>
      <Icon name="layers" />
      <span>
        <span>{title}</span>
        <small>{caption}</small>
      </span>
      <Icon name="chevron-down" />
    </button>
  );
}
