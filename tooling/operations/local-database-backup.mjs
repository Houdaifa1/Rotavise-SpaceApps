// Existing snapshot-consistent backup and restore drill, for the consolidated
// local database before the production Compose stack is activated.
import { resolve } from "node:path";
import { backup, listBackups } from "./backup.mjs";
import { restoreDrill } from "./restore-drill.mjs";
import { container, databasePool, assertContainer } from "./database-tools.mjs";
const pool = databasePool();
try {
  await assertContainer(pool);
  const dir = resolve(process.env.ROTAVISE_BACKUP_DIR ?? ".artifacts/backups");
  const drillOnly = process.argv.includes("--drill-only");
  const result = drillOnly
    ? null
    : await backup({
        container,
        database: "rotavise",
        dir,
        compression: "zstd:3",
      });
  if (result)
    console.log(
      JSON.stringify({
        event: "backup_done",
        file: result.file,
        sha256: result.sha256,
        tables: result.manifest.tables,
      }),
    );
  if (drillOnly || process.argv.includes("--restore-drill")) {
    const file =
      process.argv.find((arg) => arg.startsWith("--file="))?.slice(7) ??
      result?.name ??
      (await listBackups(dir))[0]?.name;
    if (!file) throw Error("NO_BACKUP");
    const drill = await restoreDrill({ dir, image: null, file });
    console.log(JSON.stringify(drill, null, 2));
    if (!drill.ok) process.exitCode = 1;
  }
} catch {
  console.error("LOCAL_DATABASE_BACKUP_OR_DRILL_FAILED");
  process.exitCode = 1;
} finally {
  await pool.end();
}
