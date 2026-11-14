import { randomUUID } from "node:crypto";
import { docker } from "./database.mjs";
import { freePort, poll } from "./polling.mjs";
export const TEST_PASSWORD = "ExplicitlySyntheticPassword_07!";
export async function disposableMail() {
  const name = `rotavise-mail-test-${randomUUID()}`;
  const smtpPort = await freePort(),
    httpPort = await freePort();
  docker(
    "run",
    "-d",
    // Removed automatically when stopped, even if a test run is interrupted.
    "--rm",
    "--label",
    "rotavise.disposable=true",
    "--name",
    name,
    "-p",
    `127.0.0.1:${smtpPort}:1025`,
    "-p",
    `127.0.0.1:${httpPort}:8025`,
    "axllent/mailpit:v1.31.3@sha256:ed9b00c609e77e99c79b93f1178255ebc271868920f2c69a8d166bd5634ed10d",
  );
  const origin = `http://127.0.0.1:${httpPort}`;
  try {
    await poll(async () => (await fetch(origin + "/api/v1/messages")).ok, {
      label: "disposable SMTP inbox",
    });
  } catch (error) {
    docker("rm", "-f", name);
    throw error;
  }
  return {
    name,
    smtpPort,
    origin,
    async message(email) {
      const list = await (await fetch(origin + "/api/v1/messages")).json();
      const found = list.messages.find((m) =>
        m.To.some((t) => t.Address === email),
      );
      return found
        ? (await fetch(origin + "/api/v1/message/" + found.ID)).json()
        : null;
    },
    close() {
      docker("rm", "-f", name);
    },
  };
}
export function authInject(app, path, body, cookie) {
  return app.inject({
    method: "POST",
    url: "/api/auth/" + path,
    headers: {
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    payload: body,
  });
}
export function sessionCookie(response) {
  const headers = response.headers["set-cookie"];
  return (Array.isArray(headers) ? headers : [headers])
    .filter(Boolean)
    .map((v) => v.split(";")[0])
    .join("; ");
}
