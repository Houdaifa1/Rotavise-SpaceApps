import { rows } from "./types.js";
export const rotationOutputReasons = rows("reason_code", [
  [
    "EXPOSURE_HEAT",
    [
      "Heat exposure",
      "Exposition à la chaleur",
      "التعرض للحرارة",
      "التعرض للسخونية",
    ],
    [
      "Historical days above this crop rule's upper temperature bound during the named stage; not a forecast of damage.",
      "Jours historiques au-dessus de la limite supérieure de température de cette règle, au stade indiqué ; aucune prévision de dégâts.",
      "أيام تاريخية تجاوزت الحد الأعلى للحرارة في قاعدة هذا المحصول خلال المرحلة المحددة؛ ليست توقعاً للأضرار.",
      "أيام فالماضي فاتت الحد الفوقاني ديال الحرارة لهاد الزراعة فالمرحلة المبينة؛ ماشي توقع ديال الضرر.",
    ],
  ],
  [
    "EXPOSURE_COLD",
    ["Cold exposure", "Exposition au froid", "التعرض للبرد", "التعرض للبرد"],
    [
      "Historical days below the crop rule's lower temperature bound. The bound may describe frost or a favourable range; it is not a frost forecast.",
      "Jours historiques sous la limite inférieure de la règle. Cette limite peut concerner le gel ou une plage favorable ; ce n'est pas une prévision de gel.",
      "أيام تاريخية دون الحد الأدنى لحرارة المحصول. قد يخص الحد الصقيع أو مجالاً ملائماً؛ ليس توقعاً للصقيع.",
      "أيام فالماضي نزلت فيها الحرارة تحت الحد ديال القاعدة. الحد يقدر يخص الجليد ولا المجال المناسب؛ ماشي توقع ديال الجليد.",
    ],
  ],
  [
    "EXPOSURE_RAIN_DEFICIT",
    [
      "Stage rain shortfall",
      "Déficit de pluie au stade",
      "عجز المطر في المرحلة",
      "نقص الشتا فالمرحلة",
    ],
    [
      "Historical stage crop water use minus rain, floored at zero. Soil storage and irrigation supply are absent, so this is not measured plant stress.",
      "Besoin en eau du stade moins la pluie historique, ramené à zéro si négatif. Sans réserve du sol ni apport d'irrigation, ce n'est pas un stress mesuré.",
      "احتياج المحصول للماء في المرحلة ناقص المطر التاريخي، وبحد أدنى صفر. لا يشمل مخزون التربة أو الري، فلا يمثل إجهاداً مقاساً.",
      "احتياج الزراعة للما فالمرحلة ناقص الشتا ديال الماضي، وأقل قيمة صفر. مخزون التربة والسقي ما داخلينش؛ ماشي قياس ديال العطش.",
    ],
  ],
  [
    "EXPOSURE_UNAVAILABLE",
    [
      "Exposure unavailable",
      "Exposition indisponible",
      "التعرض غير متاح",
      "التعرض ما متوفرش",
    ],
    [
      "A stage rule, its timing, water curve or complete weather is missing. No exposure number is filled in.",
      "Il manque une règle de stade, sa période, une courbe d'eau ou une météo complète. Aucun chiffre d'exposition n'est inventé.",
      "تنقص قاعدة المرحلة أو توقيتها أو منحنى الماء أو بيانات طقس كاملة؛ لا توضع قيمة افتراضية للتعرض.",
      "ناقص قانون المرحلة ولا وقتها ولا منحنى الما ولا معطيات الطقس كاملة؛ ما كنعوضوش النقص برقم مخترع.",
    ],
  ],
  [
    "TERRAIN_CONTEXT_UNRANKED",
    [
      "Terrain context only",
      "Relief à titre de contexte",
      "التضاريس للسياق فقط",
      "التضاريس غير للسياق",
    ],
    [
      "Pinned terrain and satellite summaries are reported as context. Their incomplete or unverified factors do not change rotation ranks.",
      "Les résumés figés du relief et des satellites sont fournis comme contexte. Leurs facteurs incomplets ou non vérifiés ne changent pas le classement.",
      "تُعرض ملخصات التضاريس والأقمار المحفوظة للسياق؛ عواملها الناقصة أو غير المتحققة لا تغير ترتيب الدورات.",
      "ملخصات التضاريس والأقمار اللي تحفظات كتظهر غير للسياق؛ العوامل الناقصة ولا ما متأكدينش منها ما كتبدلش الترتيب.",
    ],
  ],
  [
    "EROSION_FACTORS_MISSING",
    [
      "Missing erosion factors",
      "Facteurs d'érosion manquants",
      "عوامل تعرية ناقصة",
      "عوامل التعرية ناقصة",
    ],
    [
      "Full RUSLE soil loss needs rain erosivity, soil erodibility, slope length and steepness, cover management and support practices. Missing factors stay unknown.",
      "La perte de sol RUSLE exige l'érosivité de la pluie, l'érodibilité du sol, la longueur et la pente, la couverture et les pratiques de protection. Les facteurs absents restent inconnus.",
      "يتطلب فقدان التربة وفق RUSLE عوامل المطر وقابلية التربة للتعرية وطول المنحدر وانحداره والغطاء وممارسات الحماية؛ تبقى العوامل الناقصة مجهولة.",
      "حساب خسارة التربة ب RUSLE خاصو عوامل الشتا والتربة وطول الميلان والغطاء والحماية؛ العوامل اللي ناقصة كتبقى مجهولة.",
    ],
  ],
  [
    "INFILTRATION_DRAINAGE_UNKNOWN",
    [
      "Infiltration and drainage unknown",
      "Infiltration et drainage inconnus",
      "التسرب والصرف مجهولان",
      "تسرب الما والصرف مجهولين",
    ],
    [
      "Slope, surface stress and regional water storage do not establish field infiltration or drainage. No such measurement was found.",
      "La pente, le stress de surface et le stockage régional ne permettent pas de déterminer l'infiltration ou le drainage du champ. Aucune mesure trouvée.",
      "لا تحدد بيانات الانحدار وإجهاد السطح ومخزون الماء الإقليمي تسرب الماء أو صرفه في الحقل؛ لم يُعثر على قياس.",
      "الميلان والإجهاد فالسطح ومخزون الما فالجهة ما كيحدّدوش التسرب والصرف فالحقل؛ ما لقيناش قياس.",
    ],
  ],
  [
    "EQUIPMENT_DATA_UNAVAILABLE",
    [
      "Equipment evidence missing",
      "Données de matériel absentes",
      "أدلة المعدات ناقصة",
      "معطيات المعدات ناقصة",
    ],
    [
      "The catalog has no structured crop machinery or operation requirements. The farmer's limits are recorded, with no unsupported crop exclusion.",
      "Le catalogue ne contient pas d'exigences structurées de matériel ou d'opérations par culture. Les limites sont enregistrées sans exclusion non étayée.",
      "لا يتضمن الدليل متطلبات منظمة لآلات المحاصيل أو عملياتها؛ تُسجل حدود المزارع دون استبعاد محصول بلا دليل.",
      "الدليل ما فيهش متطلبات منظمة ديال الآلات والعمليات لكل زراعة؛ الحدود ديال الفلاح كتتسجل بلا ما نحيدو زراعة بلا دليل.",
    ],
  ],
  [
    "MARKET_ACCESS_DATA_UNAVAILABLE",
    [
      "Market-access evidence missing",
      "Données d'accès au marché absentes",
      "أدلة الوصول للسوق ناقصة",
      "معطيات الوصول للسوق ناقصة",
    ],
    [
      "The catalog has no crop market-access requirements. Local, regional or export access is recorded but does not change ranking or filtering.",
      "Le catalogue ne contient pas d'exigences d'accès au marché par culture. L'accès local, régional ou à l'export est enregistré sans changer le classement ou le filtrage.",
      "لا يتضمن الدليل متطلبات وصول المحاصيل للسوق؛ يُسجل الوصول المحلي أو الإقليمي أو التصدير دون تغيير الترتيب أو التصفية.",
      "الدليل ما فيهش شروط السوق لكل زراعة؛ الوصول المحلي ولا الجهوي ولا التصدير كيتسجل بلا ما يبدل الترتيب ولا التصفية.",
    ],
  ],
  [
    "INCOME_DATA_UNAVAILABLE",
    [
      "Income evidence missing",
      "Données de revenu absentes",
      "أدلة الدخل ناقصة",
      "معطيات المدخول ناقصة",
    ],
    [
      "Comparable net income with currency, area, period and costs was not found in the catalog. The requested income weight is unapplied.",
      "Aucun revenu net comparable avec devise, surface, période et coûts n'a été trouvé dans le catalogue. Le poids demandé pour le revenu n'est pas appliqué.",
      "لم يُعثر في الدليل على دخل صافٍ قابل للمقارنة بعملة ومساحة وفترة وتكاليف محددة؛ لا يُطبق وزن الدخل المطلوب.",
      "ما لقيناش فالدليل مدخول صافي قابل للمقارنة فيه العملة والمساحة والمدة والمصاريف؛ الوزن المطلوب للمدخول ما كيتطبقش.",
    ],
  ],
]);
