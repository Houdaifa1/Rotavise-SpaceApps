import { useState, type ReactNode } from "react";
import { describe, expect, jest, test } from "@jest/globals";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import {
  DesignLanguage,
  type Language,
} from "../../apps/web/src/i18n/messages.js";
import * as P from "../../apps/web/src/design/primitives/index.js";

function view(child: ReactNode, language: Language = "fr") {
  return render(
    <DesignLanguage language={language}>
      <main>{child}</main>
    </DesignLanguage>,
  );
}
describe.each(["fr", "en"] as const)("controls in %s", (language) => {
  test.each(
    (["primary", "secondary", "ghost", "danger"] as const).flatMap((variant) =>
      (
        ["default", "hover", "pressed", "focus", "loading", "disabled"] as const
      ).map((state) => ({ variant, state })),
    ),
  )("Button $variant $state", async ({ variant, state }) => {
    const action = jest.fn();
    const { container } = view(
      <P.Button
        variant={variant}
        data-preview-state={state}
        loading={state === "loading"}
        disabled={state === "disabled"}
        onClick={action}
      >
        Action
      </P.Button>,
      language,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(action).toHaveBeenCalledTimes(
      state === "disabled" || state === "loading" ? 0 : 1,
    );
    expect(button).toHaveAttribute("data-preview-state", state);
    expect(await axe(container)).toHaveNoViolations();
  });
  test.each(["default", "hover", "pressed", "focus", "loading", "disabled"])(
    "IconButton %s",
    async (state) => {
      const { container } = view(
        <P.IconButton
          icon="save"
          label="Action"
          loading={state === "loading"}
          disabled={state === "disabled"}
          data-preview-state={state}
        />,
        language,
      );
      expect(
        screen.getByRole("button", { name: /Action/ }),
      ).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
    },
  );
  test.each(
    [P.TextField, P.NumberField, P.DateField].flatMap((Component, i) =>
      ["default", "focus", "error", "disabled", "readonly"].map((state) => ({
        Component,
        kind: ["text", "number", "date"][i],
        state,
      })),
    ),
  )("$kind field $state", async ({ Component, state }) => {
    const { container } = view(
      <Component
        label="Field"
        unit="ha"
        hint="Help"
        {...(state === "error" ? { error: "Required" } : {})}
        disabled={state === "disabled"}
        readOnly={state === "readonly"}
      />,
      language,
    );
    const input = screen.getByLabelText("Field");
    if (state === "focus") {
      act(() => input.focus());
      expect(input).toHaveFocus();
    }
    if (state === "error")
      expect(input).toHaveAccessibleDescription("Help Required");
    if (state === "disabled") expect(input).toBeDisabled();
    if (state === "readonly") expect(input).toHaveAttribute("readonly");
    expect(await axe(container)).toHaveNoViolations();
  });
  test.each([false, true])("Select disabled=%s", async (disabled) => {
    const changed = jest.fn();
    const { container } = view(
      <P.Select
        label="Select"
        options={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
        ]}
        value="one"
        onChange={changed}
        disabled={disabled}
      />,
      language,
    );
    const select = screen.getByRole("combobox");
    if (!disabled) {
      fireEvent.change(select, { target: { value: "two" } });
      expect(changed).toHaveBeenCalledWith("two");
    }
    expect(await axe(container)).toHaveNoViolations();
  });
  test.each(["closed", "open", "empty", "disabled"])(
    "SearchSelect %s",
    async (state) => {
      const user = userEvent.setup();
      const changed = jest.fn();
      view(
        <P.SearchSelect
          label="Search crop"
          options={[
            { value: "one", label: "One" },
            { value: "two", label: "Two" },
          ]}
          value="one"
          onChange={changed}
          disabled={state === "disabled"}
        />,
        language,
      );
      if (state === "open" || state === "empty") {
        await user.click(screen.getByRole("button"));
        const search = screen.getByRole("combobox");
        if (state === "empty") {
          await user.type(search, "zzz");
          expect(screen.queryAllByRole("option")).toHaveLength(0);
        } else {
          await user.keyboard("{ArrowDown}{Enter}");
          expect(changed).toHaveBeenCalledWith("two");
        }
      }
      expect(await axe(document.body)).toHaveNoViolations();
    },
  );
  test.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])("Switch checked=%s disabled=%s", async (checked, disabled) => {
    const changed = jest.fn();
    const { container } = view(
      <P.Switch
        label="Switch"
        checked={checked}
        onChange={changed}
        disabled={disabled}
      />,
      language,
    );
    const button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", String(checked));
    fireEvent.click(button);
    expect(changed).toHaveBeenCalledTimes(disabled ? 0 : 1);
    expect(await axe(container)).toHaveNoViolations();
  });
  test.each([
    [0, false],
    [3, false],
    [5, false],
    [3, true],
  ])("Slider value=%s disabled=%s", async (value, disabled) => {
    const changed = jest.fn();
    const { container } = view(
      <P.Slider
        label="Slider"
        value={value}
        onChange={changed}
        unit="mm"
        disabled={disabled}
      />,
      language,
    );
    expect(screen.getByRole("slider")).toHaveValue(String(value));
    if (!disabled) {
      fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });
      expect(changed).toHaveBeenCalledWith(4);
    }
    expect(await axe(container)).toHaveNoViolations();
  });
  test("SegmentedControl keyboard, selected and disabled", async () => {
    const changed = jest.fn();
    const user = userEvent.setup();
    const { container } = view(
      <P.SegmentedControl
        label="View"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C", disabled: true },
        ]}
        value="a"
        onChange={changed}
      />,
      language,
    );
    await user.click(screen.getByRole("radio", { name: "A" }));
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "B" })).toHaveFocus(),
    );
    await user.keyboard(" ");
    expect(changed).toHaveBeenCalledWith("b");
    expect(screen.getByRole("radio", { name: "C" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
  test("Tabs switches by keyboard and retains labelled panels", async () => {
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <P.Tabs
          label="Tabs"
          value={value}
          onChange={setValue}
          items={[
            { value: "a", label: "A", content: "First" },
            { value: "b", label: "B", content: "Second" },
            { value: "c", label: "C", content: "Third", disabled: true },
          ]}
        />
      );
    }
    const user = userEvent.setup();
    const { container } = view(<Harness />, language);
    await user.click(screen.getByRole("tab", { name: "A" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second");
    expect(screen.getByRole("tab", { name: "C" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
  test("LanguageSwitch has two explicit pressed states", async () => {
    const change = jest.fn();
    const { container } = view(
      <P.LanguageSwitch value={language} onChange={change} />,
      language,
    );
    expect(
      screen.getByRole("button", {
        name: language === "fr" ? "Français" : "English",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      screen.getByRole("button", {
        name: language === "fr" ? "English" : "Français",
      }),
    );
    expect(change).toHaveBeenCalledWith(language === "fr" ? "en" : "fr");
    expect(await axe(container)).toHaveNoViolations();
  });
});
