import { freePort } from "./polling.mjs";
// The Playwright config chooses these once; its workers inherit the variables,
// so the Vite proxy, the test API and the browser all agree on the same ports.
const names = { api: "ROTAVISE_E2E_API_PORT", web: "ROTAVISE_E2E_WEB_PORT" };
export async function chooseBrowserPorts() {
  if (!process.env[names.api] || !process.env[names.web]) {
    const api = await freePort();
    let web = await freePort();
    while (web === api) web = await freePort();
    process.env[names.api] = String(api);
    process.env[names.web] = String(web);
  }
  return browserPorts();
}
export function browserPorts() {
  const api = Number(process.env[names.api]),
    web = Number(process.env[names.web]);
  if (!Number.isInteger(api) || !Number.isInteger(web) || api === web)
    throw new Error("BROWSER_PORTS_UNSET");
  return {
    api,
    web,
    apiOrigin: `http://127.0.0.1:${api}`,
    webOrigin: `http://127.0.0.1:${web}`,
  };
}
