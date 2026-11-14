import { rows } from "./types.js";

// Reason codes about the crop, the region, the rules and the calendar. Each
// code is one the engine can return; the text says what it means for the
// farmer, not how the engine computed it.
export const cropReasonCodes = rows("reason_code", [
  [
    "CROP_NOT_IN_CATALOG",
    [
      "Crop not in the catalog",
      "Culture absente du catalogue",
      "المحصول غير موجود في دليل المحاصيل",
      "الزراعة ما كايناش فالدليل",
    ],
    [
      "Rotavise has no knowledge record for this crop yet, so it cannot be checked or ranked.",
      "Rotavise n'a pas encore de fiche de connaissances pour cette culture : elle ne peut être ni vérifiée ni classée.",
      "لا تتوفر لدى روتافيس بطاقة معرفية لهذا المحصول بعد، لذلك لا يمكن فحصه أو ترتيبه.",
      "روتافيس ما عندوش دابا معلومات على هاد الزراعة، وداكشي علاش ما يقدرش يتحقق منها ولا يرتبها فالمقارنة.",
    ],
  ],
  [
    "CATALOG_GAP",
    [
      "Known gap in the catalog",
      "Lacune connue du catalogue",
      "معلومات ناقصة في دليل المحاصيل",
      "معلومات ناقصة فالدليل",
    ],
    [
      "The catalog records that a topic for this crop is missing or not yet established. The result is limited accordingly.",
      "Le catalogue indique qu'un sujet est manquant ou non établi pour cette culture. Le résultat est limité en conséquence.",
      "يشير دليل المحاصيل إلى أن بعض المعلومات عن هذا المحصول ناقصة أو لم تثبت بعد. لذلك تظل النتيجة محدودة.",
      "الدليل كيبين بلي شي معلومات على هاد الزراعة ناقصة ولا ما تأكداتش باقي. هاد النقص كيحد من النتيجة.",
    ],
  ],
  [
    "CROP_EXCLUDED_BY_FARMER",
    [
      "Excluded by you",
      "Culture écartée à votre demande",
      "استبعدتَه أنت",
      "نتا اللي حيدتي هاد الزراعة",
    ],
    [
      "You asked for this crop not to be considered, so it was left out of the comparison.",
      "Vous avez demandé que cette culture ne soit pas envisagée : elle a été écartée de la comparaison.",
      "طلبتَ عدم النظر في هذا المحصول، لذلك استُبعد من المقارنة.",
      "طلبتي هاد الزراعة ما تدخلش فالاختيارات، وداكشي علاش تحيدات من المقارنة.",
    ],
  ],
  [
    "FARMER_EXCLUDED",
    [
      "Excluded by you",
      "Culture écartée à votre demande",
      "استبعدتَه أنت",
      "نتا اللي حيدتي هاد الزراعة",
    ],
    [
      "You asked for this crop not to be considered, so it was left out of the comparison.",
      "Vous avez demandé que cette culture ne soit pas envisagée : elle a été écartée de la comparaison.",
      "طلبتَ عدم النظر في هذا المحصول، لذلك استُبعد من المقارنة.",
      "طلبتي هاد الزراعة ما تدخلش فالاختيارات، وداكشي علاش تحيدات من المقارنة.",
    ],
  ],
  [
    "MODEL_TYPE_UNSUPPORTED",
    [
      "Crop type not planned yet",
      "Type de culture non planifiable",
      "نوع المحصول غير مدعوم في التخطيط بعد",
      "هاد النوع ما كيتخططش ليه باقي",
    ],
    [
      "This kind of crop (for example a wild-harvested plant) is described in the catalog but cannot yet be placed in a rotation plan.",
      "Ce type de culture (par exemple une plante cueillie à l'état sauvage) est décrit dans le catalogue mais ne peut pas encore entrer dans un plan de rotation.",
      "هذا النوع من المحاصيل (مثل النباتات التي تُجمع من البرية) مذكور في دليل المحاصيل، لكن لا يمكن إدراجه بعد في خطة للدورة الزراعية.",
      "هاد النوع، بحال النباتات اللي كتجمع من البرية، مذكور فالدليل ولكن ما يقدرش يدخل باقي فخطة ديال الدورة الزراعية.",
    ],
  ],
  [
    "REGION_UNRESOLVED",
    [
      "Region not identified",
      "Région non identifiée",
      "تعذّر تحديد المنطقة",
      "المنطقة ما تحدداتش",
    ],
    [
      "The field's location could not be matched to a catalog region, so region-specific rules cannot be applied.",
      "L'emplacement de la parcelle n'a pas pu être rattaché à une région du catalogue : les règles propres à la région ne peuvent pas être appliquées.",
      "تعذّر ربط موقع الحقل بمنطقة في دليل المحاصيل، فلا يمكن تطبيق القواعد الخاصة بالمنطقة.",
      "ما قدرناش نربطو بلاصة القطعة بشي منطقة فالدليل، وداكشي علاش القواعد الخاصة بالمنطقة ما يمكنش نطبقوها.",
    ],
  ],
  [
    "REGION_NOT_IN_CATALOG",
    [
      "Region not covered",
      "Région non couverte",
      "المنطقة غير مشمولة",
      "المنطقة ما مشمولاش",
    ],
    [
      "The catalog has no evidence for the region where the field is, so no result is given for it.",
      "Le catalogue ne contient aucune donnée pour la région de la parcelle : aucun résultat n'est donné.",
      "لا تتوفر في دليل المحاصيل بيانات عن المنطقة التي يقع فيها الحقل، لذلك لا تُعطى نتيجة لها.",
      "الدليل ما فيهش معطيات على المنطقة اللي فيها القطعة، وداكشي علاش ما كايناش نتيجة ليها.",
    ],
  ],
  [
    "REGION_BOUNDARY_UNAVAILABLE",
    [
      "Region boundary missing",
      "Limite de région indisponible",
      "حدود المنطقة غير متوفرة",
      "حدود المنطقة ما متوفراش",
    ],
    [
      "The catalog describes the region but has no map outline for it, so the field cannot be placed inside it.",
      "Le catalogue décrit la région mais n'en a pas le contour cartographique : la parcelle ne peut pas y être située.",
      "يصف دليل المحاصيل المنطقة لكن لا يملك حدودها على الخريطة، لذلك لا يمكن تحديد موضع الحقل داخلها.",
      "الدليل فيه وصف المنطقة ولكن ما فيهش حدودها فالخريطة، وداكشي علاش ما نقدرش نحددو واش القطعة داخلة فيها.",
    ],
  ],
  [
    "CROP_NOT_APPLICABLE_IN_REGION",
    [
      "Crop not documented for this region",
      "Culture non documentée pour cette région",
      "المحصول غير موثّق لهذه المنطقة",
      "ما كاينش توثيق للزراعة فهاد المنطقة",
    ],
    [
      "The catalog has no evidence that this crop is grown or has rules for the field's region, so it is treated as a gap, not as a refusal.",
      "Le catalogue ne fournit pas de source indiquant que cette culture est pratiquée, ni de règle pour cette culture dans la région de la parcelle. Cela signale un manque d'information, sans exclure la culture.",
      "لا يوجد في دليل المحاصيل ما يثبت زراعة هذا المحصول أو وجود قواعد له في منطقة الحقل، ويُعامل ذلك كثغرة لا كرفض.",
      "الدليل ما فيهش ما يثبت بلي هاد الزراعة كتدار فالمنطقة، ولا قواعد ديالها لهاد المنطقة. هادا نقص فالمعلومات وماشي سبب بوحدو باش نرفضوها.",
    ],
  ],
  [
    "NO_APPLICABLE_EVIDENCE",
    [
      "No applicable evidence",
      "Aucune donnée applicable",
      "لا توجد قواعد تنطبق على وضعك",
      "ما كايناش قواعد كتنطبق على وضعك",
    ],
    [
      "None of the catalog's rules for this crop apply to your region, farming system or situation.",
      "Aucune des règles du catalogue pour cette culture ne s'applique à votre région, votre système de culture ou votre situation.",
      "لا تنطبق أي من قواعد دليل المحاصيل الخاصة بهذا المحصول على منطقتك أو نظام زراعتك أو وضعك.",
      "حتى قاعدة فالدليل ديال هاد الزراعة ما كتنطبق على المنطقة ديالك ولا نظام الزراعة ولا الحالة ديالك.",
    ],
  ],
  [
    "PROFILE_REVIEW_PENDING",
    [
      "Profile not yet reviewed",
      "Fiche pas encore relue",
      "البطاقة لم تُراجع بعد",
      "الورقة ما راجعهاش مختص باقي",
    ],
    [
      "The crop's knowledge record has not been reviewed by a specialist. It is used, but it is not expert-reviewed.",
      "La fiche de la culture n'a pas été relue par un spécialiste. Elle est utilisée, mais elle n'est pas relue par un expert.",
      "لم يراجع مختص بطاقة هذا المحصول. تُستخدم البطاقة لكنها غير مراجَعة من خبير.",
      "ورقة المعلومات ديال هاد الزراعة ما راجعهاش مختص. كنستعملوها، ولكن ما عندهاش مراجعة ديال خبير.",
    ],
  ],
  [
    "FARMING_SYSTEM_UNRESOLVED",
    [
      "Farming system unknown",
      "Système de culture inconnu",
      "نظام الزراعة غير محدد",
      "ما معروفش واش بور ولا سقي",
    ],
    [
      "Rules differ between rainfed and irrigated systems, and the farming system was not given, so those rules cannot be applied.",
      "Les règles diffèrent entre culture pluviale et irriguée et le système n'a pas été indiqué : ces règles ne peuvent pas être appliquées.",
      "تختلف القواعد بين الزراعة البورية المعتمدة على الأمطار والزراعة المسقية. لم يُحدَّد النظام، لذلك لا يمكن تطبيق هذه القواعد.",
      "القواعد كتختلف بين البور والسقي، ونتا ما حددتيش النظام. داكشي علاش هاد القواعد ما يمكنش نطبقوها.",
    ],
  ],
  [
    "PRODUCTION_SYSTEM_UNRESOLVED",
    [
      "Production system unknown",
      "Système de production inconnu",
      "نظام الإنتاج غير محدد",
      "نظام الإنتاج ما تحددش",
    ],
    [
      "The production system (for example rainfed or irrigated) was not given, so rules that depend on it cannot be applied.",
      "Le système de production (par exemple pluvial ou irrigué) n'a pas été indiqué : les règles qui en dépendent ne peuvent pas être appliquées.",
      "لم يُحدَّد نظام الإنتاج (مثل الزراعة البورية أو المسقية)، لذلك لا يمكن تطبيق القواعد المرتبطة به.",
      "ما قلتيش شنو نظام الإنتاج، بحال البور ولا السقي، وداكشي علاش ما يمكنش نطبقو القواعد اللي كتحتاج هاد المعلومة.",
    ],
  ],
  [
    "SYSTEM_NOT_SUPPORTED",
    [
      "System not covered by the rule",
      "Système non couvert par la règle",
      "النظام غير مشمول بالقاعدة",
      "القاعدة ما كتغطيش هاد النظام",
    ],
    [
      "The catalog's rules for this crop do not cover your production system.",
      "Les règles du catalogue pour cette culture ne couvrent pas votre système de production.",
      "لا تغطي قواعد دليل المحاصيل لهذا المحصول نظام الإنتاج الذي تستخدمه.",
      "القواعد اللي فالدليل لهاد الزراعة ما كتغطيش نظام الإنتاج اللي كتستعمل.",
    ],
  ],
  [
    "CULTIVAR_NOT_IN_CATALOG",
    [
      "Variety not in the catalog",
      "Variété absente du catalogue",
      "الصنف غير موجود في دليل المحاصيل",
      "الصنف ما كاينش فالدليل",
    ],
    [
      "The variety you named is not in the catalog, so the crop's general rules are used instead.",
      "La variété indiquée n'est pas dans le catalogue : les règles générales de la culture sont utilisées à la place.",
      "الصنف الذي ذكرته غير موجود في دليل المحاصيل، لذلك تُستخدم القواعد العامة للمحصول بدلاً منه.",
      "الصنف اللي سميتي ما كاينش فالدليل. كنستعملو فبلاصتو القواعد العامة ديال هاد الزراعة.",
    ],
  ],
  [
    "CULTIVAR_UNRESOLVED",
    [
      "Variety not identified",
      "Variété non identifiée",
      "الصنف غير محدد",
      "الصنف ما تحددش",
    ],
    [
      "No variety was chosen, or it could not be matched, so the crop's general rules are used.",
      "Aucune variété n'a été choisie ou elle n'a pas pu être reconnue : les règles générales de la culture sont utilisées.",
      "لم يُختَر صنف أو تعذّرت مطابقته، لذلك تُستخدم القواعد العامة للمحصول.",
      "ما اخترتي حتى صنف، ولا ما قدرناش نلقاو الصنف المطابق. كنستعملو القواعد العامة ديال الزراعة.",
    ],
  ],
  [
    "RULE_NOT_VERIFIED",
    [
      "Rule not yet checked",
      "Règle non vérifiée",
      "القاعدة لم يُتحقق منها",
      "القاعدة ما تأكداتش باقي",
    ],
    [
      "The rule was extracted from a source but not yet checked against it, so it is not used to accept or refuse a crop.",
      "La règle a été extraite d'une source mais pas encore vérifiée par rapport à elle : elle ne sert pas à accepter ou refuser une culture.",
      "استُخرجت القاعدة من مصدر لكن لم تُقارن به بعد، لذلك لا تُستخدم لقبول محصول أو رفضه.",
      "القاعدة تخرجات من مصدر ولكن ما تقارناتش معاه باقي. داكشي علاش ما كنستعملوهاش باش نقبلو زراعة ولا نرفضوها.",
    ],
  ],
  [
    "RULE_NOT_REVIEWED",
    [
      "Rule not yet reviewed",
      "Règle non relue",
      "القاعدة لم تُراجع",
      "القاعدة ما راجعها حتى واحد باقي",
    ],
    [
      "The rule has not been reviewed by a person, so it is not used to accept or refuse a crop.",
      "La règle n'a pas été relue par une personne : elle ne sert pas à accepter ou refuser une culture.",
      "لم يراجع شخص القاعدة، لذلك لا تُستخدم لقبول محصول أو رفضه.",
      "حتى واحد ما راجع هاد القاعدة باقي، وداكشي علاش ما كتستعملش باش نقبلو زراعة ولا نرفضوها.",
    ],
  ],
  [
    "RULE_NOT_APPLICABLE",
    [
      "Rule does not apply",
      "Règle non applicable",
      "القاعدة لا تنطبق",
      "القاعدة ما كتنطبقش هنا",
    ],
    [
      "The rule is written for a different region, farming system, variety or stage than yours.",
      "La règle est écrite pour une autre région, un autre système, une autre variété ou un autre stade que les vôtres.",
      "كُتبت القاعدة لمنطقة أو نظام أو صنف أو مرحلة مختلفة عمّا لديك.",
      "هاد القاعدة مكتوبة لمنطقة ولا نظام زراعة ولا صنف ولا مرحلة نمو مختلفة على اللي عندك.",
    ],
  ],
  [
    "RULE_OUT_OF_SCOPE",
    [
      "Rule out of scope",
      "Règle hors périmètre",
      "القاعدة خارج النطاق",
      "القطعة خارج نطاق القاعدة",
    ],
    [
      "The rule's stated scope (for example its region) does not include your field, so it is set aside.",
      "Le périmètre déclaré de la règle (par exemple sa région) n'inclut pas votre parcelle : elle est écartée.",
      "نطاق القاعدة المعلن (مثل منطقتها) لا يشمل حقلك، لذلك تُترك جانباً.",
      "النطاق اللي محدد للقاعدة، بحال المنطقة ديالها، ما كيشملش القطعة ديالك. داكشي علاش كنخليوها على جنب.",
    ],
  ],
  [
    "RULE_SCOPE_UNSPECIFIED",
    [
      "Rule scope not stated",
      "Périmètre de la règle non précisé",
      "نطاق القاعدة غير مذكور",
      "نطاق القاعدة ما مذكورش",
    ],
    [
      "The rule does not say where it applies, so it is used with a warning that it may not fit your field.",
      "La règle ne précise pas où elle s'applique : elle est utilisée avec une réserve, car elle peut ne pas convenir à votre parcelle.",
      "لا تذكر القاعدة أين تنطبق، لذلك تُستخدم مع تنبيه بأنها قد لا تناسب حقلك.",
      "القاعدة ما كتقولش فين كتنطبق. كنستعملوها مع تنبيه حيث تقدر ما تناسبش القطعة ديالك.",
    ],
  ],
  [
    "RULE_CONDITIONS_UNRESOLVED",
    [
      "Rule has unresolved conditions",
      "Conditions de la règle à confirmer",
      "شروط القاعدة غير محسومة",
      "شروط القاعدة خاصها تأكيد",
    ],
    [
      "The rule only holds under conditions that Rotavise cannot check from your inputs, so its result is conditional.",
      "La règle n'est valable que sous des conditions que Rotavise ne peut pas vérifier avec vos données : son résultat est conditionnel.",
      "لا تصح القاعدة إلا بشروط لا تستطيع روتافيس التحقق منها من بياناتك، لذلك تكون نتيجتها مشروطة.",
      "هاد القاعدة كتصح غير بشروط ما يقدرش روتافيس يتحقق منها بالمعلومات اللي عطيتيه. داكشي علاش النتيجة كتبقى بشروط.",
    ],
  ],
  [
    "RULE_REFERENCE_ONLY",
    [
      "Reference rule only",
      "Règle de référence seulement",
      "قاعدة مرجعية فقط",
      "القاعدة غير للمعلومة",
    ],
    [
      "The rule is kept for information. It is shown but never used to accept, refuse or rank a crop.",
      "La règle est conservée à titre d'information : elle est affichée mais ne sert jamais à accepter, refuser ou classer une culture.",
      "تُحفظ القاعدة للإحاطة فقط؛ تُعرض لكنها لا تُستخدم أبداً لقبول محصول أو رفضه أو ترتيبه.",
      "هاد القاعدة كنحتافظو بها وكنبينوها غير للمعلومة. ما كتستعملش باش نقبلو زراعة ولا نرفضوها ولا نرتبوها.",
    ],
  ],
  [
    "RULE_STAGE_TIMING_UNKNOWN",
    [
      "Growth-stage timing unknown",
      "Calendrier des stades inconnu",
      "توقيت مراحل النمو غير معروف",
      "وقت مرحلة النمو ما معروفش",
    ],
    [
      "The rule applies to one growth stage, but when that stage happens is not known, so it cannot be placed in time.",
      "La règle concerne un stade de croissance dont la date n'est pas connue : elle ne peut pas être située dans le temps.",
      "تخص القاعدة مرحلة نمو معينة، لكن موعد هذه المرحلة غير معروف، لذلك لا يمكن تحديد وقت تطبيقها.",
      "القاعدة كتخص مرحلة معينة من النمو، ولكن ما معروفش فوقاش كتجي هاد المرحلة. ما نقدرش نحددو وقت تطبيق القاعدة.",
    ],
  ],
  [
    "RULE_MEASUREMENT_UNSUPPORTED",
    [
      "Measurement not supported",
      "Mesure non prise en charge",
      "القياس غير مدعوم",
      "هاد القياس ما كيتقارنش دابا",
    ],
    [
      "The rule is written for a measurement (for example a specific temperature basis) that Rotavise cannot compare with the data it has.",
      "La règle est écrite pour une mesure (par exemple une base de température précise) que Rotavise ne peut pas comparer aux données dont elle dispose.",
      "كُتبت القاعدة لقياس (مثل أساس حراري محدد) لا تستطيع روتافيس مقارنته بالبيانات المتوفرة لديها.",
      "القاعدة كتحتاج قياس معين، بحال طريقة محددة لقياس الحرارة، وروتافيس ما يقدرش يقارنو بالمعطيات اللي عندو.",
    ],
  ],
  [
    "CALENDAR_EVIDENCE_UNAVAILABLE",
    [
      "No sowing calendar",
      "Pas de calendrier de semis",
      "مواعيد الزرع غير متوفرة",
      "وقت الزرع ما معروفش",
    ],
    [
      "The catalog has no sourced sowing window for this crop in your region, so planting dates cannot be proposed.",
      "Le catalogue n'a aucune période de semis sourcée pour cette culture dans votre région : des dates ne peuvent pas être proposées.",
      "لا توجد في دليل المحاصيل فترة زرع موثقة لهذا المحصول في منطقتك، لذلك لا يمكن اقتراح مواعيد للزرع.",
      "الدليل ما فيهش فترة زرع بمصدر لهاد الزراعة فالمنطقة ديالك. داكشي علاش ما نقدرش نقترحو مواعيد الزرع.",
    ],
  ],
  [
    "DURATION_EVIDENCE_UNAVAILABLE",
    [
      "No cycle length",
      "Pas de durée de cycle",
      "مدة نمو المحصول غير متوفرة",
      "مدة الزراعة ما معروفةش",
    ],
    [
      "The catalog has no sourced length for this crop's cycle, so when it finishes cannot be worked out.",
      "Le catalogue n'a aucune durée sourcée pour le cycle de cette culture : sa date de fin ne peut pas être calculée.",
      "لا توجد في دليل المحاصيل مدة موثقة لدورة هذا المحصول، لذلك لا يمكن حساب موعد انتهائها.",
      "الدليل ما فيهش مدة موثقة لهاد الزراعة من البداية للنهاية، وداكشي علاش ما نقدرش نحسبو فوقاش غادي تسالي.",
    ],
  ],
  [
    "DURATION_ENVELOPE",
    [
      "Cycle length range used",
      "Fourchette de durée utilisée",
      "نطاق مدة الدورة المستخدم",
      "استعملنا أقصر وأطول مدة",
    ],
    [
      "The cycle was given as a shortest-to-longest range from the catalog, and the dates shown cover that whole range.",
      "Le cycle est donné comme une fourchette du plus court au plus long, tirée du catalogue, et les dates affichées couvrent toute cette fourchette.",
      "أُعطيت الدورة كنطاق من الأقصر إلى الأطول من دليل المحاصيل، وتغطي التواريخ المعروضة هذا النطاق كاملاً.",
      "المدة ديال الزراعة خذيناها من الدليل، من أقصر مدة لأطول مدة. التواريخ اللي باينة كتغطي هاد المدة كاملة.",
    ],
  ],
  [
    "CALENDAR_OUTSIDE_FIRST_RANGE",
    [
      "First crop outside its sowing window",
      "Première culture hors période de semis",
      "المحصول الأول خارج فترة زرعه",
      "الزراعة اللولة خارج وقت الزرع",
    ],
    [
      "The first crop cannot be sown inside its catalog window within the dates you gave.",
      "La première culture ne peut pas être semée dans sa période du catalogue avec les dates indiquées.",
      "لا يمكن زراعة المحصول الأول ضمن فترة زرعه في دليل المحاصيل خلال التواريخ التي أعطيتها.",
      "ما يمكنش نزرعو الزراعة اللولة فالفترة ديالها اللي فالدليل، داخل التواريخ اللي عطيتي.",
    ],
  ],
  [
    "FIRST_WINDOW_OUTSIDE_RANGE",
    [
      "First sowing window out of range",
      "Première période de semis hors plage",
      "فترة الزرع الأولى خارج المدى",
      "وقت الزرع اللول خارج مدة التخطيط",
    ],
    [
      "No sowing window of the first crop falls inside the period being planned.",
      "Aucune période de semis de la première culture ne tombe dans la période planifiée.",
      "لا تقع أي فترة زرع للمحصول الأول داخل الفترة المخطط لها.",
      "حتى فترة زرع ديال الزراعة اللولة ما كتجي داخل المدة اللي كنخططو ليها.",
    ],
  ],
  [
    "NO_WINDOW_BEFORE_HORIZON",
    [
      "No sowing window before the end",
      "Aucune période avant la fin",
      "لا توجد فترة زرع قبل النهاية",
      "ما كاينش وقت للزرع قبل النهاية",
    ],
    [
      "After the previous crop, no sowing window of the next crop opens before the end of the planning period.",
      "Après la culture précédente, aucune période de semis de la culture suivante ne s'ouvre avant la fin de la période de planification.",
      "بعد المحصول السابق لا تُفتح أي فترة زرع للمحصول التالي قبل نهاية فترة التخطيط.",
      "من بعد الزراعة اللي فاتت، حتى فترة زرع ديال الزراعة اللي جاية ما كتبدا قبل ما تسالي مدة التخطيط.",
    ],
  ],
  [
    "SECOND_CALENDAR_UNAVAILABLE",
    [
      "No calendar for the second crop",
      "Pas de calendrier pour la 2e culture",
      "لا يوجد تقويم للمحصول الثاني",
      "وقت الزراعة الثانية ما معروفش",
    ],
    [
      "The second crop has no sourced sowing window, so the second cycle cannot be dated.",
      "La seconde culture n'a pas de période de semis sourcée : le second cycle ne peut pas être daté.",
      "ليس للمحصول الثاني فترة زرع موثقة، لذلك لا يمكن تحديد تواريخ الدورة الثانية.",
      "الزراعة الثانية ما عندهاش فترة زرع موثقة بمصدر. داكشي علاش ما يمكنش نحددو تواريخ الدورة الثانية.",
    ],
  ],
  [
    "NON_OVERLAPPING_CYCLES",
    [
      "Cycles do not overlap",
      "Cycles sans chevauchement",
      "الدورتان لا تتداخلان",
      "الزراعتين ما كيتلاقاوش فالوقت",
    ],
    [
      "The second crop can be sown after the first one is harvested, so the two cycles do not clash.",
      "La seconde culture peut être semée après la récolte de la première : les deux cycles ne se chevauchent pas.",
      "يمكن زراعة المحصول الثاني بعد حصاد الأول، فلا تتعارض الدورتان.",
      "نقدرو نزرعو الزراعة الثانية من بعد حصاد اللولة، وداكشي علاش المدتين ديال الزراعتين ما كيتداخلوش.",
    ],
  ],
  [
    "SEARCH_HORIZON_EXCEEDED",
    [
      "Planning period exceeded",
      "Période de planification dépassée",
      "تجاوز مدة التخطيط",
      "الدورة كتفوت مدة التخطيط",
    ],
    [
      "A rotation would run past the end of the period being planned, so it is not offered.",
      "Une rotation dépasserait la fin de la période planifiée : elle n'est donc pas proposée.",
      "ستتجاوز الدورة الزراعية نهاية الفترة المخطط لها، لذلك لا تُعرض.",
      "هاد الدورة غادي تفوت نهاية المدة اللي كنخططو ليها، وداكشي علاش ما كنقترحوهاش.",
    ],
  ],
  [
    "SEARCH_PRUNED",
    [
      "Some rotations skipped",
      "Certaines rotations écartées",
      "استُبعدت بعض الدورات الزراعية",
      "شي دورات ما تحسبوش",
    ],
    [
      "To stay fast, the search set aside some less promising rotations without scoring them. The ones shown are the best of those examined, not of every possible rotation.",
      "Pour rester rapide, la recherche a écarté des rotations moins prometteuses sans les noter. Celles affichées sont les meilleures parmi celles examinées, pas parmi toutes les rotations possibles.",
      "للحفاظ على السرعة تجاوز البحث بعض الدورات الزراعية الأقل وعداً دون تقييمها. المعروض هو الأفضل بين ما فُحص لا بين كل الدورات الزراعية الممكنة.",
      "باش يبقى البحث سريع، خلينا على جنب شي دورات اللي كتبان أقل فائدة بلا ما نعطيوها نقط. اللي باين هو الأفضل من اللي فحصنا، ماشي من جميع الدورات الممكنة.",
    ],
  ],
  [
    "SEARCH_TRUNCATED",
    [
      "Search stopped at its limit",
      "Recherche arrêtée à sa limite",
      "توقف البحث عند حدّه",
      "البحث وصل للحد ووقف",
    ],
    [
      "The search reached its size limit and stopped, so better rotations than those shown may exist.",
      "La recherche a atteint sa limite de taille et s'est arrêtée : il peut exister de meilleures rotations que celles affichées.",
      "بلغ البحث حدّه الأقصى وتوقف، لذلك قد توجد دورات زراعية أفضل مما هو معروض.",
      "البحث وصل للحد ديال الحجم ديالو ووقف. تقدر تكون كاينة شي دورة حسن من اللي باينين.",
    ],
  ],
  [
    "NOT_EXPERT_REVIEWED",
    [
      "Not expert-reviewed",
      "Non relu par un expert",
      "غير مراجَع من خبير",
      "ما راجعوش خبير",
    ],
    [
      "The rules behind this result have not been reviewed by an agronomist. Treat it as a decision aid and confirm locally.",
      "Les règles derrière ce résultat n'ont pas été relues par un agronome. Considérez-le comme une aide à la décision et confirmez localement.",
      "لم يراجع مهندس زراعي القواعد التي تقوم عليها هذه النتيجة. اعتبرها أداة مساعدة للقرار وتأكد منها محلياً.",
      "القواعد اللي بنينا عليها هاد النتيجة ما راجعهاش مهندس فلاحي. استعملها باش تعاونك فالقرار، وتأكد منها مع مختص فالمنطقة.",
    ],
  ],
]);
