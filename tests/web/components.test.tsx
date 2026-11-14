import { useState, type ReactNode } from "react";
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { DesignLanguage } from "../../apps/web/src/i18n/messages.js";
import * as P from "../../apps/web/src/design/primitives/index.js";
import { Logo } from "../../apps/web/src/design/motif/Logo.js";
import crops from "../support/fixtures/design/crops.json" with { type: "json" };
const crop = crops[0] as P.CatalogueCrop;
const noop = () => {};
const nav: P.NavItem[] = ["map", "fields", "plans", "crops", "account"].map(
  (id, i) => ({
    id,
    label: id,
    icon: "map",
    onPress: noop,
    ...(i === 2 ? { badge: "1" } : {}),
  }),
);
const factories: [string, () => ReactNode][] = [
  ...(["open", "closing", "loading"] as const).flatMap(
    (state) =>
      [
        [
          `Panel ${state}`,
          () => (
            <P.Panel
              title="Panel"
              subtitle="Context"
              state={state}
              onClose={noop}
            >
              Content
            </P.Panel>
          ),
        ],
        [
          `DetailPanel ${state}`,
          () => (
            <P.DetailPanel title="Detail" state={state} onClose={noop}>
              Content
            </P.DetailPanel>
          ),
        ],
      ] as [string, () => ReactNode][],
  ),
  [
    "AppShell responsive structure",
    () => (
      <P.AppShell
        items={nav}
        active="map"
        list={<P.Panel title="List" />}
        detail={<P.DetailPanel title="Details" />}
      >
        Content
      </P.AppShell>
    ),
  ],
  ["IconRail active and badge", () => <P.IconRail items={nav} active="map" />],
  ["TabBar active and badge", () => <P.TabBar items={nav} active="map" />],
  ...(["default", "open", "disabled"] as const).map(
    (state) =>
      [
        `FloatingChip ${state}`,
        () => (
          <P.FloatingChip
            label="Layer"
            value="Context"
            onPress={noop}
            open={state === "open"}
            disabled={state === "disabled"}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  [
    "MapTools pressed and disabled",
    () => (
      <P.MapTools
        items={[
          { icon: "zoom-in", label: "Zoom in", onPress: noop, pressed: true },
          {
            icon: "zoom-out",
            label: "Zoom out",
            onPress: noop,
            disabled: true,
          },
        ]}
      />
    ),
  ],
  ...[false, true].map(
    (open) =>
      [
        `LegendCard open=${open}`,
        () => (
          <P.LegendCard
            title="Legend"
            items={[{ kind: "water", label: "Water" }]}
            open={open}
            onOpenChange={noop}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...(["ready", "noImage", "cloudy", "loading"] as const).map(
    (status) =>
      [
        `DateStepper ${status}`,
        () => (
          <P.DateStepper
            dates={["2026-11-10", "2026-11-11"]}
            value="2026-11-10"
            onChange={noop}
            status={status}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  [
    "DateStepper no dates",
    () => <P.DateStepper dates={[]} value="" onChange={noop} />,
  ],
  [
    "CompareSlider default",
    () => (
      <P.CompareSlider left="Before" right="After" value={50} onChange={noop} />
    ),
  ],
  ...(["sourced", "mixed", "recalled", "missing"] as const).map(
    (kind) =>
      [
        `SourceChip ${kind}`,
        () => (
          <P.SourceChip
            kind={kind}
            expertReviewed={kind === "sourced"}
            onClick={noop}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...(["ready", "loading", "partial", "failed", "disabled"] as const).map(
    (status) =>
      [`StatusChip ${status}`, () => <P.StatusChip status={status} />] as [
        string,
        () => ReactNode,
      ],
  ),
  ["TermChip", () => <P.TermChip text="Term" onClick={noop} />],
  ["Chip data", () => <P.Chip kind="water" text="Water" />],
  ...(["line", "row", "chart", "circle"] as const).map(
    (shape) =>
      [`Skeleton ${shape}`, () => <P.Skeleton shape={shape} />] as [
        string,
        () => ReactNode,
      ],
  ),
  ...[P.EmptyState, P.ErrorState, P.PartialState].flatMap((Component, i) =>
    [true, false].map(
      (action) =>
        [
          `State ${i} action=${action}`,
          () => (
            <Component
              title="State"
              text="Context"
              {...(action
                ? { action: { label: "Action", onClick: noop } }
                : {})}
            />
          ),
        ] as [string, () => ReactNode],
    ),
  ),
  ["ReminderBar", () => <P.ReminderBar />],
  ["OfflineBar", () => <P.OfflineBar />],
  ...[0, 40, 100, undefined].map(
    (value) =>
      [
        `ProgressBar ${value ?? "indeterminate"}`,
        () => (
          <P.ProgressBar
            label="Progress"
            {...(value === undefined ? {} : { value })}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...[0, 1, 2, undefined].map(
    (current) =>
      [
        `StepProgress ${current ?? "indeterminate"}`,
        () => (
          <P.StepProgress
            steps={["First", "Second", "Third"]}
            {...(current === undefined ? {} : { current })}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...(["small", "regular"] as const).map(
    (size) =>
      [
        `CropStrip ${size}, selected empty and unknown`,
        () => (
          <P.CropStrip
            label="Rotation"
            size={size}
            interactive
            selected="one"
            onSelect={noop}
            slots={[
              { id: "one", cropId: crop.id, crop },
              { id: "empty" },
              { id: "unknown", cropId: "unlisted" },
            ]}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...(["fr", "en", "ar", "ary", "all"] as const).map(
    (nameMode) =>
      [
        `CropName ${nameMode}`,
        () => <P.CropName cropId={crop.id} crop={crop} nameMode={nameMode} />,
      ] as [string, () => ReactNode],
  ),
  ["CropName unknown", () => <P.CropName cropId="unlisted" />],
  [
    "CropSwatch known",
    () => (
      <P.CropSwatch cropId={crop.id} family={crop.family} label={crop.name} />
    ),
  ],
  [
    "CropSwatch unknown",
    () => <P.CropSwatch cropId="unlisted" label="Unknown" />,
  ],
  ...(
    [
      [10, 60],
      [10, 10],
      [null, null],
    ] as const
  ).map(
    ([min, max]) =>
      [
        `RangeBar ${min ?? "no data"} ${max}`,
        () => (
          <P.RangeBar
            min={min}
            max={max}
            domain={[0, 100]}
            label="Range"
            unit="mm"
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ...[0, 0.4, 1, null].map(
    (loss) =>
      [
        `ScoreBar ${loss ?? "not compared"}`,
        () => <P.ScoreBar loss={loss} label="Loss" />,
      ] as [string, () => ReactNode],
  ),
  [
    "StatCard",
    () => <P.StatCard label="Width" value="1440 px" caption="Specification" />,
  ],
  ...[false, true].map(
    (empty) =>
      [
        `DataTable empty=${empty}`,
        () => (
          <P.DataTable
            label="Table"
            rows={
              empty
                ? []
                : [
                    { id: "a", value: 1 },
                    { id: "b", value: 2 },
                  ]
            }
            columns={[
              {
                key: "value",
                label: "Value",
                compare: (a, b) => a.value - b.value,
              },
            ]}
          />
        ),
      ] as [string, () => ReactNode],
  ),
  ["Logo", () => <Logo />],
];
describe.each(["fr", "en"] as const)("catalogue in %s", (language) => {
  test.each(factories)("%s", async (_, factory) => {
    const { container } = render(
      <DesignLanguage language={language}>
        <main>{factory()}</main>
      </DesignLanguage>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
test("MapTools rejects more than four controls; TabBar requires five", () => {
  expect(() =>
    P.MapTools({
      items: Array.from({ length: 5 }, () => ({
        icon: "map",
        label: "Map",
        onPress: noop,
      })),
    }),
  ).toThrow();
  expect(() => P.TabBar({ items: [], active: "map" })).toThrow();
});
test("legend, comparison, date and map controls dispatch intent", () => {
  const change = jest.fn();
  render(
    <>
      <P.LegendCard
        title="Legend"
        open={false}
        onOpenChange={change}
        items={[]}
      />
      <P.CompareSlider
        left="Before"
        right="After"
        value={50}
        onChange={change}
      />
      <P.DateStepper
        dates={["2026-11-10", "2026-11-11"]}
        value="2026-11-10"
        onChange={change}
      />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Legend" }));
  expect(change).toHaveBeenCalledWith(true);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "60" } });
  expect(change).toHaveBeenCalledWith(60);
  fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  expect(change).toHaveBeenCalledWith("2026-11-11");
});
test("DataTable sorting and pagination cap rows at seven", () => {
  render(
    <P.DataTable
      label="Numbers"
      rows={Array.from({ length: 9 }, (_, i) => ({ id: String(i), value: i }))}
      columns={[
        { key: "value", label: "Value", compare: (a, b) => a.value - b.value },
      ]}
    />,
  );
  expect(screen.getAllByRole("row")).toHaveLength(8);
  const sort = screen.getByRole("button", { name: "Value" });
  fireEvent.click(sort);
  expect(screen.getByRole("columnheader")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  fireEvent.click(sort);
  expect(screen.getByRole("columnheader")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  expect(screen.getAllByRole("cell")[0]).toHaveTextContent("8");
  fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
  expect(screen.getAllByRole("cell")).toHaveLength(2);
});
test.each(["peek", "half", "full"] as const)(
  "BottomSheet %s and reduced motion",
  async (detent) => {
    const user = userEvent.setup();
    const change = jest.fn();
    render(
      <P.BottomSheet
        title="Sheet"
        trigger={<P.Button>Open sheet</P.Button>}
        detent={detent}
        onDetent={change}
      >
        <p>Content</p>
      </P.BottomSheet>,
    );
    await user.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(await axe(document.body)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Pleine hauteur" }));
    expect(change).toHaveBeenCalledWith("full");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Open sheet" })).toHaveFocus();
  },
);
test.each(["dialog", "confirm", "popover", "glossary", "tooltip"])(
  "%s open, keyboard and dismissal",
  async (kind) => {
    const user = userEvent.setup();
    const action = jest.fn();
    const trigger = <P.Button>Open</P.Button>;
    render(
      <main>
        {kind === "dialog" ? (
          <P.Dialog trigger={trigger} title="Dialog" body="Body" />
        ) : kind === "confirm" ? (
          <P.ConfirmDialog
            trigger={trigger}
            title="Confirm"
            body="Body"
            onConfirm={action}
          />
        ) : kind === "popover" ? (
          <P.Popover trigger={trigger} title="Popover">
            <p>Body</p>
          </P.Popover>
        ) : kind === "glossary" ? (
          <P.GlossaryTerm
            entry={{
              code: "term",
              group: "term",
              term: "Open",
              meaning: "Body",
            }}
          />
        ) : (
          <P.Tooltip content="Help">{trigger}</P.Tooltip>
        )}
      </main>,
    );
    const open = screen.getByRole("button", { name: "Open" });
    if (kind === "tooltip") {
      await user.hover(open);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Help");
    } else {
      await user.click(open);
      expect(screen.getByText("Body")).toBeVisible();
    }
    expect(await axe(document.body)).toHaveNoViolations();
    if (kind === "confirm") {
      await user.click(screen.getByRole("button", { name: "Annuler" }));
      expect(action).not.toHaveBeenCalled();
      await user.click(open);
      await user.click(screen.getByRole("button", { name: "Supprimer" }));
      expect(action).toHaveBeenCalledTimes(1);
    } else await user.keyboard("{Escape}");
    if (kind !== "tooltip") await waitFor(() => expect(open).toHaveFocus());
  },
);
test("Dialog traps focus", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Outside</button>
      <P.Dialog
        trigger={<P.Button>Open</P.Button>}
        title="Dialog"
        body="Body"
      />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Open" }));
  for (let i = 0; i < 6; i++) {
    await user.tab();
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
  }
});
test("Toast follows action, expires after six seconds and clears its timer", () => {
  jest.useFakeTimers();
  const dismiss = jest.fn();
  const { unmount } = render(
    <P.Toast
      message="Action received"
      onDismiss={dismiss}
      action={{ label: "Undo", onClick: noop }}
    />,
  );
  jest.advanceTimersByTime(5999);
  expect(dismiss).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(dismiss).toHaveBeenCalledTimes(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
test.each([0, 1, 2])("StepWizard step %s", async (current) => {
  const change = jest.fn();
  const done = jest.fn();
  const { container } = render(
    <P.StepWizard
      steps={[
        { id: "a", label: "A", content: "First" },
        { id: "b", label: "B", content: "Second" },
        { id: "c", label: "C", content: "Third" },
      ]}
      current={current}
      onCurrentChange={change}
      onComplete={done}
    />,
  );
  expect(await axe(container)).toHaveNoViolations();
  fireEvent.click(
    screen.getByRole("button", {
      name: current === 2 ? "Terminer" : "Suivant",
    }),
  );
  if (current === 2) expect(done).toHaveBeenCalledTimes(1);
  else expect(change).toHaveBeenCalledWith(current + 1);
});
test.each(["empty", "dragging", "invalid", "large", "ready", "unreadable"])(
  "PhotoPicker %s",
  async (state) => {
    function Harness() {
      const [file, setFile] = useState<File | null>(null);
      return <P.PhotoPicker file={file} onChange={setFile} maxBytes={10} />;
    }
    const { container } = render(<Harness />);
    const input = screen.getByLabelText("Choisir une photo");
    if (state === "dragging") fireEvent.dragOver(input);
    if (
      state === "invalid" ||
      state === "large" ||
      state === "ready" ||
      state === "unreadable"
    )
      fireEvent.change(input, {
        target: {
          files: [
            new File([state === "large" ? "12345678901" : "123"], "photo", {
              type: state === "invalid" ? "text/plain" : "image/jpeg",
            }),
          ],
        },
      });
    if (state === "invalid")
      expect(screen.getByRole("alert")).toHaveTextContent("Format non accepté");
    if (state === "large")
      expect(screen.getByRole("alert")).toHaveTextContent("taille autorisée");
    if (state === "ready") {
      expect(screen.getByRole("img")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    }
    if (state === "unreadable") {
      fireEvent.error(screen.getByRole("img"));
      expect(screen.getByRole("alert")).toHaveTextContent("Format non accepté");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    }
    expect(await axe(container)).toHaveNoViolations();
  },
);
