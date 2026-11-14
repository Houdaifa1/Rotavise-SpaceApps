import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IntlMessageFormat } from "intl-messageformat";
import type fr from "./fr.json";
export type Language = "fr" | "en";
import type plansFr from "./plans.fr.json";
import type progressFr from "./progress.fr.json";
export type PlanMessageKey = keyof typeof plansFr | keyof typeof progressFr;
export type MessageKey = keyof typeof fr | PlanMessageKey;
export const dictionaries: Record<
  Language,
  Partial<Record<MessageKey, string>>
> = {
  fr: {},
  en: {},
};
const languages = new Map<Language, Promise<void>>();
const loaded = new Set<Language>();
const languageUrls = {
  fr: new URL("./fr.json", import.meta.url).href,
  en: new URL("./en.json", import.meta.url).href,
};
export function installLanguage(language: Language, copy: unknown) {
  if (
    !copy ||
    typeof copy !== "object" ||
    Array.isArray(copy) ||
    Object.values(copy).some((value) => typeof value !== "string")
  )
    throw new Error("Invalid language resource");
  Object.assign(dictionaries[language], copy);
  loaded.add(language);
}
export function loadLanguage(language: Language): Promise<void> {
  if (loaded.has(language)) return Promise.resolve();
  const existing = languages.get(language);
  if (existing) return existing;
  const loading = fetch(languageUrls[language], { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Language resource unavailable");
      installLanguage(language, await response.json());
    })
    .catch((error: unknown) => {
      languages.delete(language);
      throw error;
    });
  languages.set(language, loading);
  return loading;
}
type Values = Record<
  string,
  string | number | boolean | Date | null | undefined
>;
const cache = new Map<string, IntlMessageFormat>();
export function message(language: Language, key: MessageKey, values?: Values) {
  const id = `${language}:${key}`;
  let formatter = cache.get(id);
  if (!formatter) {
    const text = dictionaries[language][key];
    if (!text) throw new Error(`Missing translation: ${id}`);
    formatter = new IntlMessageFormat(text, language);
    cache.set(id, formatter);
  }
  const output = formatter.format(values);
  return Array.isArray(output) ? output.join("") : String(output);
}
type I18n = { language: Language; setLanguage: (language: Language) => void };
const LanguageContext = createContext<I18n>({
  language: "fr",
  setLanguage: () => {},
});
export function storedLanguage(): Language {
  try {
    return localStorage.getItem("rv.lang") === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(storedLanguage);
  const [failed, setFailed] = useState<Language>();
  const desired = useRef(language);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    document.title = "Rotavise";
    try {
      localStorage.setItem("rv.lang", language);
    } catch {
      /* Language still changes in memory. */
    }
  }, [language]);
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next: Language) => {
        desired.current = next;
        setFailed(undefined);
        if (loaded.has(next)) {
          setCurrentLanguage(next);
          return;
        }
        void loadLanguage(next).then(
          () => {
            if (desired.current === next) setCurrentLanguage(next);
          },
          () => {
            if (desired.current === next) setFailed(next);
          },
        );
      },
    }),
    [language],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
      {failed && (
        <div className="rv-ui" role="alert">
          <p>{message(language, "language.unavailable")}</p>
          <button
            type="button"
            className="rv-button rv-secondary"
            onClick={() => value.setLanguage(failed)}
          >
            {message(language, "common.retry")}
          </button>
        </div>
      )}
    </LanguageContext.Provider>
  );
}
export function DesignLanguage({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={{ language, setLanguage: () => {} }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useMessages() {
  const { language, setLanguage } = useContext(LanguageContext);
  return {
    language,
    setLanguage,
    t: (key: MessageKey, values?: Values) => message(language, key, values),
  };
}
