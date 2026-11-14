import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { disposable, poll, docker } from "../../tests/support/index.mjs";
import {
  planSession,
  submitPlan,
  planHttp,
} from "../../tests/support/plans.mjs";
const tag = "rotavise:local-verified";
execFileSync(
  "docker",
  ["build", "-f", "infra/docker/server.Dockerfile", "-t", tag, "."],
  { stdio: "inherit" },
);
const db = await disposable();
const network = `rotavise-network-${randomUUID()}`;
const names = [];
try {
  docker("network", "create", network);
  docker("network", "connect", network, db.name);
  const dbUrl = `postgresql://rotavise:disposable_only@${db.name}:5432/rotavise_test`;
  const importCatalog = () =>
    JSON.parse(
      docker(
        "run",
        "--rm",
        "--network",
        network,
        "-e",
        `DATABASE_URL=${dbUrl}`,
        tag,
        "node",
        "dist/entrypoints/catalog-import.main.js",
      ),
    );
  const firstImport = importCatalog();
  const repeatedImport = importCatalog();
  assert.deepEqual(
    firstImport.map((r) => [r.version, r.format, r.outcome]),
    [
      ["0.1.0", "1", "imported"],
      ["0.2.0", "2", "imported"],
      ["0.3.0", "2", "imported"],
      ["0.4.0", "2", "imported"],
      ["0.5.0", "2", "imported"],
      ["0.6.0", "2", "imported"],
      ["0.7.0", "2", "imported"],
      ["0.8.0", "2", "imported"],
      ["0.9.0", "2", "imported"],
      ["0.10.0", "2", "imported"],
      ["0.11.0", "2", "imported"],
      ["0.12.0", "2", "imported"],
      ["0.13.0", "2", "imported"],
      ["0.14.0", "2", "imported"],
      ["0.15.0", "2", "imported"],
    ],
  );
  assert.ok(repeatedImport.every((r) => r.outcome === "unchanged"));
  assert.deepEqual(
    firstImport.map((r) => r.snapshotId),
    repeatedImport.map((r) => r.snapshotId),
  );
  const [firstCatalog, secondCatalog, thirdCatalog] = firstImport;
  assert.equal(firstCatalog.profiles.length, 3);
  assert.ok(
    firstCatalog.profiles.every(
      (profile) => profile.readiness.status === "insufficient_evidence",
    ),
  );
  // Format 2 converts the same facts: no binding rule and the same gaps.
  assert.equal(secondCatalog.profiles.length, 3);
  assert.ok(
    secondCatalog.profiles.every((profile) => profile.bindingRules === 0),
  );
  // Release 0.3.0 adds quote-checked rules for five plannable crops.
  assert.equal(thirdCatalog.profiles.length, 10);
  assert.deepEqual(
    thirdCatalog.profiles
      .filter((profile) => profile.bindingRules > 0)
      .map((profile) => profile.id)
      .sort(),
    ["barley", "bread-wheat", "durum-wheat", "faba-bean", "sugar-beet"],
  );
  console.log(
    "PASS production container: committed catalogs imported, repeat idempotent, research gaps retained, 0.3.0 rules present",
  );
  const fixture = JSON.parse(
    readFileSync("tests/support/fixtures/engine.synthetic.json", "utf8"),
  );
  assert.equal(fixture.synthetic, true);
  const engineInput = structuredClone(fixture.input),
    engineContext = structuredClone(fixture.context);
  engineInput.preferences.considered_next_crop_ids = [
    "durum-wheat",
    "unsupported-crop",
  ];
  engineContext.region = { status: "unresolved" };
  engineContext.productionSystem = null;
  engineContext.cultivars = [];
  const engineProbe = `
    import assert from 'node:assert/strict';
    import {generateSequences,assessHistoricalSequences,measureHistoricalWindow} from '@rotavise/domain';
    import {loadCatalogRelease} from './dist/modules/catalog/importing/load-release.js';
    const catalog=await loadCatalogRelease('./data/catalog/releases/0.1.0');
    const research=await loadCatalogRelease('./data/catalog/releases/0.14.0');
    const benefits=await loadCatalogRelease('./data/catalog/releases/0.15.0');
    assert.equal(benefits.profiles.length,246);
    assert.ok(benefits.profiles.every(p=>p.research.benefits.version==='benefits-2' && new Set(p.research.benefits.records.map(f=>f.category)).size===12));
    assert.equal(research.profiles.length,246);
    assert.equal(research.profiles.filter(p=>p.research.benefits.findings.length).length,45);
    assert.equal(research.profiles.reduce((n,p)=>n+p.research.income.facts.length,0),654);
    const result=generateSequences(${JSON.stringify(engineInput)},catalog,${JSON.stringify(engineContext)});
    assert.equal(result.outcome,'insufficient_evidence');assert.equal(result.counts.schedules,0);assert.equal(result.recommendations,null);
    assert.equal(result.catalog.sha256,'d951b9c07b03739a77d43d0518c68ebc13b80d805fa58dcd076ef9cd82ed3a55');
    assert.throws(()=>generateSequences({}, {...catalog,synthetic:true}, {}), /CATALOG_SYNTHETIC_REJECTED/);
    const climate=assessHistoricalSequences(${JSON.stringify(engineInput)},catalog,${JSON.stringify(engineContext)},[],{version:'historical-policy-1',firstAnchorYear:2010,lastAnchorYear:2015,splitAfterYear:2012,minimumCompleteAnalogs:4,minimumPeriodAnalogs:2});
    assert.equal(climate.outcome,'insufficient_evidence');assert.equal(climate.candidates.length,0);assert.equal(climate.recommendations,null);
    const window=measureHistoricalWindow({location:{latitude:32.3,longitude:-6.3},assessedOn:'2029-01-01',startDate:'2010-01-01',endDate:'2010-01-02'},[]);
    assert.equal(window.expectedDays,2);assert.equal(window.metrics.precipitation,null);
    assert.throws(()=>assessHistoricalSequences({}, {...catalog,synthetic:true}, {}, [], {}), /CATALOG_SYNTHETIC_REJECTED/);
  `;
  docker(
    "run",
    "--rm",
    tag,
    "node",
    "--input-type=module",
    "--eval",
    engineProbe,
  );
  console.log(
    "PASS production engine: packaged Temporal/ESM, unchanged real evidence gaps, synthetic evidence rejected",
  );
  docker(
    "run",
    "--rm",
    tag,
    "node",
    "--input-type=module",
    "--eval",
    `
    import assert from 'node:assert/strict';
    import {createPasswordHasher} from './dist/modules/auth/application/password.js';
    const passwords=createPasswordHasher(), password='ExplicitlySyntheticContainerPassword_07!';
    const encoded=await passwords.hash(password);
    assert.match(encoded,/^\\$argon2id\\$v=19\\$m=65536,t=3,p=1\\$/);
    assert.equal(await passwords.verify({password,hash:encoded}),true);
    assert.equal(await passwords.verify({password:'incorrect',hash:encoded}),false);
    assert.equal(await passwords.verify({password,hash:encoded.replace('m=65536','m=999999999')}),false);
  `,
  );
  console.log(
    "PASS production Linux native Argon2id: supported parameters, correct/incorrect password and corrupt work-factor rejection",
  );
  const weatherToken = randomUUID() + randomUUID();
  let intakeId;
  for (const entry of ["api", "worker"]) {
    const name = `rotavise-${entry}-${randomUUID()}`;
    names.push(name);
    docker(
      "run",
      "-d",
      "--name",
      name,
      "--network",
      network,
      "-e",
      `DATABASE_URL=${dbUrl}`,
      "-e",
      "PLANS_ENABLED=true",
      "-e",
      "PLANNING_ENABLED=true",
      ...(entry === "api"
        ? [
            "-e",
            "TRUST_PROXY=false",
            "-e",
            "WEATHER_ENABLED=true",
            "-e",
            `WEATHER_INTERNAL_TOKEN=${weatherToken}`,
          ]
        : []),
      "-p",
      `127.0.0.1::${entry === "api" ? 3000 : 3001}`,
      tag,
      "node",
      `dist/entrypoints/${entry}.main.js`,
    );
    const port = docker("port", name, `${entry === "api" ? 3000 : 3001}/tcp`)
      .split(":")
      .at(-1);
    const origin = `http://127.0.0.1:${port}`;
    const path = entry === "api" ? "/api/v1/health/ready" : "/health/ready";
    await poll(
      async () => {
        const response = await fetch(origin + path);
        if (entry !== "api") return response.status === 200;
        const status = await response.json();
        // This deliberately partial disposable database must fail readiness even
        // though the compiled API and dependencies work.
        assert.equal(response.status, 503);
        assert.equal(status.dataCompleteness.ok, false);
        return status.dependenciesReady;
      },
      {
        label: `compiled ${entry} container readiness`,
      },
    );
    assert.notEqual(docker("exec", name, "id", "-u"), "0");
    if (entry === "api") {
      const planApi = { origin };
      const owner = await planSession(planApi),
        other = await planSession(planApi);
      const accepted = await submitPlan(planApi, owner.accessToken);
      intakeId = accepted.id;
      assert.equal(
        (
          await planHttp(planApi, "/api/v1/plans/" + intakeId, {
            token: other.accessToken,
          })
        ).status,
        404,
      );
      assert.equal(
        (await planHttp(planApi, "/api/v1/plans/" + intakeId)).status,
        401,
      );
      console.log(
        "PASS production planning: guest ownership, private HTTP acceptance, no test fault routes",
      );
      assert.equal(
        (await fetch(origin + "/api/v1/internal/weather/capabilities")).status,
        401,
      );
      const capabilities = await fetch(
        origin + "/api/v1/internal/weather/capabilities",
        { headers: { "x-weather-token": weatherToken } },
      );
      assert.equal(capabilities.status, 200);
      const weather = await capabilities.json();
      assert.equal(weather.adapterVersion, "3");
      assert.equal(weather.location, "source-cell-centre-not-farm-position");
      assert.equal(weather.variables.length, 7);
      assert.deepEqual(
        weather.variables.find((v) => v.id === "solarRadiation")
          .sourceResolution,
        {
          latitudeDegrees: 1,
          longitudeDegrees: 1,
          basis: "documented-source-grid-not-field-resolution",
        },
      );
      assert.equal(
        weather.variables.find((v) => v.id === "solarRadiation").earliestDate,
        "2001-01-01",
      );
      console.log(
        "PASS production weather capabilities protected by internal token",
      );
      for (const [path, method] of [
        ["/api/v1/dev/test-jobs", "POST"],
        [`/api/v1/dev/test-jobs/${randomUUID()}`, "GET"],
      ])
        assert.equal((await fetch(origin + path, { method })).status, 404);
    }
    if (entry === "worker") {
      assert.equal((await fetch(origin + "/health/operations")).status, 404);
      const operations = JSON.parse(
        docker(
          "exec",
          name,
          "node",
          "-e",
          "fetch('http://127.0.0.1:3001/health/operations').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())})",
        ),
      );
      assert.ok(operations.disk.freeBytes > 0);
      assert.ok(Array.isArray(operations.ingests));
      console.log(
        "PASS worker operations: loopback-only metrics, denied over published port",
      );
      await poll(
        async () =>
          (
            await db.pool.query(
              "SELECT status FROM planning_runs WHERE request_id=$1",
              [intakeId],
            )
          ).rows[0]?.status === "completed",
        { label: "production container planning completion" },
      );
      const result = (
        await db.pool.query(
          "SELECT result FROM planning_runs WHERE request_id=$1",
          [intakeId],
        )
      ).rows[0].result;
      assert.equal(result.kind, "planning_assessment");
      assert.equal(result.synthetic, false);
      assert.equal(result.assessment.outcome, "insufficient_evidence");
      assert.equal(result.assessment.recommendations, null);
      assert.equal(result.assessment.sequence.counts.schedules, 0);
      console.log(
        "PASS production worker: durable full pipeline, one result, no invented agricultural output",
      );
    }
    docker("stop", "-t", "10", name);
    assert.equal(docker("inspect", "-f", "{{.State.ExitCode}}", name), "0");
    console.log(
      `PASS ${entry}: non-root production container, ready, graceful exit`,
    );
  }
  const unsafe = execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `DATABASE_URL=${dbUrl}`,
      "-e",
      "DEV_HARNESS_ENABLED=true",
      "-e",
      "DEV_HARNESS_TOKEN=" + "x".repeat(32),
      tag,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  throw new Error(`Unsafe configuration unexpectedly started: ${unsafe}`);
} catch (error) {
  if (error.status === 1 && String(error.stderr).includes("API_START_FAILED"))
    console.log("PASS unsafe production harness configuration rejected");
  else throw error;
} finally {
  for (const name of names) docker("rm", "-f", name);
  await db.close();
  docker("network", "rm", network);
}
