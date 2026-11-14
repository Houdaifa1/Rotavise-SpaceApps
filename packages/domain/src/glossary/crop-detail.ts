import { rows } from "./types.js";

export const cropDetailReasons = rows("reason_code", [
  [
    "CROP_DETAIL_MISSING",
    [
      "Crop detail unavailable",
      "Détail de culture absent",
      "تفصيل المحصول غير متوفر",
      "تفصيل الزرعة ما متوفرش",
    ],
    [
      "This catalog does not record the indicated field or problem classification. An empty list or null is missing knowledge, not proof of absence.",
      "Ce catalogue ne renseigne pas le champ ou la catégorie de problème indiqué. Une liste vide ou une valeur nulle signale une information manquante, pas une absence prouvée.",
      "لا يسجل هذا الدليل الحقل أو تصنيف المشكلة المشار إليه. القائمة الفارغة أو القيمة الخالية تعني نقص المعرفة، لا إثبات عدم الوجود.",
      "هاد الدليل ما مسجلش المعلومة ولا صنف المشكل المشار ليه. اللائحة الخاوية ولا القيمة الخاوية كتعني المعلومة ناقصة، ماشي دليل باللي ما كايناش.",
    ],
  ],
  [
    "CROP_DETAIL_NAMES_INCOMPLETE",
    [
      "Name information incomplete",
      "Informations sur le nom incomplètes",
      "معلومات الاسم غير مكتملة",
      "معلومات السمية ناقصة",
    ],
    [
      "A name in this language, its evidence, confidence or preference is not recorded. The primary name has no assumed language. Null metadata does not confirm a name.",
      "Le nom dans cette langue, sa source, son niveau de confiance ou sa préférence n'est pas renseigné. Aucune langue n'est supposée pour le nom principal. Une valeur nulle ne confirme pas le nom.",
      "لم يسجل الاسم بهذه اللغة أو دليله أو درجة الثقة به أو تفضيله. لا تُفترض لغة للاسم الرئيسي. البيانات الخالية لا تؤكد الاسم.",
      "السمية بهاد اللغة، ولا الدليل ديالها، ولا درجة الثقة فيها، ولا واش مفضلة، ما مسجلينش. ما كنفرضوش لغة للسمية الرئيسية. المعلومة الخاوية ما كتأكدش السمية.",
    ],
  ],
  [
    "CROP_DETAIL_VERIFICATION_MISSING",
    [
      "Verification not recorded",
      "Vérification non renseignée",
      "التحقق غير مسجل",
      "التحقق ما مسجلش",
    ],
    [
      "A source citation is recorded, but this item has no recorded verification status. A citation alone does not mean independent checking or expert review.",
      "Une référence est renseignée, mais aucun statut de vérification n'est enregistré pour cet élément. Une citation seule ne vaut ni contrôle indépendant ni expertise.",
      "يوجد استشهاد بمصدر، لكن حالة التحقق من هذا العنصر غير مسجلة. الاستشهاد وحده لا يعني تحققاً مستقلاً أو مراجعة خبير.",
      "كاين مرجع للمصدر، ولكن حالة التحقق من هاد المعلومة ما مسجلاش. المرجع بوحدو ما كيعنيش تحقق مستقل ولا مراجعة خبير.",
    ],
  ],
  [
    "CROP_DETAIL_CATALOG_GAP",
    [
      "Recorded catalog limitation",
      "Lacune signalée dans le catalogue",
      "نقص مسجل في الدليل",
      "نقص مسجل فالدليل",
    ],
    [
      "The crop profile records a knowledge gap. Read its original reason alongside the available facts and rules; available values do not resolve that limitation.",
      "La fiche de culture signale une lacune. Lisez sa raison d'origine avec les faits et règles disponibles ; les valeurs présentes ne lèvent pas cette limite.",
      "يسجل ملف المحصول نقصاً في المعرفة. اقرأ السبب الأصلي مع الحقائق والقواعد المتاحة؛ وجود قيم لا يزيل هذا القيد.",
      "ملف الزرعة مسجل فيه نقص فالمعرفة. قرا السبب الأصلي مع المعلومات والقواعد الموجودة؛ القيم اللي كاينة ما كتحيدش هاد الحد.",
    ],
  ],
]);
