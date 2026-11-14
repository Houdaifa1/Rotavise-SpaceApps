import font0 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url";
import font1 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-400-normal.woff2?url";
import font2 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url";
import font3 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-500-normal.woff2?url";
import font4 from "@fontsource/fraunces/files/fraunces-latin-500-normal.woff2?url";
import font5 from "@fontsource/fraunces/files/fraunces-latin-ext-500-normal.woff2?url";
import font6 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import font7 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff2?url";
import font8 from "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url";
import font9 from "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2?url";
export const fontUrls = [
  font0,
  font1,
  font2,
  font3,
  font4,
  font5,
  font6,
  font7,
  font8,
  font9,
];
export function preloadFonts() {
  for (const href of fontUrls) {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.append(link);
  }
}
export function preloadAppFonts() {
  // The map uses UI type only; avoid downloading the welcome headline face
  // on its critical path, and fetch its medium UI weight before first layout.
  const welcome = window.location.pathname === "/";
  for (const href of [font0, welcome ? font4 : font2]) {
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.append(link);
  }
}
