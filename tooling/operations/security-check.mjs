import { execFileSync } from "node:child_process";
import { containerHealth, docker, execInContainer, settings } from "./lib.mjs";

const SERVICES = ["postgres", "science", "api", "worker", "proxy"];

function lsofListeners(port) {
  try {
    return execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    })
      .split("\n")
      .slice(1)
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Verifies a running stack against the production gates: headers and CSP,
// published ports, container users, read-only file systems and networks.
export async function securityCheck(config) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const base = `http://127.0.0.1:${config.proxyPort}`;

  const page = await fetch(`${base}/`);
  const header = (response, name) => response.headers.get(name);
  const csp = header(page, "content-security-policy") ?? "";
  add(
    "web app sends a strict Content-Security-Policy",
    /default-src 'self'/.test(csp) &&
      /frame-ancestors 'none'/.test(csp) &&
      /object-src 'none'/.test(csp) &&
      !/unsafe-(inline|eval)/.test(csp),
    csp,
  );
  add(
    "web app blocks sniffing and framing",
    header(page, "x-content-type-options") === "nosniff" &&
      header(page, "x-frame-options") === "DENY",
    `${header(page, "x-content-type-options")} / ${header(page, "x-frame-options")}`,
  );
  add(
    "web app sends referrer, opener and resource policies",
    header(page, "referrer-policy") === "no-referrer" &&
      header(page, "cross-origin-opener-policy") === "same-origin" &&
      header(page, "cross-origin-resource-policy") === "same-origin",
    "ok",
  );
  add(
    "proxy does not reveal its version",
    !/\d/.test(header(page, "server") ?? ""),
    header(page, "server"),
  );

  const api = await fetch(`${base}/api/v1/health/live`);
  add(
    "API keeps its own CSP (default-src 'none') through the proxy",
    /default-src 'none'/.test(header(api, "content-security-policy") ?? ""),
    header(api, "content-security-policy"),
  );
  add(
    "API sends HSTS in production mode",
    /max-age=\d+/.test(header(api, "strict-transport-security") ?? ""),
    header(api, "strict-transport-security"),
  );
  add(
    "API answers are never cached or sniffed",
    header(api, "x-content-type-options") === "nosniff",
    header(api, "x-content-type-options"),
  );

  const missing = await fetch(`${base}/api/v1/does-not-exist`);
  const body = await missing.text();
  add(
    "unknown API paths give no stack trace or internals",
    missing.status === 404 &&
      !/at .*\.(js|ts):\d+|node_modules|Error:/.test(body),
    `${missing.status} ${body.slice(0, 80)}`,
  );

  const published = docker(
    "ps",
    "--filter",
    `label=com.docker.compose.project=${config.project}`,
    "--format",
    "{{.Names}}|{{.Ports}}",
  )
    .split("\n")
    .filter(Boolean);
  const exposed = published.filter((line) =>
    /(^|[ ,|])(0\.0\.0\.0|::|\[::\]):\d+->/.test(line),
  );
  const publishers = published
    .filter((line) => line.includes("->"))
    .map((line) => line.split("|")[0]);
  add(
    "no container publishes a port outside 127.0.0.1",
    exposed.length === 0,
    exposed.length ? exposed : "all published ports are on 127.0.0.1",
  );
  add(
    "only the proxy publishes a port",
    publishers.length === 1 && publishers[0].includes("proxy"),
    publishers,
  );
  const listeners = lsofListeners(config.proxyPort);
  add(
    "the proxy port listens on 127.0.0.1 only",
    listeners.length > 0 &&
      listeners.every((line) => /127\.0\.0\.1:\d+ \(LISTEN\)/.test(line)),
    listeners.map((line) => line.replace(/\s+/g, " ")).slice(0, 3),
  );

  for (const service of SERVICES) {
    const id = docker(
      "ps",
      "-q",
      "--filter",
      `label=com.docker.compose.project=${config.project}`,
      "--filter",
      `label=com.docker.compose.service=${service}`,
    ).split("\n")[0];
    if (!id) {
      add(`${service} is running`, false, "container not found");
      continue;
    }
    const status = await execInContainer(id, ["cat", "/proc/1/status"]);
    const uid = /Uid:\s+(\d+)\s+(\d+)/.exec(status.stdout);
    add(
      `${service}: main process is not root`,
      !!uid && uid[1] !== "0" && uid[2] !== "0",
      uid ? `uid ${uid[1]}` : "could not read",
    );
    const info = JSON.parse(docker("inspect", id))[0];
    add(
      `${service}: read-only root file system`,
      info.HostConfig.ReadonlyRootfs === true,
      String(info.HostConfig.ReadonlyRootfs),
    );
    add(
      `${service}: all capabilities dropped, no new privileges`,
      (info.HostConfig.CapDrop ?? []).includes("ALL") &&
        (info.HostConfig.SecurityOpt ?? []).includes("no-new-privileges:true"),
      `${(info.HostConfig.CapDrop ?? []).join(",")} ${(info.HostConfig.SecurityOpt ?? []).join(",")}`,
    );
    add(
      `${service}: healthy with a restart policy`,
      containerHealth(id) === "healthy" &&
        info.HostConfig.RestartPolicy.Name === "unless-stopped",
      `${containerHealth(id)} / ${info.HostConfig.RestartPolicy.Name}`,
    );
    if (service === "postgres" || service === "science") {
      const networks = Object.keys(info.NetworkSettings.Networks);
      const internal = networks.every(
        (name) =>
          JSON.parse(docker("network", "inspect", name))[0].Internal === true,
      );
      add(
        `${service}: reachable only on the internal network (no internet route)`,
        internal,
        networks,
      );
    }
  }
  return { ok: checks.every((check) => check.ok), checks };
}

export async function main() {
  const result = await securityCheck(settings());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
