import { useBoot } from "../app/providers/Runtime.js";
import { failureText } from "../api/errors.js";
import { useEffect, useState } from "react";
import { ApiFailure } from "../app/http.js";
import { Button } from "../design/primitives/controls.js";
import { useMessages } from "../i18n/messages.js";

export function RetryButton({
  error,
  retry,
  busy = false,
}: {
  error?: unknown;
  retry: () => void;
  busy?: boolean;
}) {
  const { t } = useMessages();
  const [wait, setWait] = useState(0);
  useEffect(() => {
    setWait(error instanceof ApiFailure ? (error.retryAfterSeconds ?? 0) : 0);
  }, [error]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  return (
    <div>
      <Button disabled={wait > 0} loading={busy} onClick={retry}>
        {t("common.retry")}
      </Button>
      {wait > 0 && <p>{t("error.wait", { seconds: wait })}</p>}
    </div>
  );
}

export function DataError({
  error,
  retry,
  busy,
}: {
  error: unknown;
  retry: () => void;
  busy?: boolean;
}) {
  const { language } = useMessages();
  const { glossary } = useBoot();
  return (
    <div className="f2-data-error" role="status">
      <p>{failureText(error, language, glossary.data)}</p>
      <RetryButton error={error} retry={retry} busy={busy ?? false} />
    </div>
  );
}
