import { writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const example = readFileSync(".env.example", "utf8");
try {
  writeFileSync(
    ".env",
    example.replace(
      "replace-with-local-random-token-at-least-32-characters",
      randomBytes(32).toString("hex"),
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log("Created local .env with a random development token");
} catch (error) {
  if (error.code === "EEXIST") console.log("Existing .env preserved");
  else throw error;
}
