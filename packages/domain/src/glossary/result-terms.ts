import { rows } from "./types.js";

// Why a satellite result is missing or limited, and the words used to compare
// satellite records with each other.
export const resultReasonCodes = rows("reason_code", [
  [
    "CANOPY_BIOMASS_NOT_IMPORTED",
    [
      "Biomass map not loaded",
      "Carte de biomasse non chargée",
      "خريطة الكتلة الحيوية غير محمّلة",
      "خريطة الكتلة الحيوية ما تحملاتش",
    ],
    [
      "The GEDI biomass map has not been loaded on this server yet, so there is nothing to show for the field.",
      "La carte de biomasse GEDI n'a pas encore été chargée sur ce serveur : il n'y a rien à afficher pour la parcelle.",
      "لم تُحمَّل خريطة الكتلة الحيوية GEDI على هذا الخادم بعد، فلا شيء يُعرض للحقل.",
      "خريطة الكتلة الحيوية GEDI ما تحملاتش باقي فهاد الخادم، وداكشي علاش ما كاين ما يتعرض لهاد القطعة.",
    ],
  ],
  [
    "CANOPY_BIOMASS_OUTSIDE_IMPORT",
    [
      "Field outside the loaded area",
      "Parcelle hors de la zone chargée",
      "الحقل خارج المنطقة المحمَّلة",
      "القطعة خارج المنطقة المحملة",
    ],
    [
      "The biomass map that was loaded does not cover the field's location.",
      "La carte de biomasse chargée ne couvre pas l'emplacement de la parcelle.",
      "لا تغطي خريطة الكتلة الحيوية المحمَّلة موقع الحقل.",
      "خريطة الكتلة الحيوية اللي تحملات ما كتغطيش البلاصة اللي فيها القطعة.",
    ],
  ],
  [
    "CANOPY_BIOMASS_NO_ESTIMATE_NEARBY",
    [
      "No biomass estimate nearby",
      "Aucune estimation de biomasse à proximité",
      "لا يوجد تقدير قريب للكتلة الحيوية",
      "ما كاينش تقدير قريب للكتلة الحيوية",
    ],
    [
      "GEDI has no biomass estimate for the field's cell or the cells within 3 km, which is common where there are few trees.",
      "GEDI n'a aucune estimation de biomasse pour la cellule de la parcelle ni pour celles situées à moins de 3 km, ce qui est fréquent là où il y a peu d'arbres.",
      "ليس لدى GEDI تقدير للكتلة الحيوية لخلية الحقل أو للخلايا ضمن 3 كم، وهذا شائع حيث الأشجار قليلة.",
      "GEDI ما عندوش تقدير للكتلة الحيوية فالخلية ديال القطعة ولا فالخلايا اللي على بعد 3 كلم منها. هادشي كيوقع بزاف فالبلايص اللي فيها الشجر قليل.",
    ],
  ],
  [
    "CLIMATE_NOT_COMPARED",
    [
      "Future climate not compared",
      "Climat futur non comparé",
      "المناخ المستقبلي لم يُقارَن",
      "المناخ الجاي ما تقارنش",
    ],
    [
      "The climate comparison could not be made. Under the regional comparison policy, this applies only to the named rotation and model; complete rotations can still be compared.",
      "La comparaison climatique est impossible. Avec la politique régionale, ce motif concerne uniquement la rotation et le modèle indiqués ; les rotations complètes peuvent être comparées.",
      "تعذّرت المقارنة المناخية. في سياسة المقارنة الإقليمية، يخص هذا السبب الدورة والنموذج المحددين فقط؛ وتبقى مقارنة الدورات المكتملة ممكنة.",
      "المقارنة ديال المناخ ما قدرناش نديروها. فالسياسة الجهوية، هاد السبب كيخص غير الدورة والنموذج المذكورين؛ الدورات اللي بياناتها كاملة يقدرو يتقارنو.",
    ],
  ],
  [
    "SCENARIO_TILE_NOT_PREPARED",
    [
      "Future climate not prepared for this area",
      "Climat futur non préparé pour cette zone",
      "المناخ المستقبلي غير مُعدّ لهذه المنطقة",
      "المناخ الجاي ما تجهزش لهاد المنطقة",
    ],
    [
      "The future-climate projections for the field's area have not been downloaded and prepared on this server yet.",
      "Les projections de climat futur pour la zone de la parcelle n'ont pas encore été téléchargées et préparées sur ce serveur.",
      "لم تُنزَّل وتُجهَّز بعد إسقاطات المناخ المستقبلي لمنطقة الحقل على هذا الخادم.",
      "معطيات سيناريوهات المناخ الجاي للمنطقة ديال القطعة ما تحملاتش وما تجهزاتش باقي فهاد الخادم.",
    ],
  ],
  [
    "SCENARIO_DATA_INCOMPLETE",
    [
      "Future climate data incomplete",
      "Données de climat futur incomplètes",
      "بيانات المناخ المستقبلي ناقصة",
      "بيانات المناخ الجاي ناقصة",
    ],
    [
      "The prepared future-climate data for this area is missing some models or years, so it was not used.",
      "Les données de climat futur préparées pour cette zone manquent de certains modèles ou années : elles n'ont pas été utilisées.",
      "بيانات المناخ المستقبلي المجهَّزة لهذه المنطقة لا تشمل بعض النماذج أو السنوات، لذلك لم تُستخدم.",
      "بيانات المناخ الجاي اللي تجهزات لهاد المنطقة ناقصين فيها شي نماذج ولا سنوات. داكشي علاش ما استعملناهاش.",
    ],
  ],
  [
    "FUTURE_ANALOGS_INSUFFICIENT",
    [
      "Too few future seasons to compare",
      "Trop peu de campagnes futures à comparer",
      "مواسم مستقبلية قليلة للمقارنة",
      "مواسم المستقبل ما كافيينش للمقارنة",
    ],
    [
      "The future climate data did not give enough complete seasons to compare the rotations.",
      "Les données de climat futur n'ont pas fourni assez de campagnes complètes pour comparer les rotations.",
      "لم تعطِ بيانات المناخ المستقبلي مواسم كاملة كافية لمقارنة الدورات الزراعية.",
      "بيانات المناخ الجاي ما عطاتش عدد كافي من المواسم الكاملة باش نقارنو الدورات الزراعية.",
    ],
  ],
  [
    "NEAR_TERM_TILE_NOT_PREPARED",
    [
      "Near-term climate not prepared for this area",
      "Climat des prochaines années non préparé pour cette zone",
      "مناخ السنوات القادمة غير مُعدّ لهذه المنطقة",
      "المناخ ديال السنين القريبة ما تجهزش",
    ],
    [
      "The model projections for the next years (starting 2026 to 2035) have not been downloaded for the field's area yet, so only the mid-century comparison is shown.",
      "Les projections des modèles pour les prochaines années (2026 à 2035) n'ont pas encore été téléchargées pour la zone de la parcelle : seule la comparaison du milieu du siècle est affichée.",
      "لم تُنزَّل بعد إسقاطات النماذج للسنوات القادمة (2026 إلى 2035) لمنطقة الحقل، لذلك تُعرض مقارنة منتصف القرن فقط.",
      "معطيات النماذج للسنين الجاية، من 2026 حتى 2035، ما تحملاتش باقي للمنطقة ديال القطعة. كنبينو غير المقارنة ديال وسط القرن.",
    ],
  ],
  [
    "NEAR_TERM_DATA_INCOMPLETE",
    [
      "Near-term climate data incomplete",
      "Données climatiques des prochaines années incomplètes",
      "بيانات مناخ السنوات القادمة ناقصة",
      "بيانات مناخ السنين القريبة ناقصة",
    ],
    [
      "The prepared near-term projection data for this area is missing some models or years, so it was not used.",
      "Les données de projection préparées pour les prochaines années manquent de certains modèles ou années pour cette zone : elles n'ont pas été utilisées.",
      "تنقص بيانات الإسقاطات المُعدّة للسنوات القادمة في هذه المنطقة بعض النماذج أو السنوات، لذلك لم تُستخدم.",
      "معطيات النماذج اللي تجهزات للسنين القريبة لهاد المنطقة ناقصين فيها شي نماذج ولا سنوات. داكشي علاش ما استعملناهاش.",
    ],
  ],
  [
    "NEAR_TERM_ANALOGS_INSUFFICIENT",
    [
      "Too few near-term seasons to compare",
      "Trop peu de campagnes des prochaines années à comparer",
      "مواسم قليلة للسنوات القادمة للمقارنة",
      "مواسم السنين القريبة ما كافيينش",
    ],
    [
      "The near-term projection did not give enough complete seasons to compare the rotations. It is a model projection of the next years, never a forecast of any season.",
      "La projection des prochaines années n'a pas fourni assez de campagnes complètes pour comparer les rotations. C'est une projection de modèles, jamais une prévision d'une campagne précise.",
      "لم توفر إسقاطات السنوات القريبة مواسم كاملة كافية لمقارنة الدورات الزراعية. هذه إسقاطات نماذج للسنوات القادمة، وليست تنبؤاً بطقس موسم معين.",
      "معطيات النماذج للسنين القريبة ما عطاتش مواسم كاملة كافية باش نقارنو الدورات. هادي سيناريوهات من النماذج للسنين الجاية، ماشي توقع الطقس ديال شي موسم بعينو.",
    ],
  ],
  [
    "WATER_STORAGE_NOT_IMPORTED",
    [
      "Water-storage record not loaded",
      "Relevé de stockage d'eau non chargé",
      "سجل تخزين المياه غير محمّل",
      "سجل مخزون الما ما تحملش",
    ],
    [
      "The GRACE water-storage record has not been loaded on this server yet.",
      "Le relevé de stockage d'eau GRACE n'a pas encore été chargé sur ce serveur.",
      "لم يُحمَّل سجل تخزين المياه GRACE على هذا الخادم بعد.",
      "سجل مخزون الما GRACE ما تحملش باقي فهاد الخادم، وداكشي علاش ما متوفرش.",
    ],
  ],
  [
    "WATER_STORAGE_OUTSIDE_IMPORT",
    [
      "Field outside the loaded area",
      "Parcelle hors de la zone chargée",
      "الحقل خارج المنطقة المحمَّلة",
      "القطعة خارج المنطقة المحملة",
    ],
    [
      "The GRACE record that was loaded does not cover the field's region.",
      "Le relevé GRACE chargé ne couvre pas la région de la parcelle.",
      "لا يغطي سجل GRACE المحمَّل منطقة الحقل.",
      "سجل GRACE اللي تحمل ما كيغطيش المنطقة اللي فيها القطعة ديالك.",
    ],
  ],
  [
    "WATER_STORAGE_SERIES_TOO_SHORT",
    [
      "Water-storage record too short",
      "Relevé de stockage d'eau trop court",
      "سجل تخزين المياه قصير جداً",
      "سجل مخزون الما قصير بزاف",
    ],
    [
      "There are too few years of GRACE data for this region to give a trend you can trust.",
      "Il y a trop peu d'années de données GRACE pour cette région pour donner une tendance fiable.",
      "عدد سنوات بيانات GRACE لهذه المنطقة قليل جداً لإعطاء اتجاه يمكن الوثوق به.",
      "سنوات بيانات GRACE لهاد المنطقة قليلين بزاف باش نعطيو اتجاه يمكن نعتمدو عليه.",
    ],
  ],
]);

export const resultStatusTerms = rows("status", [
  [
    "assessment_crops",
    [
      "Shared crop conditions",
      "Conditions communes par culture",
      "شروط مشتركة لكل محصول",
      "شروط مشتركة لكل زراعة",
    ],
    [
      "The rotation inherits each crop's conditions from the crop assessments in this result. Rotation-specific warnings remain on the candidate. This avoids repeating the same conditions at every slot.",
      "La rotation reprend les conditions de chaque culture dans les évaluations de ce résultat. Les avertissements propres à la rotation restent sur la candidate. Cela évite de répéter les mêmes conditions à chaque cycle.",
      "ترث الدورة شروط كل محصول من تقييمات المحاصيل في هذه النتيجة. تبقى التحذيرات الخاصة بالدورة مرفقة بها. يجنّب ذلك تكرار الشروط نفسها في كل حلقة.",
      "الدورة كتورث شروط كل زراعة من تقييمات الزراعات فهاد النتيجة. التحذيرات الخاصة بالدورة كتبقى معاها. بهاد الطريقة ما كنعاودوش نفس الشروط فكل حلقة.",
    ],
  ],
  [
    "candidate_climate_coverage",
    [
      "Climate coverage per rotation",
      "Couverture climatique par rotation",
      "التغطية المناخية لكل دورة",
      "تغطية المناخ لكل دورة",
    ],
    [
      "Compared means at least one rotation has a complete comparison. Each rotation lists the models and scenarios used or missing, separately for the near term and mid-century. Missing rotations receive no estimated climate score.",
      "Comparé signifie qu’au moins une rotation dispose d’une comparaison complète. Chaque rotation indique les modèles et scénarios utilisés ou manquants, pour les prochaines années et le milieu du siècle. Aucun score climatique n’est estimé pour les rotations incomplètes.",
      "تعني حالة المقارنة وجود دورة واحدة على الأقل بمقارنة مكتملة. تسرد كل دورة النماذج والسيناريوهات المستخدمة أو الناقصة، للسنوات القريبة ومنتصف القرن بشكل منفصل. لا تُقدّر درجة مناخية للدورات الناقصة.",
      "حالة المقارنة كتعني كاينة على الأقل دورة وحدة المقارنة ديالها كاملة. كل دورة كتبين النماذج والسيناريوهات المستعملة ولا الناقصة، بوحدهم للسنين القريبة ولوسط القرن. ما كنخمنوش نقطة المناخ للدورات الناقصة.",
    ],
  ],
  [
    "pinned_catalog",
    [
      "Evidence in the saved catalog",
      "Preuves dans le catalogue figé",
      "الأدلة في الكتالوج المثبت",
      "الأدلة فالكاتالوگ المحفوظ",
    ],
    [
      "Rule and research identifiers refer to the immutable catalog version and hash saved in this result. Full citations remain in that catalog; repeated copies are omitted to retain crop diversity within the response size budget.",
      "Les identifiants des règles et recherches renvoient à la version immuable du catalogue et à son empreinte enregistrées dans ce résultat. Les citations complètes y restent accessibles ; leurs copies répétées sont omises pour préserver la diversité des cultures dans la limite de taille.",
      "تشير معرّفات القواعد والأبحاث إلى إصدار الكتالوج الثابت وبصمته المحفوظين في النتيجة. تبقى الاستشهادات الكاملة فيه؛ وتُحذف النسخ المتكررة للحفاظ على تنوع المحاصيل ضمن حد حجم الاستجابة.",
      "معرّفات القواعد والأبحاث كيرجعو لنسخة الكاتالوگ الثابتة والبصمة ديالها المحفوظة فالنتيجة. المراجع كاملة كتبقى تما؛ كنحيدو غير النسخ المكررة باش يبقى تنوع الزراعات داخل حد حجم الجواب.",
    ],
  ],
  [
    "ready",
    ["Ready", "Prêt", "جاهز", "واجد"],
    [
      "The satellite analysis is done and its result is included.",
      "L'analyse satellite est terminée et son résultat est inclus.",
      "اكتمل تحليل بيانات الأقمار الاصطناعية، وأُدرجت نتيجته.",
      "تحليل بيانات الأقمار كمل والنتيجة ديالو مرفقة باش تشوفها.",
    ],
  ],
  [
    "unavailable",
    [
      "Not available yet",
      "Pas encore disponible",
      "غير متاح بعد",
      "ما متوفرش باقي",
    ],
    [
      "There is no analysis to show yet. The observation field says whether the data was never requested, is queued, was sent to NASA, or failed.",
      "Il n'y a pas encore d'analyse à afficher. Le champ « observation » indique si les données n'ont jamais été demandées, sont en attente, si la demande a été envoyée à la NASA ou si elle a échoué.",
      "لا يوجد تحليل لعرضه بعد. يبيّن حقل observation إن كانت البيانات لم تُطلب قط، أو كان الطلب في الانتظار، أو أُرسل إلى ناسا، أو فشل.",
      "ما كاين حتى تحليل يتعرض باقي. الخانة ديال الملاحظة كتبين واش البيانات ما تطلباتش، ولا الطلب كيتسنى، ولا تصيفط لناسا، ولا ما نجحش.",
    ],
  ],
  [
    "none",
    ["Never requested", "Jamais demandé", "لم يُطلب قط", "ما تطلبش باقي"],
    [
      "No satellite request has been made yet for this field and this kind of data.",
      "Aucune demande satellite n'a encore été faite pour cette parcelle et ce type de données.",
      "لم يُقدَّم بعد طلب بيانات أقمار اصطناعية لهذا الحقل ولهذا النوع من البيانات.",
      "حتى طلب ديال بيانات الأقمار ما تدار باقي لهاد القطعة ولهاد النوع من البيانات.",
    ],
  ],
  [
    "undetermined",
    [
      "Could not be determined",
      "Non déterminé",
      "تعذّر تحديده",
      "ما قدرناش نحددو",
    ],
    [
      "The data does not allow green seasons and low-greenness periods to be told apart; the reason is given with it.",
      "Les données ne permettent pas de distinguer saisons vertes et périodes de faible verdure ; la raison est indiquée.",
      "لا تسمح البيانات بالتمييز بين مواسم الاخضرار وفترات الاخضرار المنخفض؛ ويُذكر السبب معها.",
      "البيانات ما كتسمحش نفرقو بين مواسم الاخضرار والفترات اللي فيها الاخضرار قليل. السبب كيبان مع النتيجة.",
    ],
  ],
  [
    "ok",
    ["Enough history", "Historique suffisant", "سجل كافٍ", "السجل كافي"],
    [
      "There are enough years to compare this year with the field's own history.",
      "Il y a assez d'années pour comparer cette année à l'historique de la parcelle.",
      "توجد سنوات كافية لمقارنة هذه السنة بتاريخ الحقل.",
      "كاينين سنوات كافيين باش نقارنو هاد العام مع سجل القطعة ديال السنين اللي فاتو.",
    ],
  ],
  [
    "insufficient_history",
    [
      "Not enough years",
      "Pas assez d'années",
      "سنوات غير كافية",
      "السنوات ما كافياش",
    ],
    [
      "There are too few years of data to say what is usual for this field.",
      "Il y a trop peu d'années de données pour dire ce qui est habituel pour cette parcelle.",
      "عدد سنوات البيانات قليل جداً لمعرفة ما هو معتاد لهذا الحقل.",
      "سنوات البيانات قليلين بزاف باش نعرفو شنو هو المعتاد فهاد القطعة.",
    ],
  ],
  [
    "too_few_observations",
    [
      "Too few clear readings",
      "Trop peu de mesures exploitables",
      "قراءات صالحة قليلة جداً",
      "القياسات الصالحة قليلين بزاف",
    ],
    [
      "Clouds and gaps left too few usable satellite readings to find seasons.",
      "Les nuages et les trous ont laissé trop peu de mesures satellite exploitables pour trouver des saisons.",
      "تركت الغيوم والفجوات قراءات أقمار صالحة قليلة جداً لإيجاد المواسم.",
      "بسبب السحاب والنقص فالبيانات، بقاو قياسات صالحة من الأقمار قليلين بزاف باش نحددو المواسم.",
    ],
  ],
  [
    "no_distinct_seasonal_signal",
    [
      "No clear seasonal pattern",
      "Aucun rythme saisonnier net",
      "لا نمط موسمي واضح",
      "ما كاينش نمط موسمي واضح",
    ],
    [
      "The greenness stayed too flat to separate growing seasons from the rest of the year.",
      "La verdure est restée trop stable pour séparer les saisons de culture du reste de l'année.",
      "ظل الاخضرار ثابتاً جداً بحيث لا يمكن فصل مواسم النمو عن بقية السنة.",
      "الاخضرار بقى ثابت بزاف وما قدرناش نفرقو مواسم النمو على بقية العام.",
    ],
  ],
  [
    "too_few_dates",
    [
      "Too few dates",
      "Trop peu de dates",
      "تواريخ قليلة جداً",
      "التواريخ الصالحة قليلين بزاف",
    ],
    [
      "Too few usable dates in the long record to find a usually-low window.",
      "Trop peu de dates exploitables dans le long relevé pour trouver une période habituellement basse.",
      "عدد التواريخ ذات البيانات الصالحة في السجل الطويل غير كافٍ لتحديد فترة يكون فيها الاخضرار منخفضاً عادةً.",
      "فالسجل الطويل، التواريخ اللي فيها بيانات صالحة قليلين بزاف باش نلقاو فترة كيكون فيها الاخضرار ناقص عادة.",
    ],
  ],
  [
    "no_distinct_season",
    [
      "No distinct season",
      "Aucune saison distincte",
      "لا موسم متميز",
      "ما كاينش موسم كيبان بوحدو",
    ],
    [
      "The record shows no season that stands out from the rest of the year.",
      "Le relevé ne montre aucune saison qui se distingue du reste de l'année.",
      "لا يُظهر السجل موسماً يبرز عن بقية السنة.",
      "السجل ما كيبين حتى موسم كيتميز بوضوح على بقية العام.",
    ],
  ],
  [
    "no_data",
    ["No data", "Aucune donnée", "لا توجد بيانات", "ما كايناش بيانات"],
    [
      "No usable readings were found for this window.",
      "Aucune mesure exploitable n'a été trouvée pour cette période.",
      "لم تتوفر قراءات صالحة لهذه الفترة.",
      "ما لقينا حتى قياس صالح للاستعمال فهاد الفترة.",
    ],
  ],
  [
    "similar",
    [
      "Similar to neighbours",
      "Semblable aux voisins",
      "مشابه للبكسلات المجاورة",
      "بحال البكسلات اللي حداه",
    ],
    [
      "The field's pixel behaves like the surrounding pixels, so the coarse pixel represents the field well.",
      "Le pixel de la parcelle se comporte comme les pixels voisins : le pixel grossier représente bien la parcelle.",
      "يتصرف بكسل الحقل كالبكسلات المحيطة، فالبكسل الأقل دقة يمثل الحقل جيداً.",
      "البكسل ديال القطعة كيتغير بحال البكسلات اللي دايرين به. داكشي علاش البكسل الكبير كيمثل القطعة مزيان.",
    ],
  ],
  [
    "moderate",
    [
      "Somewhat different from neighbours",
      "Un peu différent des voisins",
      "يختلف قليلاً عن البكسلات المجاورة",
      "مختلف شوية على البكسلات اللي حداه",
    ],
    [
      "The field's pixel differs somewhat from the surrounding pixels, so the coarse pixel may only partly represent the field.",
      "Le pixel de la parcelle diffère un peu des pixels voisins : le pixel grossier ne représente peut-être qu'en partie la parcelle.",
      "يختلف بكسل الحقل قليلاً عن البكسلات المحيطة، فقد يمثل البكسل الأقل دقة الحقل جزئياً فقط.",
      "البكسل ديال القطعة مختلف شوية على البكسلات اللي دايرين به. يقدر البكسل الكبير يمثل غير جزء من حالة القطعة.",
    ],
  ],
  [
    "differs",
    [
      "Differs from neighbours",
      "Diffère des voisins",
      "يختلف عن البكسلات المجاورة",
      "مختلف على البكسلات اللي حداه",
    ],
    [
      "The field's pixel differs clearly from the surrounding pixels, so the coarse record may not describe the field. Do not rely on it alone.",
      "Le pixel de la parcelle diffère nettement des pixels voisins : le relevé grossier ne décrit peut-être pas la parcelle. Ne vous y fiez pas seul.",
      "يختلف بكسل الحقل بوضوح عن البكسلات المحيطة، فقد لا يصف السجل الأقل دقة الحقل. لا تعتمد عليه وحده.",
      "البكسل ديال القطعة مختلف بوضوح على اللي دايرين به. السجل ديال البكسل الكبير يقدر ما يوصفش القطعة مزيان. ما تعتمدش عليه بوحدو.",
    ],
  ],
  [
    "not_measured",
    ["Not compared", "Non comparé", "لم تُجرَ المقارنة", "ما تقارنش"],
    [
      "No neighbouring pixels were available to compare with.",
      "Aucun pixel voisin n'était disponible pour la comparaison.",
      "لم تتوفر بكسلات مجاورة للمقارنة.",
      "ما كانت حتى بكسلات مجاورة متوفرة باش نقارنو معاها.",
    ],
  ],
  [
    "rising",
    ["Rising", "En hausse", "في ارتفاع", "طالع"],
    [
      "The yearly peak of greenness has been going up over the years. The trend does not say why.",
      "Le pic annuel de verdure augmente au fil des ans. La tendance ne dit pas pourquoi.",
      "ذروة الاخضرار السنوية في ارتفاع عبر السنوات. ولا يبيّن الاتجاه السبب.",
      "أعلى قيمة ديال الاخضرار فكل عام كترتفع مع مرور السنين. هاد الاتجاه ما كيقولش شنو السبب.",
    ],
  ],
  [
    "falling",
    ["Falling", "En baisse", "في انخفاض", "هابط"],
    [
      "The yearly peak of greenness has been going down over the years. The trend does not say why.",
      "Le pic annuel de verdure diminue au fil des ans. La tendance ne dit pas pourquoi.",
      "ذروة الاخضرار السنوية في انخفاض عبر السنوات. ولا يبيّن الاتجاه السبب.",
      "أعلى قيمة ديال الاخضرار فكل عام كتنقص مع مرور السنين. هاد الاتجاه ما كيقولش شنو السبب.",
    ],
  ],
  [
    "no_clear_trend",
    [
      "No clear trend",
      "Aucune tendance nette",
      "لا اتجاه واضح",
      "ما كاينش اتجاه واضح",
    ],
    [
      "The yearly peak goes up and down without a steady direction.",
      "Le pic annuel monte et descend sans direction régulière.",
      "ترتفع الذروة السنوية وتنخفض دون اتجاه ثابت.",
      "أعلى قيمة فكل عام كتطلع وكتنزل بلا ما يكون اتجاه ثابت مع السنين.",
    ],
  ],
  [
    "not_computed",
    ["Not computed", "Non calculée", "لم يُحسب", "ما تحسبش"],
    [
      "The trend was not computed because there are too few years.",
      "La tendance n'a pas été calculée car il y a trop peu d'années.",
      "لم يُحسب الاتجاه لأن السنوات قليلة جداً.",
      "الاتجاه ما تحسبش حيث عدد السنوات اللي عندنا قليل بزاف.",
    ],
  ],
  [
    "close",
    ["Close agreement", "Bonne concordance", "توافق كبير", "توافق كبير"],
    [
      "The two satellite records follow each other closely in the years they share.",
      "Les deux relevés satellite se suivent de près pendant les années communes.",
      "تتغير قيم سجلَّي الأقمار الاصطناعية بطريقة متقاربة جداً خلال السنوات المشتركة بينهما.",
      "الجوج ديال سجلات الأقمار كيتغيرو بطريقة متقاربة بزاف فالسنين اللي مشتركة بينهم.",
    ],
  ],
  [
    "partial",
    ["Partial agreement", "Concordance partielle", "توافق جزئي", "توافق جزئي"],
    [
      "The two satellite records agree in part in the years they share.",
      "Les deux relevés satellite s'accordent en partie pendant les années communes.",
      "يتفق السجلان الفضائيان جزئياً في السنوات المشتركة.",
      "الجوج ديال سجلات الأقمار كيتوافقو غير فجزء من النتائج فالسنين اللي مشتركة بينهم.",
    ],
  ],
  [
    "weak",
    ["Weak agreement", "Faible concordance", "توافق ضعيف", "توافق ضعيف"],
    [
      "The two satellite records agree only weakly, a reason to look at the field yourself.",
      "Les deux relevés satellite ne s'accordent que faiblement : une raison d'aller voir la parcelle.",
      "التوافق بين سجلَّي الأقمار الاصطناعية ضعيف، وهذا يدعو إلى تفقد الحقل بنفسك.",
      "التوافق بين الجوج ديال سجلات الأقمار ضعيف. هادا سبب باش تمشي تشوف القطعة براسك.",
    ],
  ],
  [
    "insufficient_overlap",
    [
      "Too few shared years",
      "Trop peu d'années communes",
      "سنوات مشتركة قليلة",
      "السنين المشتركة قليلين بزاف",
    ],
    [
      "The two satellite records share too few years to be compared.",
      "Les deux relevés satellite ont trop peu d'années communes pour être comparés.",
      "يشترك السجلان الفضائيان في سنوات قليلة جداً لا تكفي للمقارنة.",
      "الجوج ديال سجلات الأقمار عندهم سنين مشتركة قليلين بزاف وما كافيينش باش نقارنوهم.",
    ],
  ],
]);

export const resultErrorCodes = rows("error", [
  [
    "OBSERVATION_UPSTREAM_FAILED",
    [
      "NASA could not prepare the data",
      "La NASA n'a pas pu préparer les données",
      "تعذّر على ناسا تجهيز البيانات",
      "ناسا ما قدراتش توجد البيانات",
    ],
    [
      "NASA's service reported that it could not prepare the requested data. A later request may work.",
      "Le service de la NASA a indiqué ne pas pouvoir préparer les données demandées. Une demande ultérieure peut aboutir.",
      "أفادت خدمة ناسا أنها لم تستطع تجهيز البيانات المطلوبة. وقد ينجح طلب لاحق.",
      "خدمة ناسا خبراتنا بلي ما قدراتش توجد البيانات المطلوبة. يقدر طلب آخر من بعد ينجح.",
    ],
  ],
  [
    "OBSERVATION_TIMEOUT",
    [
      "NASA took too long",
      "La NASA a mis trop de temps",
      "استغرقت ناسا وقتاً طويلاً",
      "ناسا خذات وقت طويل",
    ],
    [
      "NASA did not finish preparing the data in the allowed time. A later request may work.",
      "La NASA n'a pas fini de préparer les données dans le temps imparti. Une demande ultérieure peut aboutir.",
      "لم تُنهِ ناسا تجهيز البيانات في الوقت المسموح. وقد ينجح طلب لاحق.",
      "ناسا ما كملاتش تجهيز البيانات فالوقت المسموح. يقدر طلب آخر من بعد ينجح.",
    ],
  ],
]);
