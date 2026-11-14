// Offline research assembly from saved primary-source snapshots and explicitly
// labelled model knowledge. Never fetches, changes an older release or adds income.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { format } from "prettier";
const root = "docs/evidence/catalog/2026-11-11/benefits";
const base = "data/catalog/releases/0.14.0";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = async (p, v) =>
  writeFile(p, await format(JSON.stringify(v), { parser: "json" }));
const sha = (v) => createHash("sha256").update(v).digest("hex");
const sources = await read(`${root}/benefits-sources.json`);
const texts = new Map();
for (const source of sources) {
  if (
    sha(await readFile(source.savedFile)) !== source.sha256 ||
    sha(await readFile(source.textFile)) !== source.textSha256
  )
    throw new Error(`SOURCE_HASH ${source.id}`);
  texts.set(source.id, await readFile(source.textFile, "utf8"));
}
const manifest = await read(`${base}/manifest.json`);
const profiles = await Promise.all(
  manifest.profileFiles.map((p) => read(`${base}/${p}`)),
);
const categories = [
  "biological_nitrogen_fixation",
  "residual_nitrogen_credit",
  "forage_residue_feed",
  "disease_break",
  "weed_break",
  "pest_break",
  "rooting_soil_structure_infiltration",
  "erosion_cover_residue",
  "bare_soil_period_shortening",
  "organic_matter_soil_carbon",
  "drought_tolerance",
  "water_demand",
];
const set = (s) => new Set(s.split(" "));
const cereals = set(
  "barley bread-wheat durum-wheat spelt oat black-oat rye triticale maize sweet-corn rice sorghum pearl-millet foxtail-millet finger-millet teff",
);
const covers = set(
  "annual-medic berseem common-vetch hairy-vetch bitter-vetch crimson-clover persian-clover subterranean-clover white-clover red-clover alfalfa sulla sainfoin italian-ryegrass perennial-ryegrass tall-fescue phalaris cocksfoot sudan-grass forage-rape oilseed-radish phacelia",
);
const oils = set(
  "sunflower safflower sesame rapeseed camelina flax groundnut soybean castor chia",
);
const roots = set(
  "sugar-beet fodder-beet table-beet potato sweet-potato cassava taro jerusalem-artichoke cotton sugarcane tobacco hemp cannabis",
);
const woody = set(
  "argan carob acacia-raddiana acacia-saligna oleaster holm-oak cork-oak aleppo-pine atlas-cedar stone-pine thuya juniper-cade lentisk dwarf-palm strawberry-tree ziziphus-lotus bay-laurel myrtle cistus sumac",
);
const droughtHigh = set(
  "sorghum pearl-millet finger-millet foxtail-millet teff cowpea chickpea lentil grass-pea safflower sesame quinoa amaranth cassava sweet-potato sulla sainfoin annual-medic subterranean-clover atriplex caper olive oleaster argan almond pistachio carob jujube ziziphus-lotus jojoba prickly-pear aloe-vera date-palm esparto acacia-raddiana acacia-saligna rosemary thyme wild-thyme sage lavender oregano artemisia cistus lentisk holm-oak cork-oak aleppo-pine stone-pine thuya",
);
const droughtLow = set(
  "rice banana kiwi avocado strawberry raspberry blueberry lettuce celery celeriac spinach chard watercress mint taro sugarcane potato pepper chilli cucumber gherkin spring-onion onion leek garlic berseem white-clover",
);
const unsafeFeed = set(
  "tobacco castor rue ammi-visnaga desert-truffle oleander",
);
const cautiousFeed = set(
  "potato tomato eggplant chilli pepper cassava sorghum sudan-grass grass-pea bitter-vetch groundnut hemp cannabis pennyroyal juniper-cade thuya eucalyptus",
);
const highWater = set(
  "alfalfa berseem white-clover banana sugarcane rice taro avocado kiwi citrus sweet-orange mandarin grapefruit lemon bitter-orange date-palm walnut pecan mango lychee papaya perennial-ryegrass mint",
);
const lowWater = set(
  "lentil chickpea grass-pea quinoa sesame safflower camelina caper jojoba prickly-pear aloe-vera rosemary thyme wild-thyme lavender sage oregano esparto atriplex",
);
function group(p) {
  if (covers.has(p.id) || p.harvestProduct === "forage") return "forage_cover";
  if (cereals.has(p.id)) return "cereals";
  if (oils.has(p.id)) return "oilseeds";
  if (roots.has(p.id)) return "roots_industrial";
  if (p.modelType === "orchard" || woody.has(p.id)) return "orchard_perennial";
  if (p.identity.family === "Fabaceae") return "grain_legumes";
  if (
    p.modelType === "wild_harvested" ||
    p.modelType === "multi_year_stand" ||
    p.harvestProduct === "aromatic"
  )
    return "aromatic_wild_other";
  return "vegetables_other_annuals";
}
const records = new Map(profiles.map((p) => [p.id, []]));
function finding(
  p,
  category,
  effect,
  value,
  unit,
  confidence = "medium",
  reason,
) {
  const id = `b4.${p.id}.${category}.recall`;
  const perennial = p.modelType === "orchard" || woody.has(p.id);
  const conditions = [
    perennial
      ? "Established perennial; ground-cover effects require protected orchard floor or retained litter, not tree canopy alone."
      : "Established crop; residues retained where safe; timing, cultivar, soil and management affect the outcome.",
  ];
  const isRange = value && typeof value === "object";
  return {
    id,
    cropId: p.id,
    effectCategory: category,
    status: reason ? "not_found" : "model_recall",
    effect,
    direction: "context_dependent",
    magnitude: {
      status: reason ? "not_applicable" : "model_recall",
      ...(isRange ? value : { value }),
      unit,
    },
    conditions,
    rotationContext: null,
    sourceId: null,
    quote: null,
    regionApplicability: {
      countryCode: null,
      region: "General agronomic knowledge; not a Moroccan field measurement",
      nonLocal: true,
    },
    ...(reason
      ? { applicability: "not_applicable", notFoundReason: reason }
      : {}),
    recall: {
      confidence,
      basis: `Model recalls ${p.identity.name} (${p.identity.family}) agronomy for ${category.replaceAll("_", " ")}; ${reason ?? "qualitative management-dependent potential, not a measured response or a fertilizer recommendation"}. No source was consulted for this record.`,
      valueKind: "model_recall_unverified",
      recordedOn: "2026-11-11",
      researchItem: id,
    },
    plannerUse: "conditional_context",
  };
}
for (const p of profiles) {
  const id = p.id,
    family = p.identity.family,
    g = group(p),
    fixer = family === "Fabaceae" && id !== "carob",
    perennial =
      p.modelType === "multi_year_stand" ||
      p.modelType === "orchard" ||
      woody.has(id),
    orchard = g === "orchard_perennial",
    fungus = id === "desert-truffle";
  const add = (...args) => records.get(id).push(finding(p, ...args));
  const nRange = ["alfalfa", "berseem", "white-clover", "red-clover"].includes(
    id,
  )
    ? { min: 50, max: 300 }
    : [
          "faba-bean",
          "white-lupin",
          "narrow-leaf-lupin",
          "yellow-lupin",
          "soybean",
          "sulla",
          "sainfoin",
        ].includes(id)
      ? { min: 40, max: 200 }
      : { min: 20, max: 120 };
  add(
    "biological_nitrogen_fixation",
    fixer
      ? "Can fix atmospheric N through compatible root-nodule bacteria; drought, mineral N and poor nodulation reduce fixation. This is total fixation, not N available to the next crop."
      : "Not applicable: no conventional symbiotic crop N-fixation trait; associated free-living microbes are not a crop nitrogen credit.",
    fixer ? nRange : "not applicable",
    "kg N/ha per crop period",
    fixer ? "low" : "high",
    fixer
      ? undefined
      : id === "carob"
        ? "Carob is a non-nodulating legume; Fabaceae identity alone does not establish fixation."
        : fungus
          ? "Fungal fruiting body; no legume root-nodule symbiosis."
          : "Crop does not have the conventional legume root-nodule fixation system.",
  );
  add(
    "residual_nitrogen_credit",
    fixer
      ? "Retained roots and residues may release N to a following non-legume; seed or forage removal can leave little credit. Do not deduct this estimate from fertilizer without local soil/adviser checks."
      : "Residues may recycle N already taken from soil; no new fixed-N credit. High-carbon residues may temporarily immobilize N. Quantity to the next crop is not quantified.",
    fixer
      ? g === "forage_cover" && perennial
        ? { min: 0, max: 100 }
        : { min: 0, max: 60 }
      : "recycling only; net credit unquantified",
    "kg N/ha to following crop",
    "low",
    fungus
      ? "Harvested fungal fruiting body has no crop-residue N credit in this rotation model."
      : undefined,
  );
  let feed = unsafeFeed.has(id)
    ? "Not applicable as routine forage or straw: unsuitable or toxic material; no feeding recommendation."
    : cereals.has(id)
      ? "Straw or stover can supply roughage; mature cereal residues have low protein and digestibility and need a balanced ration."
      : covers.has(id) || fixer
        ? "Potential forage or legume haulm with useful protein; maturity, harvest losses and anti-nutritional compounds control feeding value."
        : orchard
          ? "Selected leaves, pods or processing residues may have feed uses; woody prunings are not routine forage and species-specific safety and ration checks are essential."
          : "Some clean crop residues may supplement feed; moisture, spoilage, contaminants and anti-nutritional compounds must be checked; not a complete ration.";
  if (cautiousFeed.has(id))
    feed =
      "Feed use is conditional on species-specific safety checks: toxins or anti-nutritional compounds may make foliage, stressed growth or untreated residues unsafe. Do not feed unchecked material.";
  add(
    "forage_residue_feed",
    feed,
    unsafeFeed.has(id)
      ? "not applicable"
      : covers.has(id) || fixer
        ? "potential protein/roughage"
        : "conditional roughage or residue",
    "qualitative feed value",
    cautiousFeed.has(id) || (!cereals.has(id) && !fixer) ? "low" : "medium",
    unsafeFeed.has(id)
      ? "Harvested material is not suitable as routine forage or straw; toxicity or non-forage fungal crop."
      : undefined,
  );
  const breakCondition = fungus
    ? "Truffle fungi depend on host vegetation; a fungal family change is not an annual plant rotation break. Manage the named host and pathogen locally."
    : orchard
      ? "A standing perennial is not an annual rotation break; assess a separately managed orchard-floor crop and its hosts."
      : `A following crop outside ${family} may interrupt family-associated specialist cycles; shared and wide-host-range organisms can persist.`;
  add(
    "disease_break",
    `${breakCondition} Repeating ${family} can maintain family-associated disease inoculum. Crop family alone does not prove a disease-free interval.`,
    "conditional family break",
    "qualitative next-crop disease effect",
    "medium",
  );
  add(
    "pest_break",
    `${breakCondition} Host weeds, volunteers and broad-host-range pests can bridge the interval; verify the named pest and next crop.`,
    "conditional host interruption",
    "qualitative next-crop pest effect",
    "medium",
  );
  add(
    "weed_break",
    `${covers.has(id) || cereals.has(id) ? "A dense competitive stand may shade weeds." : "Changing sowing season and cultivation may change weed pressure."} Volunteers or seed return can offset suppression; no herbicidal effect or numerical reduction is assumed.`,
    "management-dependent weed pressure",
    "qualitative weed effect",
    "medium",
  );
  add(
    "rooting_soil_structure_infiltration",
    fungus
      ? "Not applicable to rooting depth: truffles are fungi associated with host roots. Root channels belong to the host vegetation."
      : `${cereals.has(id) || family === "Poaceae" ? "Fibrous roots bind topsoil and leave small channels." : orchard ? "Established perennial roots occupy soil over multiple years; rooting and orchard-floor infiltration depend on soil and management." : family === "Brassicaceae" || fixer || oils.has(id) ? "Taproots and laterals can explore soil and leave channels after decay; hardpans can still restrict penetration." : "Roots and their decay add pores locally; depth is limited by soil, water table and compaction."} Potential improvement is not a measured infiltration rate.`,
    fungus ? "not applicable" : "root channels; depth not quantified",
    "qualitative rooting/infiltration effect",
    "medium",
    fungus
      ? "Fungal crop has no own root system; host-tree depth must not be assigned to truffles."
      : undefined,
  );
  add(
    "erosion_cover_residue",
    fungus
      ? "Not applicable as a crop canopy or residue cover; erosion protection depends on host vegetation and ground management."
      : `${orchard ? "Litter and maintained orchard-floor vegetation can protect soil; tree canopy with bare interrows can still permit erosion." : "Living cover and retained surface residue can cushion rain and reduce exposed soil."} No crop-specific management C factor is recalled; tillage, cover fraction and season must be specified.`,
    fungus ? "not applicable" : "protective cover potential; C unquantified",
    "dimensionless RUSLE C (unquantified)",
    "medium",
    fungus
      ? "Underground fungal fruiting body provides no living surface crop cover."
      : undefined,
  );
  add(
    "bare_soil_period_shortening",
    fungus
      ? "Not applicable: an underground fungal crop has no sow-to-harvest surface-cover calendar."
      : `${perennial ? "A maintained perennial stand can extend living-root presence; canopy gaps and harvest disturbance may still expose soil." : covers.has(id) ? "An established cover between main crops can shorten bare periods if the water balance permits timely termination." : "The crop covers part of its growing season; an intercrop or retained residue is needed for gaps after harvest."} No reduction in days is estimated without a comparison calendar.`,
    fungus ? "not applicable" : "calendar-dependent cover duration",
    "day (not quantified)",
    "medium",
    fungus
      ? "No surface crop canopy calendar for the fungal fruiting body."
      : undefined,
  );
  add(
    "organic_matter_soil_carbon",
    fungus
      ? "Fungal growth participates in soil carbon turnover; harvesting truffles is not a measurable soil-carbon addition. Host vegetation and litter dominate management effects."
      : `${orchard ? "Retained litter, safe chipped prunings and orchard-floor cover can return organic material." : "Retained roots and healthy residues return organic material; removal or burning reduces the input."} Decomposition, tillage and water balance determine net soil C; no sequestration rate is claimed.`,
    "conditional organic inputs; net C unquantified",
    "soil C contribution (qualitative)",
    "medium",
  );
  add(
    "drought_tolerance",
    `${droughtHigh.has(id) ? "Relatively drought tolerant once established" : droughtLow.has(id) ? "Sensitive to water shortage, especially during active growth" : "Moderate or variable drought response"}; establishment and reproductive stages may remain sensitive. Survival under drought does not establish low seasonal water demand.`,
    droughtHigh.has(id)
      ? "relatively tolerant"
      : droughtLow.has(id)
        ? "sensitive"
        : "moderate/variable",
    "qualitative drought tolerance",
    droughtHigh.has(id) || droughtLow.has(id) ? "medium" : "low",
  );
  add(
    "water_demand",
    `${highWater.has(id) ? "High seasonal demand under productive, full-cover management" : lowWater.has(id) ? "Relatively low to moderate seasonal demand with a suitable short or water-conserving cycle" : "Moderate or management-dependent seasonal demand"}; climate, cycle length and crop coefficient determine ET. Rainfall and soil storage must be deducted to assess irrigation; drought survival is a separate trait.`,
    highWater.has(id)
      ? "high"
      : lowWater.has(id)
        ? "low to moderate"
        : "moderate/variable",
    "qualitative seasonal ET class",
    "low",
  );
}
function sourced(
  cropIds,
  category,
  sourceId,
  quote,
  effect,
  magnitude,
  conditions,
  region = "Global reference; not validated on this Moroccan field",
  nonLocal = true,
  locator = "visible text",
) {
  const s = sources.find((s) => s.id === sourceId),
    text = texts.get(sourceId);
  if (!s || !text.includes(quote))
    throw new Error(`QUOTE_NOT_FOUND ${sourceId} ${quote.slice(0, 80)}`);
  const line = text.slice(0, text.indexOf(quote)).split("\n").length;
  for (const id of cropIds.split(" ")) {
    if (!records.has(id)) throw new Error(`UNKNOWN_CROP ${id}`);
    records.get(id).push({
      id: `b4.${id}.${category}.${sourceId}`,
      cropId: id,
      effectCategory: category,
      status: "sourced",
      effect,
      direction: "context_dependent",
      magnitude,
      conditions,
      rotationContext: null,
      sourceId,
      quote: {
        original: quote,
        locator: { section: locator, lineStart: line, textFile: s.textFile },
      },
      regionApplicability: {
        countryCode: nonLocal ? null : "MA",
        region,
        nonLocal,
      },
      plannerUse: "conditional_context",
    });
  }
}
// Literal rows in FAO-56 Table 22. Grouped labels retain their source scope.
const rootRows = [
  ["broccoli", "Broccoli"],
  ["brussels-sprout", "Brussel Sprouts"],
  ["cabbage", "Cabbage"],
  ["carrot", "Carrots"],
  ["parsnip", "Parsnip"],
  ["turnip", "Turnip (and Rutabaga)"],
  ["cauliflower", "Cauliflower"],
  ["celery", "Celery"],
  ["garlic", "Garlic"],
  ["lettuce", "Lettuce"],
  ["onion spring-onion", "Onions"],
  ["spinach", "Spinach"],
  ["radish", "Radishes"],
  ["eggplant", "Egg Plant"],
  ["pepper", "Sweet Peppers (bell)"],
  ["tomato", "Tomato"],
  ["melon", "Sweet Melons"],
  ["cucumber", "Cucumber"],
  ["pumpkin", "Pumpkin, Winter Squash"],
  ["courgette", "Squash, Zucchini"],
  ["watermelon", "Watermelon"],
  ["potato", "Potato"],
  ["sweet-potato", "Sweet Potato"],
  ["sugar-beet", "Sugar Beet"],
  ["green-bean", "Beans, green"],
  ["dry-bean", "Beans, dry and Pulses"],
  ["lima-bean", "Beans, lima, large vines"],
  ["chickpea", "Chick pea"],
  ["faba-bean", "Fababean (broad bean)"],
  ["mung-bean cowpea", "Green Gram and Cowpeas"],
  ["groundnut", "Groundnut (Peanut)"],
  ["lentil", "Lentil"],
  ["pea", "Peas"],
  ["soybean", "Soybeans"],
  ["artichoke", "Artichokes"],
  ["asparagus", "Asparagus"],
  ["mint", "Mint"],
  ["strawberry", "Strawberries"],
  ["cotton", "Cotton"],
  ["flax", "Flax"],
  ["castor", "Castorbean (Ricinus)"],
  ["rapeseed", "Rapeseed, Canola"],
  ["safflower", "Safflower"],
  ["sesame", "Sesame"],
  ["sunflower", "Sunflower"],
  ["barley", "Barley"],
  ["oat", "Oats"],
  ["bread-wheat durum-wheat", "Spring Wheat"],
  ["maize", "Maize, Field (grain) (field corn)"],
  ["sweet-corn", "Maize, Sweet (sweet corn)"],
  ["pearl-millet", "Millet"],
  ["sorghum", "Sorghum"],
  ["rice", "Rice"],
  ["alfalfa", "Alfalfa"],
  ["berseem", "Clover hay, Berseem"],
  ["italian-ryegrass perennial-ryegrass", "Rye Grass hay"],
  ["sudan-grass", "Sudan Grass hay (annual)"],
  ["sugarcane", "k. Sugar Cane"],
  ["banana", "Banana"],
  ["date-palm", "Date Palms"],
  ["pineapple", "Pineapple"],
  ["grapevine", "Grapes"],
  ["almond", "Almonds"],
  ["apple cherry pear", "Apples, Cherries, Pears"],
  ["apricot peach plum", "Apricots, Peaches, Stone Fruit"],
  ["avocado", "Avocado"],
  ["citrus", "Citrus"],
  ["kiwi", "Kiwi"],
  ["olive", "Olives (40 to 60% ground coverage by canopy)"],
  ["pistachio", "Pistachios"],
  ["walnut", "Walnut Orchard"],
];
const rootText = texts.get("fao-roots");
for (const [ids, term] of rootRows) {
  const start = rootText.indexOf(
    `${term} |`,
    rootText.indexOf("Maximum Root Depth"),
  );
  if (start < 0) throw new Error(`ROOT_ROW ${term}`);
  const snippet = rootText.slice(start, start + 210),
    match = snippet.match(/(\d+\.\d+)-(\d+\.\d+)/);
  if (!match) throw new Error(`ROOT_RANGE ${term}`);
  const quote = snippet.slice(0, match.index + match[0].length);
  sourced(
    ids,
    "rooting_soil_structure_infiltration",
    "fao-roots",
    quote,
    `FAO-56 maximum effective rooting depth for ${term}; this is a reference rooting range, not measured infiltration or a guarantee of penetration through compacted soil.`,
    {
      status: "sourced",
      min: Number(match[1]),
      max: Number(match[2]),
      unit: "m maximum effective rooting depth",
    },
    [
      "FAO-56 Table 22 generic conditions; use shallower roots for irrigation scheduling where soil restricts growth.",
      `Source row: ${term}; first listed management/season scenario retained. Other scenarios remain in the saved source.`,
    ],
    undefined,
    true,
    "FAO-56 Table 22",
  );
}
const waterText = texts.get("fao-water");
const waterRows = [
  ["alfalfa", "Alfalfa"],
  ["banana", "Banana"],
  ["barley oat bread-wheat durum-wheat", "Barley/Oats/Wheat"],
  ["dry-bean green-bean", "Bean"],
  ["cabbage", "Cabbage"],
  ["citrus", "Citrus"],
  ["cotton", "Cotton"],
  ["maize", "Maize"],
  ["melon", "Melon"],
  ["onion", "Onion"],
  ["groundnut", "Peanut"],
  ["pea", "Pea"],
  ["pepper", "Pepper"],
  ["potato", "Potato"],
  ["rice", "Rice (paddy)"],
  ["sorghum pearl-millet", "Sorghum/Millet"],
  ["soybean", "Soybean"],
  ["sugar-beet", "Sugarbeet"],
  ["sugarcane", "Sugarcane"],
  ["sunflower", "Sunflower"],
  ["tomato", "Tomato"],
];
for (const [ids, term] of waterRows) {
  const start = waterText.indexOf(
    `${term} |`,
    waterText.indexOf("Table 14 INDICATIVE"),
  );
  const snippet = waterText.slice(start, start + 110),
    match = snippet.match(/(\d+)-(\d+) \|\n([a-z-]+)/);
  if (start < 0 || !match) throw new Error(`WATER_ROW ${term}`);
  const quote = snippet.slice(0, match.index + match[0].length);
  const conditions = [
    "Rough FAO reference for the total growing period; duration and climate change the total. This is crop ET, not net irrigation or a Moroccan local measurement.",
    `Source crop group: ${term}; sensitivity describes water shortage, not seasonal water volume.`,
  ];
  sourced(
    ids,
    "water_demand",
    "fao-water",
    quote,
    `Indicative crop water need ${match[1]}–${match[2]} mm per total growing period; retain the range rather than assigning an unsupported low/high threshold.`,
    {
      status: "sourced",
      min: Number(match[1]),
      max: Number(match[2]),
      unit: "mm/total growing period",
    },
    conditions,
    undefined,
    true,
    "Table 14",
  );
  sourced(
    ids,
    "drought_tolerance",
    "fao-water",
    quote,
    `FAO drought sensitivity: ${match[3]}. Sensitivity is the inverse of tolerance; establishment and crop stage still matter.`,
    {
      status: "sourced",
      value: match[3],
      unit: "qualitative sensitivity to drought",
    },
    conditions,
    undefined,
    true,
    "Table 14",
  );
}
// Mediterranean hay chapter, narrowed to the named crops, not every family member.
const hay = texts.get("fao-hay");
const hayRows = [
  [
    "alfalfa",
    "La luzerne est une plante primordiale",
    "en sec ou sous irrigation.",
  ],
  ["sainfoin", "Le\nsainfoin (Onobrychis viciifolia)", "luzerne."],
  ["sulla", "Le sulla (Hedysarum coronarium)", "séchage soigneux."],
  [
    "berseem persian-clover crimson-clover white-clover",
    "Plusieurs trèfles sont adaptés",
    "irrigation\nestivale.",
  ],
  [
    "phalaris",
    "Dans les régions bien\narrosées, le ray gras et l'alpiste aquatique",
    "dépassent 500 mm.",
  ],
  ["tall-fescue", "La fétuque élevée est très", "une fois installée;"],
  [
    "common-vetch pea fenugreek",
    "Les vesces et les pois sont des plantes robustes d'hiver",
    "aussi utilisé pour le foin.",
  ],
  [
    "sudan-grass sorghum",
    "La plupart du foin est cultivé en\nsaison froide",
    "cultivés.",
  ],
  [
    "oat",
    "L'avoine est une culture importante pour le foin",
    "sols bien drainés.",
  ],
  [
    "carob",
    "Le caroubier est cultivé pour ses",
    "Chypre comme producteur important.",
  ],
];
for (const [ids, first, last] of hayRows) {
  const start = hay.indexOf(first),
    end = hay.indexOf(last, start);
  if (start < 0 || end < 0) throw new Error(`HAY_ROW ${first}`);
  const quote = hay.slice(start, end + last.length);
  sourced(
    ids,
    "forage_residue_feed",
    "fao-hay",
    quote,
    "Named Mediterranean hay/forage use; suitability depends on the source's soil, moisture and harvest conditions. No feed-unit conversion or ration is inferred.",
    {
      status: "sourced",
      value: "hay or forage use",
      unit: "qualitative feed use",
    },
    [
      "Mediterranean-climate guidance; hay must be harvested and conserved safely. Source crop groups are not extrapolated to other species.",
    ],
    "Mediterranean climates, including North Africa; not a Moroccan farm trial",
    true,
    "Chapter VIII, Mediterranean climates",
  );
}
const dry = texts.get("fao-dryland"),
  dryStart = dry.indexOf("Pineapples and sisal resist"),
  dryEnd = dry.indexOf("Drought-escaping crops", dryStart);
sourced(
  "pineapple sorghum pearl-millet cassava groundnut cowpea",
  "drought_tolerance",
  "fao-dryland",
  dry.slice(dryStart, dryEnd).trim(),
  "Named as drought-resistant for climates with a defined mid-season drought; this does not remove establishment or reproductive-stage water needs.",
  {
    status: "sourced",
    value: "drought-resistant",
    unit: "qualitative drought tolerance",
  },
  [
    "Global dryland reference; applicability depends on drought timing, rooting and cultivar.",
  ],
  undefined,
  true,
  "Drought-resistant and drought-escaping crops",
);
const cover = texts.get("fao-cover");
const rStart = cover.indexOf('Provide "biological tillage"'),
  rEnd = cover.indexOf("Utilizing easily leached", rStart);
sourced(
  "oilseed-radish",
  "rooting_soil_structure_infiltration",
  "fao-cover",
  cover.slice(rStart, rEnd).trim(),
  "Oil radish is named as a taproot cover that can penetrate compacted layers and increase percolation; effectiveness depends on the physical restriction.",
  {
    status: "sourced",
    value: "potential biological tillage",
    unit: "qualitative soil structure/percolation",
  },
  [
    "Grown as an established cover crop; not a measured infiltration rate for this field.",
  ],
  undefined,
  true,
  "Cover crop biological tillage",
);
// Moroccan system-level context stays explicitly a package, never an isolated crop effect.
const ca = texts.get("icarda-ca"),
  caQuote = ca
    .split("\n")
    .find((l) => l.startsWith("Conservation Agriculture is a sustainable"));
for (const category of ["erosion_cover_residue", "organic_matter_soil_carbon"])
  sourced(
    "barley bread-wheat durum-wheat",
    category,
    "icarda-ca",
    caQuote,
    "Moroccan cereal-system conservation-agriculture context: permanent cover, minimal tillage and diversification work together. The cited package supports soil health; it does not isolate a crop carbon gain or supply C.",
    {
      status: "sourced",
      value: "system-level conservation agriculture",
      unit: "qualitative; no isolated crop magnitude",
    },
    [
      "Use all three conservation-agriculture principles; evidence does not isolate the effect of one cereal or quantify soil C.",
      "Residue removal for livestock can limit cover; no C factor or soil-carbon rate is inferred.",
    ],
    "Moroccan cereal systems; ICARDA/INRA",
    false,
    "Conservation agriculture principles and Moroccan cereal context",
  );
const cgiar = texts.get("cgiar-carbon"),
  nQuote = cgiar
    .split("\n")
    .find((l) => l.includes("Integrating legumes like lentils"));
if (!nQuote) throw new Error("CGIAR_N_QUOTE");
for (const category of [
  "biological_nitrogen_fixation",
  "residual_nitrogen_credit",
])
  sourced(
    "lentil chickpea faba-bean",
    category,
    "cgiar-carbon",
    nQuote,
    "Moroccan cereal-system context identifies biological fixation and reduced fertilizer needs with these legumes. The reported system percentage is not a crop-specific kg N/ha residual credit.",
    {
      status: "sourced",
      value: "fixation and following-cereal benefit; kg N/ha not established",
      unit: "kg N/ha (unquantified)",
    },
    [
      "Moroccan cereal systems with integrated legumes; no fertilizer subtraction without local validation.",
      "The source percentage is system-level context and is not converted into a crop-specific nitrogen quantity.",
    ],
    "Morocco; CGIAR/ICARDA dryland conservation agriculture context",
    false,
    "Legume integration in cereal systems",
  );
// Local scanned guides: short quotes were visually checked on the full pages.
const inraLegume = texts.get("inra-legume-guide");
const localN = inraLegume
  .split("\n")
  .find((l) => l.startsWith("contenant des bactéries"));
sourced(
  "lentil chickpea faba-bean",
  "biological_nitrogen_fixation",
  "inra-legume-guide",
  localN,
  "INRA identifies nitrogen-fixing root-nodule bacteria in the food-legume guide. Fixation depends on nodulation, soil, drought, sitona damage and host/strain compatibility; no crop-specific kg N/ha is derived from its pooled figures.",
  {
    status: "sourced",
    value: "root-nodule fixation potential",
    unit: "kg N/ha (unquantified)",
  },
  [
    "INRA guide covers lentil, chickpea and faba bean; grouped physiological context, not a separate measured range per crop.",
    "The pooled 210 kg/ha figure is not assigned to any one crop or converted into following-crop credit.",
  ],
  "Morocco; INRA food-legume guide",
  false,
  "PDF page 11, printed page 9; visually reviewed transcription",
);
sourced(
  "lentil chickpea faba-bean",
  "weed_break",
  "inra-legume-guide",
  "vu la faible compétitivité des fabacées, surtout au stade plantule.",
  "INRA warns that these food legumes compete poorly with weeds, especially as seedlings. A diversified rotation and establishment management are needed; legume identity does not imply weed suppression.",
  {
    status: "sourced",
    value: "weak seedling weed competition",
    unit: "qualitative weed effect",
  },
  [
    "Guide for lentil, chickpea and faba bean; an effect of the managed rotation, not autonomous weed control.",
  ],
  "Morocco; INRA food-legume guide",
  false,
  "PDF page 14, printed page 12; visually reviewed transcription",
);
for (const category of ["disease_break", "pest_break", "weed_break"])
  sourced(
    "barley bread-wheat durum-wheat",
    category,
    "inra-barley",
    "Maîtriser les adventices, maladies et ravageurs",
    "INRA describes diversified rotation as a way to manage weeds, diseases and pests in cereal systems; this is a system-level rationale, not a quantified named-organism response.",
    {
      status: "sourced",
      value: "diversified rotation rationale",
      unit: "qualitative rotation effect",
    },
    [
      "Cereal guide for durum wheat, bread wheat and barley; alternate crop types and seasons rather than assuming any family change controls every organism.",
    ],
    "Morocco; INRA cereal guide",
    false,
    "PDF page 7, printed page 4; visually reviewed transcription",
  );
sourced(
  "barley bread-wheat durum-wheat",
  "rooting_soil_structure_infiltration",
  "inra-barley",
  "Améliorer les caractéristiques physiques et chimiques du sol",
  "INRA describes improving physical and chemical soil properties through diversified rotation; this system-level potential does not measure infiltration or establish a crop rooting-depth range.",
  {
    status: "sourced",
    value: "rotation-level soil structure potential",
    unit: "qualitative soil structure",
  },
  [
    "Different crop rooting systems in a diversified rotation; no measured infiltration rate or isolated cereal effect.",
  ],
  "Morocco; INRA cereal guide",
  false,
  "PDF page 7, printed page 4; visually reviewed transcription",
);
await mkdir(root, { recursive: true });
const batches = [];
const identityHashes = new Map(
  await Promise.all(
    profiles.map(async (p) => [
      p.id,
      sha(await readFile(`${base}/profiles/${p.id}.json`)),
    ]),
  ),
);
for (let i = 0; i < profiles.length; i += 25) {
  const crops = profiles.slice(i, i + 25).map((p) => ({
    cropId: p.id,
    identity: {
      name: p.identity.name,
      scientificName: p.identity.scientificName,
      family: p.identity.family,
    },
    identityProvenance: {
      kind: "existing_catalog_identity_reference",
      catalogVersion: "0.14.0",
      savedFile: `${base}/profiles/${p.id}.json`,
      sha256: identityHashes.get(p.id),
      note: "Copied unchanged for coverage; all existing catalog identity provenance remains in the base profile.",
    },
    researchScope: {
      method:
        "Targeted primary-source searches, explicit crop/table mappings and labelled model recall; not an exhaustive individual literature search.",
    },
    cropGroup: group(p),
    priorEvidence: `${base}/profiles/${p.id}.json`,
    findings: records.get(p.id),
  }));
  const path = `${root}/benefits-batch-${String(batches.length + 1).padStart(2, "0")}.json`;
  await json(path, {
    recordedOn: "2026-11-11",
    method:
      "Targeted primary-source research plus explicit model recall for every effect; inherited evidence remains unchanged.",
    crops,
  });
  batches.push(path);
}
const statuses = ["sourced", "model_recall", "not_applicable"];
const empty = () => Object.fromEntries(statuses.map((s) => [s, 0]));
const before = Object.fromEntries(
    categories.map((c) => [c, { ...empty(), uncovered: 0 }]),
  ),
  after = Object.fromEntries(categories.map((c) => [c, empty()])),
  groups = {};
for (const p of profiles) {
  const g = group(p);
  groups[g] ??= {
    crops: 0,
    before: { ...empty(), uncovered: 0 },
    after: empty(),
    effects: Object.fromEntries(
      categories.map((c) => [
        c,
        { before: { ...empty(), uncovered: 0 }, after: empty() },
      ]),
    ),
  };
  groups[g].crops++;
  for (const c of categories) {
    const old = p.research.benefits.findings.some((f) => f.category === c)
      ? "sourced"
      : "uncovered";
    before[c][old]++;
    groups[g].before[old]++;
    groups[g].effects[c].before[old]++;
    const newRows = records.get(p.id).filter((r) => r.effectCategory === c),
      status =
        old === "sourced" || newRows.some((r) => r.status === "sourced")
          ? "sourced"
          : newRows.some((r) => r.status === "model_recall")
            ? "model_recall"
            : "not_applicable";
    after[c][status]++;
    groups[g].after[status]++;
    groups[g].effects[c].after[status]++;
  }
}
await json(`${root}/benefits-summary.json`, {
  recordedOn: "2026-11-11",
  catalogBase: "0.14.0",
  crops: profiles.length,
  categories,
  batches,
  before,
  after,
  groups,
  records: profiles
    .flatMap((p) => records.get(p.id))
    .reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}),
  note: "Coverage counts select sourced over recall over not-applicable per crop/effect. Record totals count all retained evidence. Historical gaps remain in 0.15.0 but are superseded for current coverage.",
});
console.log(
  JSON.stringify({
    crops: profiles.length,
    newRecords: [...records.values()].flat().length,
    newSourced: [...records.values()]
      .flat()
      .filter((r) => r.status === "sourced").length,
  }),
);
