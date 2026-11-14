// Build farmer-facing role entries from the same hash-checked local evidence.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { format } from "prettier";
const root = "docs/evidence/catalog/2026-11-11/benefits";
const sources = JSON.parse(
  await readFile(`${root}/benefits-sources.json`, "utf8"),
);
const sha = (v) => createHash("sha256").update(v).digest("hex");
async function cite(sourceId, first, last) {
  const s = sources.find((s) => s.id === sourceId),
    bytes = await readFile(s.savedFile),
    text = await readFile(s.textFile, "utf8");
  if (sha(bytes) !== s.sha256 || sha(text) !== s.textSha256)
    throw new Error(`ROLE_SOURCE_HASH ${sourceId}`);
  const start = text.indexOf(first),
    end = last ? text.indexOf(last, start) + last.length : start + first.length;
  if (start < 0 || end < start) throw new Error(`ROLE_QUOTE ${sourceId}`);
  return {
    sourceId: `b4-${sourceId}`,
    quote: text.slice(start, end),
    locator: `Visible text, line ${text.slice(0, start).split("\n").length}`,
    sourceSha256: s.sha256,
    quoteCheck: `b4:role:${sourceId}:${start}`,
    url: s.url,
    title: s.title,
  };
}
const roles = [
  {
    code: "nitrogen_fixing",
    term: [
      "Nitrogen-fixing crops",
      "Cultures fixatrices d'azote",
      "محاصيل مثبتة للنيتروجين",
      "زراعات كتثبت الآزوت",
    ],
    meaning: [
      "Legumes with healthy root nodules use nitrogen from the air. Some nitrogen can reach the next crop when roots and residues break down. Keeping residues helps nutrient cycling; grain or forage harvest can remove much of that nitrogen. Fixation is not the same as a fertilizer credit: check the field and the next crop before reducing fertilizer.",
      "Les légumineuses bien nodulées utilisent l'azote de l'air. Une partie peut nourrir la culture suivante lorsque les racines et résidus se décomposent. Leur restitution aide le recyclage des nutriments ; récolter les grains ou le fourrage emporte de l'azote. La fixation n'est pas un crédit d'engrais garanti : vérifiez la parcelle et la culture suivante avant de réduire l'apport.",
      "تستعمل البقوليات ذات العقد الجذرية السليمة نيتروجين الهواء. قد يصل جزء منه إلى المحصول التالي بعد تحلل الجذور والبقايا. تساعد إعادة البقايا على تدوير العناصر، بينما يزيل حصاد الحبوب أو العلف بعض النيتروجين. التثبيت لا يعني رصيد سماد مضموناً؛ افحص الحقل والمحصول التالي قبل تقليل التسميد.",
      "القطاني اللي عندها عقد مزيانة فالجذور كتستعمل الآزوت من الهوا. ملي كيتحللو الجذور والبقايا، شي آزوت يقدر ينفع الزراعة اللي من بعد. إلا خرجنا الحبوب ولا العلف كنخرجو معاهم الآزوت. التثبيت ماشي كمية سماد مضمونة؛ خاص نشوفو حالة الأرض والزراعة الجاية قبل ما ننقصو السماد.",
    ],
    citations: [
      await cite(
        "inra-legume-guide",
        "contenant des bactéries Rhizobium léguminosarium fixatrices d’azote.",
      ),
      await cite(
        "cgiar-carbon",
        "Integrating legumes like lentils",
        "planted afterward.",
      ),
    ],
  },
  {
    code: "cover",
    term: [
      "Cover crops",
      "Cultures de couverture",
      "محاصيل التغطية",
      "زراعات الغطا",
    ],
    meaning: [
      "A cover crop protects soil between main crops. Its leaves and retained residues soften the impact of rain, and its roots and residues add organic material. This can help soil structure and water entry over time. A living cover also uses water: choose and stop it in time so it does not compete with the next crop in a dry season.",
      "Une culture de couverture protège le sol entre deux cultures principales. Son feuillage et les résidus conservés amortissent la pluie ; ses racines et résidus apportent de la matière organique. Cela peut améliorer la structure et l'entrée de l'eau avec le temps. Le couvert vivant consomme aussi de l'eau : choisissez-le et arrêtez-le à temps pour préserver la culture suivante en saison sèche.",
      "تحمي محاصيل التغطية التربة بين المحاصيل الرئيسية. تخفف أوراقها وبقاياها المحفوظة أثر المطر، وتضيف الجذور والبقايا مادة عضوية. قد يساعد ذلك على بنية التربة ودخول الماء مع الوقت. الغطاء الحي يستهلك الماء أيضاً؛ اختره وأنهِ نموه في الوقت المناسب كي لا ينافس المحصول التالي في الموسم الجاف.",
      "زراعة الغطا كتحمي التراب بين الزراعات الرئيسية. الوراق والبقايا اللي خلينا كيخففو ضربات الشتا، والجذور والبقايا كيزيدو المادة العضوية. هادشي يقدر يحسن بنية التراب ودخول الما مع الوقت. الغطا الحي حتى هو كيشرب الما؛ خاص نوقفوه فالوقت باش ما ينافسش الزراعة الجاية فالجفاف.",
    ],
    citations: [
      await cite(
        "fao-cover",
        "Providing an additional source of organic matter to improve soil structure.",
      ),
      await cite(
        "fao-cover",
        "Their growth is interrupted either before the next crop is sown, or after sowing the next crop, but before competition between the two crops starts.",
      ),
    ],
  },
  {
    code: "deep_rooting",
    term: [
      "Deep-rooting crops",
      "Cultures à enracinement profond",
      "محاصيل عميقة الجذور",
      "زراعات بجذور غارقة",
    ],
    meaning: [
      "Deep roots explore soil below the surface and can recover water and nutrients there. Some taproot cover crops, such as oil radish, can open channels through dense soil. Those channels may help water move into the soil after roots decay. Hard layers, shallow soil and a high water table can restrict roots, so the effect is not guaranteed on every field.",
      "Les racines profondes explorent le sous-sol et peuvent y puiser de l'eau et des nutriments. Certains couverts à racine pivotante, comme le radis oléagineux, peuvent ouvrir des passages dans un sol dense. Ces passages peuvent faciliter l'entrée de l'eau après décomposition des racines. Semelles compactes, sol peu profond et nappe haute limitent cet effet : il n'est pas garanti sur chaque parcelle.",
      "تستكشف الجذور العميقة ما تحت السطح وقد تسترجع الماء والعناصر منه. يمكن لبعض محاصيل التغطية ذات الجذر الوتدي، مثل الفجل الزيتي، فتح قنوات في التربة الكثيفة. قد تساعد هذه القنوات على مرور الماء بعد تحلل الجذور. تحد الطبقات الصلبة والتربة الضحلة والمياه الجوفية المرتفعة من الجذور؛ لذلك لا تُضمن النتيجة في كل حقل.",
      "الجذور الغارقة كتوصل للتراب اللي لتحت وتقدر تستافد من الما والعناصر تما. شي غطا بجذر وتدي، بحال الفجل الزيتي، يقدر يفتح ممرات فالتراب المكبوس. منين كيتحلل الجذر الما يقدر يدوز منها. إلا كانت طبقة قاصحة ولا الأرض رقيقة ولا الما قريب للسطح، الجذور كتتحبس وماشي كل قطعة غادي تستافد بنفس الطريقة.",
    ],
    citations: [
      await cite(
        "fao-cover",
        'Provide "biological tillage"',
        "increasing water percolation capacity of the soil.",
      ),
      await cite(
        "fao-cover",
        "Different plants, with diverse rooting systems, explore different soil depths within the profile.",
      ),
    ],
  },
  {
    code: "drought_tolerant",
    term: [
      "Drought-tolerant crops",
      "Cultures tolérantes à la sécheresse",
      "محاصيل متحملة للجفاف",
      "زراعات كتتحمل الجفاف",
    ],
    meaning: [
      "Drought-tolerant crops can cope with some dry spells by slowing growth, reaching deeper water or limiting water loss. They may help maintain roots and plant cover when suitable for the season. Soil-health benefits still depend on retaining residues and protecting the soil; tolerance alone does not add carbon or guarantee low water demand. Establishment and flowering can still need water.",
      "Les cultures tolérantes à la sécheresse supportent certaines périodes sèches en ralentissant leur croissance, en puisant plus profondément ou en limitant les pertes d'eau. Adaptées à la saison, elles peuvent aider à maintenir des racines et un couvert. La santé du sol dépend aussi des résidus conservés et de sa protection : la tolérance seule ne garantit ni stockage de carbone ni faible besoin en eau. Levée et floraison peuvent rester sensibles.",
      "تتحمل هذه المحاصيل بعض الفترات الجافة بإبطاء النمو أو الوصول إلى ماء أعمق أو الحد من فقد الماء. قد تساعد على بقاء الجذور والغطاء إذا ناسبت الموسم. لكن فائدة التربة تعتمد على حفظ البقايا وحمايتها؛ فالتحمل وحده لا يضيف الكربون ولا يضمن طلباً مائياً منخفضاً. قد يبقى الإنبات والإزهار محتاجين إلى الماء.",
      "هاد الزراعات كتتحمل شي فترات بلا شتا، كتبطأ النمو ولا كتقلب على الما فالعمق ولا كتنقص ضياعو. إلا ناسبات الموسم تقدر تعاون يبقاو الجذور والغطا. ولكن منفعة التراب مرتبطة بالبقايا والحماية؛ تحمل الجفاف بوحدو ما كيضمنش زيادة الكربون ولا قلة استهلاك الما. الإنبات والتزهير يقدرو يبقاو محتاجين الما.",
    ],
    citations: [
      await cite(
        "fao-dryland",
        "Some crops can tolerate drought because",
        "followed by long dry periods.",
      ),
      await cite(
        "fao-cover",
        "Crop residues are left on the soil surface, but cover crops may be needed if the gap is too long between harvesting one crop and establishing the next.",
      ),
    ],
  },
];
const roleEntries = roles.map((r) => ({
  code: r.code,
  group: "role",
  term: Object.fromEntries(
    ["en", "fr", "ar", "ary"].map((l, i) => [l, r.term[i]]),
  ),
  meaning: Object.fromEntries(
    ["en", "fr", "ar", "ary"].map((l, i) => [l, r.meaning[i]]),
  ),
  evidence: { status: "sourced", citations: r.citations },
}));
await writeFile(
  `${root}/benefits-roles.json`,
  await format(
    JSON.stringify({
      recordedOn: "2026-11-11",
      provenance: {
        en: "model_written_unreviewed",
        fr: "model_translated_unreviewed",
        ar: "model_translated_unreviewed",
        ary: "model_translated_unreviewed",
      },
      entries: roleEntries,
    }),
    { parser: "json" },
  ),
);
const notes = [
  [
    "BENEFIT_RESIDUAL_NITROGEN",
    [
      "Nitrogen for the next crop",
      "Azote pour la culture suivante",
      "نيتروجين للمحصول التالي",
      "الآزوت للزراعة الجاية",
    ],
    [
      "Retained roots and residues may release nitrogen to the next crop. Follow the cited conditions; fixation is not a fertilizer credit and harvest can remove nitrogen.",
      "Les racines et résidus restitués peuvent libérer de l'azote pour la suite. Respectez les conditions citées ; fixation et crédit d'engrais diffèrent, et la récolte emporte de l'azote.",
      "قد توفر الجذور والبقايا نيتروجيناً للمحصول التالي وفق الشروط. التثبيت ليس رصيد سماد مضموناً والحصاد يزيل النيتروجين.",
      "الجذور والبقايا يقدرو يعطيو الآزوت للزراعة الجاية حسب الشروط. التثبيت ماشي سماد مضمون والحصاد كيخرج الآزوت.",
    ],
  ],
  [
    "BENEFIT_EROSION_COVER",
    ["Soil cover", "Couverture du sol", "غطاء التربة", "غطا التراب"],
    [
      "Living cover and retained residue may protect soil from rain and shorten bare periods. Crop C factors retain management conditions; incomplete RUSLE factors cannot rank erosion.",
      "Couvert vivant et résidus peuvent protéger de la pluie et raccourcir les périodes de sol nu. Les facteurs C gardent leurs conditions ; sans tous les facteurs RUSLE, pas de classement de l'érosion.",
      "قد يحمي الغطاء والبقايا التربة من المطر ويقللان فترات انكشافها. تبقى عوامل C مشروطة ولا ترتيب للتعرية دون اكتمال عوامل RUSLE.",
      "الغطا والبقايا يقدرو يحميو التراب من الشتا وينقصو الوقت اللي كيبقى عريان. العامل C عندو شروط وما كنرتبوش التعرية بلا عوامل RUSLE كاملة.",
    ],
  ],
  [
    "BENEFIT_ORGANIC_MATTER",
    ["Organic matter", "Matière organique", "المادة العضوية", "المادة العضوية"],
    [
      "Healthy retained roots and residues return organic material. This potential input is not a measured increase in soil carbon; removal, decay and tillage matter.",
      "Racines et résidus sains restitués apportent de la matière organique. Cet apport potentiel n'est pas une hausse mesurée du carbone : exportation, décomposition et travail du sol comptent.",
      "تعيد الجذور والبقايا السليمة مادة عضوية. هذا لا يمثل زيادة مقاسة في كربون التربة؛ الإزالة والتحلل والحرث تؤثر فيها.",
      "الجذور والبقايا السليمة كيرجعو المادة العضوية. هادشي ماشي زيادة مقاسة فكربون التراب؛ الخروج والتحلل والحرث كيأثرو.",
    ],
  ],
  [
    "BENEFIT_ROOTING_SOIL_STRUCTURE",
    [
      "Roots and soil structure",
      "Racines et structure du sol",
      "الجذور وبنية التربة",
      "الجذور وبنية التراب",
    ],
    [
      "Roots may bind soil and leave channels. A cited rooting-depth range is not a measured infiltration improvement; compaction and soil depth can restrict the effect.",
      "Les racines peuvent stabiliser le sol et laisser des passages. Une profondeur sourcée ne mesure pas une amélioration de l'infiltration ; compaction et profondeur du sol limitent l'effet.",
      "قد تثبت الجذور التربة وتترك قنوات. عمق الجذور الموثق لا يقيس تحسن التسرب؛ قد يحد الانضغاط وعمق التربة من الأثر.",
      "الجذور يقدرو يشدو التراب ويخليو ممرات. عمق موثق ماشي قياس لتحسن دخول الما؛ الكبس وعمق الأرض كيحدو الأثر.",
    ],
  ],
  [
    "BENEFIT_DROUGHT_TOLERANCE",
    [
      "Drought response",
      "Réaction à la sécheresse",
      "الاستجابة للجفاف",
      "التعامل مع الجفاف",
    ],
    [
      "Drought response depends on crop, cultivar and stage. Relative tolerance does not guarantee production, protect every stage or mean low seasonal water demand.",
      "La réaction à la sécheresse dépend de la culture, de la variété et du stade. La tolérance relative ne garantit ni production ni faible besoin saisonnier, et tous les stades ne sont pas protégés.",
      "تعتمد الاستجابة للجفاف على المحصول والصنف والمرحلة. التحمل النسبي لا يضمن الإنتاج أو حماية كل مرحلة أو انخفاض الطلب المائي الموسمي.",
      "التحمل ديال الجفاف كيتبدل حسب الزراعة والصنف والمرحلة. ما كيضمنش الإنتاج ولا حماية كل مرحلة ولا استهلاك قليل ديال الما.",
    ],
  ],
  [
    "BENEFIT_WATER_DEMAND",
    [
      "Crop water demand",
      "Besoin en eau de la culture",
      "الطلب المائي للمحصول",
      "حاجة الزراعة للما",
    ],
    [
      "Water-demand evidence describes crop use over its stated period. Rain and soil storage change irrigation needs; generic ranges and recalled classes do not replace the field water balance.",
      "Les données décrivent l'usage de l'eau sur la période indiquée. Pluie et réserve du sol changent l'irrigation ; plages générales et classes rappelées ne remplacent pas le bilan de la parcelle.",
      "يصف الدليل استعمال الماء خلال الفترة المحددة. تغير الأمطار ومخزون التربة حاجة الري؛ النطاقات العامة والفئات المستذكرة لا تعوض ميزان ماء الحقل.",
      "الدليل كيوضح استهلاك الما فالمدة المحددة. الشتا ومخزون الأرض كيبدلو السقي؛ الأرقام العامة والمعرفة المستذكرة ما كتعوضش ميزان الما ديال القطعة.",
    ],
  ],
  [
    "BENEFIT_PEST_CYCLE_BREAK",
    [
      "Pest-cycle interruption",
      "Interruption des cycles de bioagresseurs",
      "قطع دورات الآفات",
      "قطع دورة الآفات",
    ],
    [
      "Changing crop family may interrupt specialist pests and diseases. The next crop, host weeds and shared pathogens matter; a different family does not guarantee a clean field.",
      "Changer de famille peut interrompre certains bioagresseurs spécialisés. La culture suivante, les adventices hôtes et les agents communs comptent ; une autre famille ne garantit pas une parcelle saine.",
      "قد يقطع تغيير العائلة دورات آفات وأمراض متخصصة. المحصول التالي والأعشاب العائلة والممرضات المشتركة مهمة؛ اختلاف العائلة لا يضمن حقلًا سليماً.",
      "تبديل العائلة يقدر يقطع دورة شي آفات وأمراض متخصصة. خاص نشوفو الزراعة الجاية والعشوب اللي كتحمل المرض؛ عائلة مختلفة ما كتضمنش أرض نقية.",
    ],
  ],
];
const effectRows = [
  ["biological_nitrogen_fixation", roles[0].term, roles[0].meaning],
  ["residual_nitrogen_credit", notes[0][1], notes[0][2]],
  [
    "forage_residue_feed",
    [
      "Forage and residue feed value",
      "Valeur alimentaire des fourrages et résidus",
      "القيمة العلفية والبقايا",
      "قيمة العلف والبقايا",
    ],
    [
      "Potential feed use of forage, straw or residues under the stated harvest, conservation and safety conditions. Balance the ration for the animal and check suitability locally.",
      "Usage possible du fourrage, de la paille ou des résidus selon les conditions de récolte, de conservation et de sécurité. Équilibrez la ration selon l'animal et vérifiez son aptitude localement.",
      "إمكان استعمال العلف أو القش أو البقايا وفق شروط الحصاد والحفظ والسلامة، مع موازنة العليقة حسب الحيوان والتحقق من الملاءمة محلياً.",
      "إمكانية استعمال العلف ولا التبن ولا البقايا حسب شروط الحصاد والحفظ والسلامة. خاص نوازنو العلف حسب الحيوان ونتأكدو من الملاءمة محلياً.",
    ],
  ],
  [
    "disease_break",
    [
      "Disease-cycle interruption",
      "Interruption des cycles de maladies",
      "قطع دورات الأمراض",
      "قطع دورة الأمراض",
    ],
    notes[6][2],
  ],
  [
    "pest_break",
    [
      "Pest-cycle interruption",
      "Interruption des cycles de ravageurs",
      "قطع دورات الآفات",
      "قطع دورة الآفات",
    ],
    notes[6][2],
  ],
  [
    "weed_break",
    [
      "Weed pressure in the rotation",
      "Adventices dans la rotation",
      "الأعشاب في الدورة الزراعية",
      "العشوب فالدورة الزراعية",
    ],
    [
      "The effect of crop competition, planting season and management on weeds. Poor crop establishment, host weeds and volunteers can prevent a useful break.",
      "Effet de la concurrence, de la saison de semis et de la gestion sur les adventices. Une mauvaise levée, les plantes hôtes et les repousses peuvent limiter l'effet de la rotation.",
      "أثر منافسة المحصول وموسم الزرع والإدارة على الأعشاب. قد يحد ضعف الإنبات والأعشاب العائلة والنباتات المتطوعة من فائدة الدورة.",
      "تأثير منافسة الزراعة ووقت الزرع والتدبير على العشوب. إلا كان الإنبات ضعيف ولا بقاو العشوب والزرع اللي طلع بوحدو، المنفعة تقدر تنقص.",
    ],
  ],
  ["rooting_soil_structure_infiltration", notes[3][1], notes[3][2]],
  ["erosion_cover_residue", notes[1][1], notes[1][2]],
  [
    "bare_soil_period_shortening",
    [
      "Shorter bare-soil periods",
      "Réduction des périodes de sol nu",
      "تقليل فترات انكشاف التربة",
      "نقص الوقت اللي الأرض عريانة",
    ],
    [
      "Potential reduction in time without crop cover. A numerical change needs a stated comparison calendar; sowing dates alone do not measure soil cover.",
      "Réduction possible du temps sans couvert. Un chiffre demande un calendrier de comparaison explicite ; les dates de semis seules ne mesurent pas la couverture du sol.",
      "إمكان تقليل الوقت دون غطاء محصولي. يتطلب الرقم تقويماً مقارناً محدداً؛ تواريخ الزرع وحدها لا تقيس غطاء التربة.",
      "إمكانية نقص الوقت بلا غطا ديال الزرع. باش نحسبو الأيام خاص تقويم للمقارنة؛ تاريخ الزرع بوحدو ما كيقيسش غطا التراب.",
    ],
  ],
  ["organic_matter_soil_carbon", notes[2][1], notes[2][2]],
  ["drought_tolerance", notes[4][1], notes[4][2]],
  ["water_demand", notes[5][1], notes[5][2]],
];
const applicabilityRows = [
  [
    "not_applicable",
    ["Not applicable", "Non applicable", "لا ينطبق", "ما كينطبقش"],
    [
      "The effect does not apply to this crop for the stated reason. This is distinct from missing research; check the provenance and crop-specific explanation.",
      "L'effet ne s'applique pas à cette culture pour la raison indiquée. Cela se distingue d'une recherche manquante ; consultez la provenance et l'explication propre à la culture.",
      "لا ينطبق الأثر على المحصول للسبب المذكور. هذا يختلف عن نقص البحث؛ راجع مصدر المعلومة والتفسير الخاص بالمحصول.",
      "هاد الأثر ما كينطبقش على هاد الزراعة للسبب المذكور. ماشي غير البحث ناقص؛ شوف منين جا التفسير والسبب الخاص بالزراعة.",
    ],
  ],
];
const code = `// Generated by tooling/catalog/assemble-benefit-roles-2026-11-11.mjs.\nimport { rows, type GlossaryEntryText } from "./types.js";\nexport const benefitRoles: GlossaryEntryText[] = ${JSON.stringify(roleEntries)};\nexport const benefitStrategyNotes = rows("strategy_note", ${JSON.stringify(notes)});\nexport const benefitEffects = rows("effect", ${JSON.stringify(effectRows)});\nexport const benefitApplicability = rows("status", ${JSON.stringify(applicabilityRows)});\n`;
await writeFile(
  "packages/domain/src/glossary/benefits.ts",
  await format(code, { parser: "typescript" }),
);
console.log(
  "4 sourced roles; 7 strategy notes, 12 effects and not-applicable status in four languages",
);
