import type { GlossaryResponse } from "@rotavise/contracts";
import { ApiFailure } from "../app/http.js";
import { message, type Language } from "../i18n/messages.js";

export function failureText(
  error: unknown,
  language: Language,
  glossary?: GlossaryResponse,
) {
  if (!(error instanceof ApiFailure)) return message(language, "error.generic");
  if (error.code === "NETWORK_UNAVAILABLE")
    return message(language, "error.network");
  if (error.code === "INVALID_SERVER_RESPONSE")
    return message(language, "error.response");
  const entry = glossary?.entries.find(
    (e) => e.group === "error" && e.code === error.code,
  );
  const text = entry?.meaning ?? message(language, "error.generic");
  return error.status === 429 && error.retryAfterSeconds !== undefined
    ? `${text} ${message(language, "error.wait", { seconds: error.retryAfterSeconds })}`
    : text;
}
