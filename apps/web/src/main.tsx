import { createRoot } from "react-dom/client";
import { preloadAppFonts } from "./design/fonts.js";
import { preloadBootReads } from "./app/boot-transport.js";
import { App } from "./app/App.js";
import { loadLanguage, storedLanguage } from "./i18n/messages.js";
const root = document.getElementById("root")!;
if (import.meta.env.DEV && window.location.pathname === "/design") {
  void Promise.all([
    import("./design/showcase/Showcase.js"),
    loadLanguage("fr"),
    loadLanguage("en"),
  ]).then(([{ mountDesign }]) => mountDesign(root));
} else {
  preloadBootReads();
  preloadAppFonts();
  const view = createRoot(root);
  const start = async () => {
    const language = storedLanguage();
    try {
      await loadLanguage(language);
      view.render(<App />);
    } catch {
      document.documentElement.lang = language;
      view.render(
        <main className="rv-ui f1-page">
          <h1>Rotavise</h1>
          <p role="alert">
            {language === "fr"
              ? "La langue n’a pas pu être chargée. Réessayez."
              : "The language could not be loaded. Try again."}
          </p>
          <button
            type="button"
            className="rv-button rv-primary"
            onClick={() => void start()}
          >
            {language === "fr" ? "Réessayer" : "Try again"}
          </button>
        </main>,
      );
    }
  };
  void start();
}
