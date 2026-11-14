import { rows } from "./types.js";
export const researchTerms = rows("reason_code", [
  [
    "HISTORICAL_GROSS_REVENUE",
    [
      "Historical gross revenue",
      "Recette brute historique",
      "الإيراد الإجمالي التاريخي",
      "المداخيل الخام ديال الماضي",
    ],
    [
      "Derived yield times price for matched historical crop, product, year and region. Original units and inputs are listed. No costs deducted; not profit or a forecast.",
      "Rendement multiplié par prix, pour la même culture, le même produit, l'année et la région historiques. Unités et données conservées. Aucun coût déduit ; ni bénéfice ni prévision.",
      "قيمة مشتقة من حاصل ضرب الغلة في السعر لنفس المحصول والمنتج والسنة والمنطقة. تُعرض المدخلات والوحدات الأصلية دون خصم تكاليف؛ ليست ربحاً أو توقعاً.",
      "حساب من المردودية مضروبة فالثمن لنفس الزراعة والمنتوج والعام والجهة. المعطيات والوحدات الأصلية باينين؛ بلا نقص المصاريف، وماشي ربح ولا توقع.",
    ],
  ],
  [
    "NO_INCOME_DATA",
    [
      "No income data",
      "Données de revenu manquantes",
      "بيانات الدخل غير متاحة",
      "معطيات المدخول ناقصة",
    ],
    [
      "A compatible dated price and yield pair is missing. Published costs and margins keep their own definitions. Missing income is never replaced with zero revenue.",
      "Il manque un prix et un rendement compatibles et datés. Les coûts et marges publiés gardent leur définition. Un revenu manquant n'est jamais remplacé par zéro.",
      "ينقص سعر وغلة متوافقان ومؤرخان. تبقى التكاليف والهوامش المنشورة بتعريفاتها الأصلية، ولا يُستعاض عن الدخل المفقود بإيراد صفري.",
      "ناقصين ثمن ومردودية متوافقين وعندهم عام معروف. المصاريف والهوامش المنشورة كيبقاو بتعريفاتهم، والمدخول اللي ناقص ما كنعوضوهش بصفر.",
    ],
  ],
  [
    "INCOME_SUPPORTED_PEERS_ONLY",
    [
      "Income among supported peers",
      "Revenu entre options documentées",
      "الدخل بين الخيارات الموثقة",
      "المدخول بين الاختيارات الموثقة",
    ],
    [
      "Income can reorder fully documented rotations within their existing positions, for a common historical year and region. Unsupported rotations keep their positions; the comparison reports coverage and treatment.",
      "Le revenu peut réordonner les rotations entièrement documentées dans leurs positions existantes pour une année et une région communes. Les autres gardent leurs positions ; couverture et traitement sont indiqués.",
      "قد يعيد الدخل ترتيب الدورات الموثقة بالكامل داخل مواضعها لسنة ومنطقة مشتركتين. تحافظ الدورات غير الموثقة على مواضعها مع عرض التغطية وطريقة المعالجة.",
      "المدخول يقدر يرتب الدورات الموثقة كاملة داخل البلايص ديالها لنفس العام والجهة. الدورات اللي ناقصها الدليل كتبقى فبلاصتها، والتغطية والطريقة كيبانو.",
    ],
  ],
]);

export const researchStatuses = rows("status", [
  [
    "derived",
    ["Derived value", "Valeur calculée", "قيمة مشتقة", "قيمة محسوبة"],
    [
      "Calculated from the listed sourced inputs and formula. It is not a separately observed measurement, current quote or forecast.",
      "Valeur calculée à partir des données sourcées et de la formule indiquées. Ce n'est ni une mesure indépendante, ni un prix actuel, ni une prévision.",
      "قيمة محسوبة من المدخلات الموثقة والصيغة المبينة؛ ليست قياساً مستقلاً أو سعراً حالياً أو توقعاً.",
      "قيمة محسوبة من المعطيات الموثقة والصيغة اللي باينة؛ ماشي قياس مستقل ولا ثمن ديال دابا ولا توقع.",
    ],
  ],
  [
    "conditional_context",
    [
      "Conditional evidence",
      "Élément de contexte conditionnel",
      "دليل مشروط للسياق",
      "دليل للسياق بشروط",
    ],
    [
      "Sourced evidence retained with its region, management and partner-crop conditions. Those conditions are not assumed to hold on this field; numerical gaps remain unknown.",
      "Donnée sourcée conservée avec ses conditions de région, de gestion et de cultures associées. Ces conditions ne sont pas présumées remplies sur la parcelle ; les chiffres manquants restent inconnus.",
      "دليل موثق مع شروط المنطقة والإدارة والمحاصيل المرتبطة. لا يُفترض تحقق الشروط في الحقل، وتبقى القيم العددية الناقصة مجهولة.",
      "دليل موثق بالشروط ديال الجهة والتدبير والزراعات المرتبطة. ما كنفرضوش بلي هاد الشروط كاينة فالقطعة، والأرقام الناقصة كتبقى مجهولة.",
    ],
  ],
]);
