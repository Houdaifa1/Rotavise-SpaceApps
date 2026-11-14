import { useLocation, useNavigate } from "react-router";
import { useBoot, useSession } from "../../app/providers/Runtime.js";
import { useMessages } from "../../i18n/messages.js";
import { PlanWorkspace } from "../planner/index.js";
import { WeatherExplorer } from "../weather/index.js";
import { CropNameSetting } from "../crops/index.js";
import { AccountPanel } from "../account/index.js";
import type { FieldProfile } from "@rotavise/contracts";
import type { SavedPlan } from "../account/index.js";
import "./legacy.css";

export type LegacyState = {
  prefill?: {
    profile: FieldProfile;
    history: { crop_id: string; planted_on: string; harvested_on: string }[];
  };
  opened?: SavedPlan;
};
export function Component() {
  const { account, setAccount } = useSession();
  const boot = useBoot();
  const { t } = useMessages();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LegacyState | null;
  const section = location.pathname.includes("weather")
    ? "weather"
    : location.pathname.includes("planner")
      ? "planner"
      : "account";
  const cap = boot.capabilities.data;
  const blocked = !cap
    ? "degraded.capabilities"
    : section === "planner" && !cap.plans
      ? "capability.plansOff"
      : section === "weather" && !cap.weather
        ? "capability.weatherOff"
        : section === "account" && !cap.auth.email
          ? "capability.authOff"
          : undefined;
  return (
    <section className="f1-page f1-legacy-wrap">
      <h1>
        {t(
          section === "planner"
            ? "nav.planner"
            : section === "weather"
              ? "nav.weather"
              : "nav.account",
        )}
      </h1>
      <p className="f1-caption">{t("shell.legacyText")}</p>
      {section === "account" && <CropNameSetting />}
      {blocked ? (
        <p>{t(blocked)}</p>
      ) : (
        <div className="f1-legacy" lang="en">
          {section === "planner" && boot.catalog.data && (
            <PlanWorkspace
              account={account}
              prefilling={state?.prefill ?? null}
              opened={state?.opened ?? null}
            />
          )}
          {section === "weather" && <WeatherExplorer />}
          {section === "account" && (
            <AccountPanel
              account={account}
              onAccount={setAccount}
              onUseField={(profile, history) =>
                void navigate("/legacy/planner", {
                  state: {
                    prefill: { profile, history },
                  } satisfies LegacyState,
                })
              }
              onOpenPlan={(opened) =>
                void navigate(
                  opened.horizonYears === null
                    ? "/legacy/planner"
                    : `/plans/${opened.id}`,
                  {
                    state: { opened } satisfies LegacyState,
                  },
                )
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
