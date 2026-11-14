// Source-backed Darija names, selected without changing research spelling.
// The ten research batches and their source/audit files are the data module's
// inputs. Only confirmed ary records with a name and quote qualify. ar_only,
// nulls and flagged identities never enter the release.
import { readFile } from "node:fs/promises";

export const RESEARCH = "docs/evidence/catalog/2026-11-09/codex";
export const EXTRACTS = `${RESEARCH}/darija-0.13.0-quote-extracts.json`;
export const FLAGGED_CROPS = [
  "lambs-lettuce",
  "mung-bean",
  "citrus",
  "eucalyptus",
];
export const FLAGGED_CULTIVARS = ["prickly-pear/derbana"];
export const sourceId = (id) => `darija-${id.toLowerCase()}`;
export const squashQuote = (text) =>
  text.normalize("NFC").toLowerCase().replace(/\s+/g, "");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const confirmed = (n) =>
  n.status === "confirmed" &&
  typeof n.name === "string" &&
  n.name.trim().length > 0 &&
  typeof n.quote === "string" &&
  n.quote.trim().length > 0;

export async function releaseNames() {
  const crops = [];
  for (let i = 1; i <= 10; i++)
    crops.push(
      ...(await readJson(
        `${RESEARCH}/darija-batch-${String(i).padStart(2, "0")}.json`,
      )),
    );
  const cropNames = [];
  const cultivarNames = [];
  for (const crop of crops) {
    if (FLAGGED_CROPS.includes(crop.cropId)) continue;
    crop.ary.forEach((n, i) => {
      if (confirmed(n))
        cropNames.push({
          cropId: crop.cropId,
          researchWhere: `${crop.cropId}.ary.${i}`,
          ...n,
        });
    });
    for (const cultivar of crop.cultivars) {
      if (FLAGGED_CULTIVARS.includes(`${crop.cropId}/${cultivar.cultivarId}`))
        continue;
      cultivar.ary.forEach((n, i) => {
        if (confirmed(n))
          cultivarNames.push({
            cropId: crop.cropId,
            cultivarId: cultivar.cultivarId,
            researchWhere: `${crop.cropId}.cultivars.${cultivar.cultivarId}.ary.${i}`,
            ...n,
          });
      });
    }
  }
  return {
    crops,
    cropNames,
    cultivarNames,
    sources: await readJson(`${RESEARCH}/darija-sources.json`),
    audit: await readJson(`${RESEARCH}/darija-verification.json`),
  };
}
