import { useState } from "react";
import { useBoot } from "./providers/Runtime.js";
import { useMessages, type MessageKey } from "../i18n/messages.js";
import { Popover } from "../design/primitives/feedback.js";
import { IconButton } from "../design/primitives/controls.js";
import { Icon } from "../design/icons/index.js";
import { RetryButton } from "../shared/RetryButton.js";

export function ServiceStatus() {
  const boot = useBoot();
  const { t } = useMessages();
  const [dismissed, setDismissed] = useState("");
  const checks = [
    {
      query: boot.health,
      message: "boot.unreachable" as MessageKey,
      failed: boot.health.isError,
    },
    {
      query: boot.readiness,
      message: "shell.readyLimited" as MessageKey,
      failed:
        boot.readiness.isError || boot.readiness.data?.status === "unavailable",
    },
    {
      query: boot.capabilities,
      message: "degraded.capabilities" as MessageKey,
      failed: boot.capabilities.isError,
    },
    {
      query: boot.account,
      message: "degraded.account" as MessageKey,
      failed: boot.account.isError,
    },
    {
      query: boot.catalog,
      message: "degraded.catalog" as MessageKey,
      failed: boot.catalog.isError && !!boot.capabilities.data?.plans,
    },
    {
      query: boot.glossary,
      message: "degraded.glossary" as MessageKey,
      failed: boot.glossary.isError,
    },
  ].filter((check) => check.failed);
  const signature = checks.map((check) => check.message).join(",");
  if (dismissed && dismissed === (signature || "healthy")) return null;
  return (
    <div className="fm-service-status" role="status">
      <Popover
        title={t("shell.serviceDetails")}
        onOpenChange={(open) => {
          if (open) void boot.readiness.refetch();
        }}
        trigger={
          <button className="fm-status-trigger" type="button">
            <Icon name={checks.length ? "warning" : "info"} />
            {t(checks.length ? "shell.serviceStatus" : "shell.serviceDetails")}
          </button>
        }
      >
        {!boot.readiness.data && boot.readiness.isFetching && (
          <p>{t("loading")}</p>
        )}
        {!checks.length && !boot.readiness.isFetching && <p>{t("ready")}</p>}
        {checks.map(({ query, message }) => (
          <div key={message}>
            <p>{t(message)}</p>
            <RetryButton
              retry={() => void query.refetch()}
              error={query.error}
            />
          </div>
        ))}
      </Popover>
      {!!checks.length && (
        <button
          className="fm-status-retry"
          type="button"
          onClick={() => {
            for (const { query } of checks) void query.refetch();
          }}
        >
          {t("shell.serviceRetry")}
        </button>
      )}
      <IconButton
        icon="close"
        label={t("shell.dismissStatus")}
        variant="ghost"
        onClick={() => setDismissed(signature || "healthy")}
      />
    </div>
  );
}
