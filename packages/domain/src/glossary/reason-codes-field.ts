import { rows } from "./types.js";

// Reason codes about the field's soil, history, crop health, water, weather,
// climate and the ranking itself.
export const fieldReasonCodes = rows("reason_code", [
  [
    "SOIL_UNKNOWN",
    [
      "Soil not described",
      "Sol non renseigné",
      "التربة غير موصوفة",
      "معلومات التربة ما تعطاوش",
    ],
    [
      "No soil measurement was given, so soil limits could not be checked against your field.",
      "Aucune mesure de sol n'a été fournie : les limites liées au sol n'ont pas pu être vérifiées pour votre parcelle.",
      "لم تُقدَّم قياسات للتربة، لذلك تعذّر التحقق من ملاءمة تربة حقلك للحدود المطلوبة للمحصول.",
      "ما عطيتي حتى قياس للتربة، وداكشي علاش ما قدرناش نتحققو واش تربة القطعة ديالك كتحترم الحدود المطلوبة للزراعة.",
    ],
  ],
  [
    "SOIL_KNOWLEDGE_UNAVAILABLE",
    [
      "No soil knowledge for this crop",
      "Besoins en sol non documentés pour cette culture",
      "متطلبات التربة لهذا المحصول غير متوفرة",
      "متطلبات التربة ما معروفاش",
    ],
    [
      "The catalog has no soil limits for this crop, so soil could not be checked.",
      "Le catalogue n'a pas de limites de sol pour cette culture : le sol n'a pas pu être vérifié.",
      "لا توجد في دليل المحاصيل حدود لخصائص التربة المطلوبة لهذا المحصول، لذلك تعذّر فحص ملاءمة التربة.",
      "الدليل ما فيهش حدود ديال خصائص التربة لهاد الزراعة، وداكشي علاش ما قدرناش نتحققو من ملاءمة التربة.",
    ],
  ],
  [
    "SOIL_METRIC_UNAVAILABLE",
    [
      "Soil measurement missing",
      "Mesure de sol manquante",
      "قياس للتربة غير متوفر",
      "شي قياس ديال التربة ناقص",
    ],
    [
      "The rule needs a soil measurement (for example pH) that was not given or has no date.",
      "La règle exige une mesure de sol (par exemple le pH) qui n'a pas été fournie ou n'est pas datée.",
      "تحتاج القاعدة إلى قياس للتربة (مثل الحموضة pH) لم يُقدَّم أو ليس له تاريخ.",
      "القاعدة كتحتاج قياس ديال التربة، بحال الحموضة pH، ما عطيتيهش ولا ما فيهش تاريخ القياس.",
    ],
  ],
  [
    "SOIL_DATE_UNKNOWN",
    [
      "Soil measurement undated",
      "Mesure de sol non datée",
      "قياس التربة بلا تاريخ",
      "قياس التربة بلا تاريخ",
    ],
    [
      "The soil measurement has no date, so it is used with a warning because soil changes over time.",
      "La mesure de sol n'a pas de date : elle est utilisée avec une réserve, car le sol évolue avec le temps.",
      "ليس لقياس التربة تاريخ، لذلك يُستخدم مع تنبيه لأن التربة تتغير مع الزمن.",
      "قياس التربة ما فيهش تاريخ. كنستعملوه مع تنبيه حيث التربة كتبدل مع الوقت.",
    ],
  ],
  [
    "SOIL_METHOD_MISMATCH",
    [
      "Soil method differs",
      "Méthode de mesure différente",
      "طريقة قياس التربة مختلفة",
      "طريقة قياس التربة مختلفة",
    ],
    [
      "Your soil measurement used a different method than the rule (for example pH in water versus in salt solution), so they cannot be compared directly.",
      "Votre mesure de sol utilise une méthode différente de celle de la règle (par exemple pH dans l'eau ou en solution saline) : elles ne sont pas directement comparables.",
      "استخدم قياس تربتك طريقة مختلفة عن طريقة القاعدة (مثل pH في الماء مقابل محلول ملحي)، لذلك لا تصح المقارنة المباشرة.",
      "الطريقة اللي تقاست بها التربة ديالك مختلفة على طريقة القاعدة، بحال pH فالما ولا فمحلول ملحي. ما يمكنش نقارنوهم مباشرة.",
    ],
  ],
  [
    "SOIL_PH_OUTSIDE_RANGE",
    [
      "Soil pH outside the range",
      "pH du sol hors plage",
      "درجة حموضة التربة خارج المجال",
      "حموضة التربة خارج المجال",
    ],
    [
      "The soil pH you gave is outside the range the catalog lists for this crop.",
      "Le pH du sol indiqué est hors de la plage donnée par le catalogue pour cette culture.",
      "درجة حموضة التربة (pH) التي قدّمتها خارج المجال المذكور في دليل المحاصيل لهذا المحصول.",
      "درجة الحموضة pH اللي عطيتي ديال التربة خارج المجال اللي فالدليل لهاد الزراعة.",
    ],
  ],
  [
    "SOIL_PH_WITHIN_RANGE",
    [
      "Soil pH within the range",
      "pH du sol dans la plage",
      "درجة حموضة التربة ضمن المجال",
      "حموضة التربة داخل المجال",
    ],
    [
      "The soil pH you gave is inside the range the catalog lists for this crop.",
      "Le pH du sol indiqué est dans la plage donnée par le catalogue pour cette culture.",
      "درجة حموضة التربة (pH) التي قدّمتها ضمن المجال المذكور في دليل المحاصيل لهذا المحصول.",
      "درجة الحموضة pH اللي عطيتي ديال التربة داخل المجال اللي فالدليل لهاد الزراعة.",
    ],
  ],
  [
    "SOIL_LIMIT_FAILED",
    [
      "Soil limit not met",
      "Limite de sol non respectée",
      "خاصية التربة لا تستوفي الحد المطلوب",
      "التربة ما كتحترمش حد ضروري",
    ],
    [
      "A measured soil value is outside a limit that the catalog treats as binding for this crop.",
      "Une valeur mesurée du sol est en dehors d'une limite obligatoire du catalogue pour cette culture.",
      "إحدى القيم المقاسة للتربة خارج حدّ يعتبره دليل المحاصيل ملزماً لهذا المحصول.",
      "شي قيمة مقاسة فالتربة خارج واحد الحد اللي الدليل كيعتابرو ضروري لهاد الزراعة.",
    ],
  ],
  [
    "SOIL_LIMIT_WARNING",
    [
      "Soil value near or beyond a soft limit",
      "Valeur du sol proche ou au-delà d'un seuil indicatif",
      "قيمة التربة قريبة من حد إرشادي أو تتجاوزه",
      "قيمة التربة قريبة من حد إرشادي ولا فاتاتو",
    ],
    [
      "A measured soil value is outside a limit that is advice, not a hard limit, so the crop stays possible with a warning.",
      "Une valeur de sol mesurée dépasse une limite qui est un conseil et non une limite stricte : la culture reste possible avec une réserve.",
      "قيمة تربة مقيسة خارج حدّ هو توصية لا حد صارم، لذلك يبقى المحصول ممكناً مع تنبيه.",
      "شي قيمة مقاسة فالتربة خارج حد إرشادي، ماشي حد كيمنع الزراعة. هاد الزراعة كتبقى ممكنة ولكن مع تنبيه.",
    ],
  ],
  [
    "SOIL_LIMIT_PASSED",
    [
      "Soil limit met",
      "Limite de sol respectée",
      "خاصية التربة تستوفي الحد المطلوب",
      "التربة كتحترم الحد المطلوب",
    ],
    [
      "A measured soil value is within the limit the catalog lists for this crop.",
      "Une valeur de sol mesurée respecte la limite donnée par le catalogue pour cette culture.",
      "قيمة تربة مقيسة ضمن الحد المذكور في دليل المحاصيل لهذا المحصول.",
      "شي قيمة مقاسة فالتربة داخل الحد اللي كيعطي الدليل لهاد الزراعة.",
    ],
  ],
  [
    "SOIL_CHECK_UNIMPLEMENTED",
    [
      "Soil check not available yet",
      "Contrôle de sol pas encore disponible",
      "فحص التربة غير متاح بعد",
      "فحص التربة ما متوفرش باقي",
    ],
    [
      "The catalog has a soil rule of a kind Rotavise cannot evaluate yet, so it was shown but not applied.",
      "Le catalogue contient une règle de sol d'un type que Rotavise ne sait pas encore évaluer : elle est affichée mais non appliquée.",
      "في دليل المحاصيل قاعدة تربة من نوع لا تستطيع روتافيس تقييمه بعد، لذلك عُرضت دون تطبيقها.",
      "الدليل فيه قاعدة على التربة من نوع ما يقدرش روتافيس يقيّمو دابا. القاعدة باينة ولكن ما تطبقاتش.",
    ],
  ],
  [
    "SOIL_ESTIMATE_USED",
    [
      "Satellite-based soil estimate used",
      "Estimation de sol par satellite utilisée",
      "استُخدم تقدير للتربة مبني على بيانات الأقمار الاصطناعية",
      "استعملنا تقدير للتربة ببيانات الأقمار",
    ],
    [
      "You gave no soil measurement, so a coarse map-based estimate (SoilGrids) for your location was used. It is not a field measurement.",
      "Vous n'avez fourni aucune mesure de sol : une estimation cartographique grossière (SoilGrids) pour votre emplacement a été utilisée. Ce n'est pas une mesure sur la parcelle.",
      "لم تقدّم قياساً للتربة، فاستُخدم تقدير خرائطي تقريبي (SoilGrids) لموقعك. وهو ليس قياساً في الحقل.",
      "ما عطيتي حتى قياس للتربة. استعملنا تقدير تقريبي من خريطة SoilGrids للبلاصة ديالك. هادا ماشي قياس من القطعة.",
    ],
  ],
  [
    "SOIL_ESTIMATE_OUTSIDE",
    [
      "Soil estimate outside the range",
      "Estimation de sol hors plage",
      "تقدير التربة خارج المجال",
      "تقدير التربة خارج المجال",
    ],
    [
      "The map-based soil estimate for your location is outside the crop's range. Because it is only an estimate, test your soil before deciding.",
      "L'estimation cartographique du sol pour votre emplacement est hors de la plage de la culture. Comme ce n'est qu'une estimation, faites analyser votre sol avant de décider.",
      "تقدير التربة الخرائطي لموقعك خارج مجال المحصول. ولأنه تقدير فقط، افحص تربتك قبل أن تقرر.",
      "تقدير التربة من الخريطة للبلاصة ديالك خارج المجال ديال الزراعة. حيث هو غير تقدير، دير تحليل للتربة قبل ما تقرر.",
    ],
  ],
  [
    "SOIL_ESTIMATE_UNAVAILABLE",
    [
      "No soil estimate available",
      "Aucune estimation de sol disponible",
      "لا يتوفر تقدير للتربة",
      "تقدير التربة ما متوفرش",
    ],
    [
      "No soil measurement was given and no map-based estimate could be obtained for this location.",
      "Aucune mesure de sol n'a été fournie et aucune estimation cartographique n'a pu être obtenue pour cet emplacement.",
      "لم يُقدَّم قياس للتربة ولم يمكن الحصول على تقدير خرائطي لهذا الموقع.",
      "ما عطيتي حتى قياس للتربة، وما قدرناش نجيبو تقدير من الخريطة لهاد البلاصة.",
    ],
  ],
  [
    "SOIL_PREFERENCES_UNEVEN",
    [
      "Soil preferences known for only some crops",
      "Préférences de sol connues pour certaines cultures seulement",
      "خصائص التربة المفضلة معروفة لبعض المحاصيل فقط",
      "التربة المفضلة معروفة غير لشي زراعات",
    ],
    [
      "Some crops in the comparison have soil preferences in the catalog and others do not, so the soil comparison is only partly fair.",
      "Certaines cultures comparées ont des préférences de sol dans le catalogue et d'autres non : la comparaison selon le sol n'est que partiellement équitable.",
      "لبعض المحاصيل المقارَنة تفضيلات تربة في دليل المحاصيل ولبعضها لا، لذلك تكون مقارنة التربة عادلة جزئياً فقط.",
      "الدليل فيه خصائص التربة المفضلة لشي زراعات فالمقارنة، وزراعات خرين ما عندهمش. المقارنة فهاد الجانب ماشي منصفة بالكامل.",
    ],
  ],
  [
    "HISTORY_UNKNOWN",
    [
      "Crop history not given",
      "Historique de cultures non fourni",
      "سجل المحاصيل السابقة غير مقدَّم",
      "الزراعات اللي فاتو ما تعطاوش",
    ],
    [
      "Previous crops were not given, so rotation rules that depend on what grew before cannot be checked.",
      "Les cultures précédentes n'ont pas été indiquées : les règles de rotation qui dépendent de ce qui a été cultivé avant ne peuvent pas être vérifiées.",
      "لم تُذكر المحاصيل السابقة، لذلك لا يمكن فحص قواعد الدورة الزراعية التي تعتمد على ما زُرع قبلها.",
      "ما قلتيش شنو تزرع من قبل. داكشي علاش ما نقدرش نتحققو من قواعد الدورة الزراعية اللي كتحتاج هاد المعلومة.",
    ],
  ],
  [
    "HISTORY_PARTIAL",
    [
      "Crop history incomplete",
      "Historique de cultures incomplet",
      "سجل المحاصيل السابقة ناقص",
      "سجل الزراعات ما كاملش",
    ],
    [
      "Only some of the previous seasons were given, so a rule about earlier years may be missed.",
      "Seules certaines campagnes précédentes ont été indiquées : une règle liée à des années plus anciennes risque de ne pas être prise en compte.",
      "ذُكرت بعض المواسم السابقة فقط، لذلك قد تفوت قاعدة تخص سنوات أقدم.",
      "عطيتي غير شي مواسم اللي فاتو. تقدر تكون قاعدة كتخص سنوات أقدم ما نقدرش ناخدوها بعين الاعتبار.",
    ],
  ],
  [
    "HISTORY_DATES_UNKNOWN",
    [
      "Crop history undated",
      "Historique sans dates",
      "سجل المحاصيل بلا تواريخ",
      "الزراعات اللي فاتو بلا تواريخ",
    ],
    [
      "Previous crops have no planting or harvest dates, so waiting periods between crops cannot be measured.",
      "Les cultures précédentes n'ont ni date de semis ni date de récolte : les délais entre cultures ne peuvent pas être mesurés.",
      "ليست للمحاصيل السابقة تواريخ زراعة أو حصاد، لذلك لا يمكن قياس فترات الانتظار بين المحاصيل.",
      "الزراعات اللي فاتو ما عندهمش تواريخ الزرع ولا الحصاد. ما نقدرش نحسبو شحال خاص يتسنى بين زراعة وزراعة.",
    ],
  ],
  [
    "HISTORY_COVERAGE_UNESTABLISHED",
    [
      "History length not established",
      "Durée de l'historique non établie",
      "مدى السجل غير محدد",
      "ما معروفش شحال كيغطي السجل",
    ],
    [
      "It is not known how far back your history goes, so absence of a crop in it does not prove it was not grown.",
      "On ne sait pas jusqu'où remonte votre historique : l'absence d'une culture n'est donc pas la preuve qu'elle n'a pas été cultivée.",
      "لا يُعرف إلى أي مدى يمتد سجلك، لذلك فغياب محصول عنه لا يثبت أنه لم يُزرع.",
      "ما معروفش لشحال من عام كيرجع السجل ديالك. إلا ما لقيناش فيه شي زراعة، هادا ما كيثبتش بلي ما تزرعاتش من قبل.",
    ],
  ],
  [
    "PREVIOUS_CROP_UNRESOLVED",
    [
      "Previous crop not recognised",
      "Culture précédente non reconnue",
      "المحصول السابق غير معروف",
      "الزراعة اللي فاتت ما تعرفاتش",
    ],
    [
      "A previous crop could not be matched to the catalog, so its botanical family is unknown for rotation rules.",
      "Une culture précédente n'a pas pu être rattachée au catalogue : sa famille botanique est inconnue pour les règles de rotation.",
      "تعذّر ربط محصول سابق بدليل المحاصيل، لذلك تُجهل فصيلته النباتية في قواعد الدورة الزراعية.",
      "ما قدرناش نلقاو الزراعة اللي فاتت فالدليل. داكشي علاش الفصيلة النباتية ديالها ما معروفةش باش نطبقو قواعد الدورة الزراعية.",
    ],
  ],
  [
    "ROTATION_KNOWLEDGE_UNAVAILABLE",
    [
      "No rotation knowledge for this crop",
      "Règles de rotation non documentées pour cette culture",
      "قواعد الدورة الزراعية لهذا المحصول غير متوفرة",
      "قواعد الدورة ما معروفاش لهاد الزراعة",
    ],
    [
      "The catalog has no rotation rules for this crop (such as return intervals or preferred predecessors), so none could be checked.",
      "Le catalogue n'a pas de règles de rotation pour cette culture (délais de retour, précédents préférés), aucune n'a pu être vérifiée.",
      "لا توجد في دليل المحاصيل قواعد دورة زراعية لهذا المحصول (مثل فترات العودة أو المحاصيل السابقة المفضلة)، لذلك لم يُفحص شيء منها.",
      "الدليل ما فيهش قواعد الدورة الزراعية لهاد الزراعة، بحال المدة قبل ما ترجع لنفس القطعة ولا الزراعات المفضلة قبلها. ما قدرناش نتحققو من هاد الجوانب.",
    ],
  ],
  [
    "RETURN_INTERVAL_UNESTABLISHED",
    [
      "Return interval unknown",
      "Délai de retour inconnu",
      "فترة العودة غير معروفة",
      "مدة الانتظار قبل الرجوع ما معروفةش",
    ],
    [
      "The catalog does not say how long to wait before growing this crop again on the same field.",
      "Le catalogue n'indique pas combien de temps attendre avant de recultiver cette culture sur la même parcelle.",
      "لا يذكر دليل المحاصيل المدة الواجب انتظارها قبل زراعة هذا المحصول مجدداً في الحقل نفسه.",
      "الدليل ما كيقولش شحال خاص يتسنى قبل ما ترجع هاد الزراعة لنفس القطعة.",
    ],
  ],
  [
    "RETURN_INTERVAL_VIOLATION",
    [
      "Returns too soon",
      "Retour trop rapide",
      "عودة مبكرة أكثر من اللازم",
      "الزراعة كترجع بكري بزاف",
    ],
    [
      "This crop would come back on the field sooner than the catalog's recommended waiting time.",
      "Cette culture reviendrait sur la parcelle plus tôt que le délai d'attente recommandé par le catalogue.",
      "سيعود هذا المحصول إلى الحقل قبل مدة الانتظار الموصى بها في دليل المحاصيل.",
      "هاد الزراعة غادي ترجع لنفس القطعة قبل ما تدوز مدة الانتظار اللي كينصح بها الدليل.",
    ],
  ],
  [
    "RETURN_INTERVAL_SATISFIED",
    [
      "Waiting time respected",
      "Délai d'attente respecté",
      "مدة الانتظار مستوفاة",
      "مدة الانتظار محترمة",
    ],
    [
      "This crop would return after at least the catalog's recommended waiting time.",
      "Cette culture reviendrait après au moins le délai d'attente recommandé par le catalogue.",
      "سيعود هذا المحصول بعد مدة الانتظار الموصى بها في دليل المحاصيل على الأقل.",
      "هاد الزراعة غادي ترجع من بعد ما تدوز على الأقل مدة الانتظار اللي كينصح بها الدليل.",
    ],
  ],
  [
    "PREDECESSOR_FAMILY_PROHIBITED",
    [
      "Poor previous crop",
      "Précédent défavorable",
      "محصول سابق غير مناسب",
      "الزراعة اللي قبل ما مناسبةش",
    ],
    [
      "The catalog advises against growing this crop right after a crop of the family that was on the field.",
      "Le catalogue déconseille cette culture juste après une culture de la famille qui était sur la parcelle.",
      "ينصح دليل المحاصيل بعدم زراعة هذا المحصول مباشرة بعد محصول من الفصيلة التي كانت في الحقل.",
      "الدليل ما كينصحش بهاد الزراعة مباشرة من بعد زراعة من نفس الفصيلة اللي كانت فالقطعة.",
    ],
  ],
  [
    "PREDECESSOR_FAMILY_ALLOWED",
    [
      "Acceptable previous crop",
      "Précédent acceptable",
      "محصول سابق مقبول",
      "الزراعة اللي قبل مقبولة",
    ],
    [
      "The crop that was on the field is not one the catalog advises against before this crop.",
      "La culture qui était sur la parcelle n'est pas de celles que le catalogue déconseille avant cette culture.",
      "المحصول الذي كان في الحقل ليس مما ينصح دليل المحاصيل بتجنبه قبل هذا المحصول.",
      "الزراعة اللي كانت فالقطعة ماشي من الزراعات اللي الدليل كينصح بتجنبها قبل هاد الزراعة.",
    ],
  ],
  [
    "PREDECESSOR_PREFERENCE_UNMET",
    [
      "Not the preferred previous crop",
      "Pas le précédent préféré",
      "ليس المحصول السابق المفضل",
      "الزراعة اللي قبل ماشي هي المفضلة",
    ],
    [
      "The catalog prefers a different kind of crop before this one. This is advice only, so the crop stays possible.",
      "Le catalogue préfère un autre type de culture avant celle-ci. Ce n'est qu'un conseil : la culture reste possible.",
      "يفضّل دليل المحاصيل نوعاً آخر من المحاصيل قبل هذا المحصول. هذه توصية فقط، لذلك يبقى المحصول ممكناً.",
      "الدليل كيفضل نوع آخر من الزراعات قبل هادي. هادي غير نصيحة، وهاد الزراعة كتبقى ممكنة.",
    ],
  ],
  [
    "HEALTH_KNOWLEDGE_UNAVAILABLE",
    [
      "No pest and disease knowledge",
      "Pas de connaissances sur les maladies et ravageurs",
      "معلومات الأمراض والآفات غير متوفرة",
      "معلومات الأمراض والآفات ما متوفراش",
    ],
    [
      "The catalog has no pest or disease waiting rules for this crop, so crop-health history could not be checked.",
      "Le catalogue n'a pas de règles d'attente liées aux maladies ou ravageurs pour cette culture : l'historique sanitaire n'a pas pu être vérifié.",
      "لا توجد في دليل المحاصيل قواعد انتظار تخص الآفات أو الأمراض لهذا المحصول، لذلك لم يمكن فحص السجل الصحي.",
      "الدليل ما فيهش قواعد ديال مدة الانتظار بسبب الأمراض ولا الآفات لهاد الزراعة. داكشي علاش ما قدرناش نفحصو السجل الصحي ديال الزراعات.",
    ],
  ],
  [
    "HEALTH_HISTORY_UNKNOWN",
    [
      "Crop-health history not given",
      "Historique sanitaire non fourni",
      "السجل الصحي للمحاصيل غير مقدَّم",
      "سجل الأمراض والآفات ما تعطاش",
    ],
    [
      "Whether pests or diseases affected earlier crops was not given, so health-based waiting rules cannot be checked.",
      "On ne sait pas si des ravageurs ou maladies ont touché les cultures précédentes : les délais d'attente sanitaires ne peuvent pas être vérifiés.",
      "لم يُذكر إن كانت آفات أو أمراض قد أصابت المحاصيل السابقة، لذلك لا يمكن فحص قواعد الانتظار الصحية.",
      "ما قلتيش واش الزراعات اللي فاتو تصابو بمرض ولا آفة. ما نقدرش نتحققو من مدة الانتظار اللي كتطلبها هاد المشاكل.",
    ],
  ],
  [
    "HEALTH_HISTORY_UNLINKED",
    [
      "Problem not linked to a crop",
      "Problème non rattaché à une culture",
      "المشكلة غير مرتبطة بمحصول",
      "المشكل ما مربوطش بزراعة",
    ],
    [
      "A reported pest or disease is not tied to a dated crop in your history, so the waiting time cannot be counted.",
      "Un ravageur ou une maladie signalé n'est pas rattaché à une culture datée de votre historique : le délai d'attente ne peut pas être compté.",
      "آفة أو مرض مُبلَّغ عنه غير مرتبط بمحصول مؤرَّخ في سجلك، لذلك لا يمكن احتساب مدة الانتظار.",
      "شي مرض ولا آفة بلغتي عليها ما مربوطةش بزراعة عندها تاريخ فالسجل. ما نقدرش نحسبو مدة الانتظار.",
    ],
  ],
  [
    "HEALTH_OBSERVATION_UNSUPPORTED",
    [
      "Problem not covered by the rules",
      "Problème non couvert par les règles",
      "المشكلة غير مشمولة بالقواعد",
      "القواعد ما كتغطيش هاد المشكل",
    ],
    [
      "The pest or disease you reported is not one this crop's catalog rules are written for.",
      "Le ravageur ou la maladie signalé n'est pas de ceux pour lesquels les règles du catalogue de cette culture sont écrites.",
      "الآفة أو المرض الذي أبلغتَ عنه ليس مما كُتبت له قواعد هذا المحصول في دليل المحاصيل.",
      "المرض ولا الآفة اللي بلغتي عليها ما داخلاش فالمشاكل اللي كتعالجها قواعد هاد الزراعة فالدليل.",
    ],
  ],
  [
    "HEALTH_OBSERVATION_UNVERIFIED",
    [
      "Problem not confirmed",
      "Problème non confirmé",
      "المشكلة غير مؤكدة",
      "المشكل ما تأكدش",
    ],
    [
      "A pest or disease report has not been confirmed (for example by a specialist or a test), so it is treated with caution rather than as fact.",
      "Un signalement de ravageur ou de maladie n'a pas été confirmé (par exemple par un spécialiste ou un test) : il est traité avec prudence et non comme un fait.",
      "لم يُؤكَّد بلاغ عن آفة أو مرض (مثلاً من مختص أو بفحص)، لذلك يُعامل بحذر لا كحقيقة.",
      "البلاغ على شي مرض ولا آفة ما تأكدش، مثلا عند مختص ولا بتحليل. كنحتاطو فاستعمال هاد المعلومة وما كنعتابروهاش حقيقة مؤكدة.",
    ],
  ],
  [
    "HEALTH_REPORT_UNCONFIRMED",
    [
      "Report not confirmed",
      "Signalement non confirmé",
      "البلاغ غير مؤكد",
      "البلاغ ما تأكدش",
    ],
    [
      "The problem you reported is only your observation. Rotavise cannot treat it as a confirmed diagnosis.",
      "Le problème signalé n'est que votre observation : Rotavise ne peut pas le traiter comme un diagnostic confirmé.",
      "المشكلة التي أبلغتَ عنها ملاحظتك فقط، ولا تستطيع روتافيس اعتبارها تشخيصاً مؤكداً.",
      "المشكل اللي بلغتي عليه هو غير ملاحظة ديالك. روتافيس ما يقدرش يعتابرو تشخيص مؤكد.",
    ],
  ],
  [
    "HEALTH_ISSUE_NOT_IN_CATALOG",
    [
      "Problem not in the catalog",
      "Problème absent du catalogue",
      "المشكلة غير موجودة في دليل المحاصيل",
      "المشكل ما كاينش فالدليل",
    ],
    [
      "The pest or disease you named is not in the catalog, so no waiting rule can be applied for it.",
      "Le ravageur ou la maladie indiqué n'est pas dans le catalogue : aucune règle d'attente ne peut lui être appliquée.",
      "الآفة أو المرض الذي ذكرتَه غير موجود في دليل المحاصيل، فلا يمكن تطبيق قاعدة انتظار له.",
      "المرض ولا الآفة اللي سميتي ما كايناش فالدليل. ما يمكنش نطبقو عليها قاعدة ديال مدة الانتظار.",
    ],
  ],
  [
    "HEALTH_BREAK_VIOLATION",
    [
      "Pest or disease break too short",
      "Délai après maladie ou ravageur trop court",
      "فترة الانتظار بعد المرض أو الآفة قصيرة",
      "مدة الانتظار من بعد المرض ولا الآفة قصيرة",
    ],
    [
      "This crop would be grown again before the catalog's recommended break after the pest or disease problem.",
      "Cette culture reviendrait avant la fin du délai recommandé par le catalogue après le problème de maladie ou de ravageur.",
      "سيُزرع هذا المحصول مجدداً قبل انقضاء فترة الانتظار التي يوصي بها دليل المحاصيل بعد الإصابة بالمرض أو الآفة.",
      "هاد الزراعة غادي ترجع قبل ما تسالي مدة الانتظار اللي كينصح بها الدليل من بعد المرض ولا الآفة.",
    ],
  ],
  [
    "HEALTH_BREAK_SATISFIED",
    [
      "Pest or disease break respected",
      "Délai après maladie ou ravageur respecté",
      "فترة الانتظار بعد المرض أو الآفة مستوفاة",
      "مدة الانتظار من بعد المرض ولا الآفة محترمة",
    ],
    [
      "The catalog's recommended break after the pest or disease problem would be respected.",
      "Le délai recommandé par le catalogue après le problème de maladie ou de ravageur serait respecté.",
      "ستُستوفى فترة الانتظار التي يوصي بها دليل المحاصيل بعد الإصابة بالمرض أو الآفة.",
      "مدة الانتظار اللي كينصح بها الدليل من بعد المرض ولا الآفة غادي تكون محترمة.",
    ],
  ],
  [
    "WATER_UNKNOWN",
    [
      "Water supply not given",
      "Alimentation en eau non précisée",
      "مصدر المياه غير محدد",
      "مصدر الما ما تعطاش",
    ],
    [
      "How the field gets water (rain or irrigation) was not given, so water-related checks could not be made.",
      "On ne sait pas comment la parcelle reçoit l'eau (pluie ou irrigation) : les contrôles liés à l'eau n'ont pas pu être faits.",
      "لم يُذكر كيف يحصل الحقل على الماء (مطر أو سقي)، لذلك لم تُجرَ الفحوص المتعلقة بالماء.",
      "ما قلتيش واش القطعة كتاخد الما من الشتا ولا من السقي. داكشي علاش ما قدرناش نديرو الفحوص ديال الما.",
    ],
  ],
  [
    "WATER_REPORTED_NOT_QUANTIFIED",
    [
      "Water reported but not measured",
      "Eau déclarée mais non quantifiée",
      "الماء مذكور لكن غير مُقدَّر كمّياً",
      "الما مذكور ولكن بلا كميات",
    ],
    [
      "You described the water supply, but without amounts, so it cannot be compared with a crop's needs.",
      "Vous avez décrit l'alimentation en eau mais sans quantités : elle ne peut pas être comparée aux besoins d'une culture.",
      "وصفتَ كيفية تزويد الحقل بالماء، لكن دون تحديد الكميات، لذلك لا يمكن مقارنتها باحتياجات المحصول.",
      "وصفتي كيفاش القطعة كتاخد الما، ولكن ما عطيتيش الكميات. ما نقدرش نقارنوها مع احتياجات الزراعة.",
    ],
  ],
  [
    "IRRIGATION_ADEQUACY_UNKNOWN",
    [
      "Irrigation sufficiency unknown",
      "On ne sait pas si l'irrigation suffit",
      "كفاية السقي غير معروفة",
      "ما معروفش واش السقي كافي",
    ],
    [
      "It is not known whether your irrigation can cover the crop's water needs, so no water-stress judgement is made for irrigated fields.",
      "On ne sait pas si votre irrigation couvre les besoins en eau de la culture : le stress hydrique n'est donc pas évalué pour les parcelles irriguées.",
      "لا يُعرف إن كان السقي لديك يغطي احتياجات المحصول من الماء، لذلك لا يُقيَّم الإجهاد المائي للحقول المسقية.",
      "ما معروفش واش السقي ديالك كيغطي احتياجات الزراعة من الما. داكشي علاش ما كنحكموش على الإجهاد المائي فالقطع المسقية.",
    ],
  ],
  [
    "RAINFED_ARID_RISK",
    [
      "Dry-climate risk without irrigation",
      "Risque de climat sec sans irrigation",
      "مخاطر المناخ الجاف دون سقي",
      "خطر فالبور مع هاد المناخ الجاف",
    ],
    [
      "Average yearly rain at your location is at or below the level where a source warns that this rainfed crop is very uncertain.",
      "La pluie annuelle moyenne à votre emplacement est égale ou inférieure au niveau à partir duquel une source avertit que cette culture pluviale est très incertaine.",
      "متوسط الأمطار السنوي في موقعك يساوي أو يقل عن المستوى الذي يحذّر عنده مصدر من أن نجاح هذا المحصول البوري غير مضمون بدرجة كبيرة.",
      "متوسط الشتا فالعام فالبلاصة ديالك كيساوي ولا أقل من المستوى اللي كيحذر فيه مصدر بلي نجاح هاد الزراعة فالبور ما مضمونش بدرجة كبيرة.",
    ],
  ],
  [
    "WATER_CLASS_UNAVAILABLE",
    [
      "Water need class missing",
      "Classe de besoin en eau manquante",
      "فئة احتياج الماء غير متوفرة",
      "فئة احتياجات الما ما معروفةش",
    ],
    [
      "The catalog has no water-need class for this crop, so it cannot be compared with other crops on water.",
      "Le catalogue n'a pas de classe de besoin en eau pour cette culture : elle ne peut pas être comparée aux autres sur ce critère.",
      "لا توجد في دليل المحاصيل فئة احتياجات مائية لهذا المحصول، لذلك لا يمكن مقارنته بغيره من حيث احتياجات الماء.",
      "الدليل ما فيهش فئة احتياجات الما لهاد الزراعة. ما نقدرش نقارنوها مع الزراعات لخرين من ناحية الما.",
    ],
  ],
  [
    "WATER_METHOD_INCOMPATIBLE",
    [
      "Water measures cannot be compared",
      "Mesures d'eau non comparables",
      "مقاييس الماء غير قابلة للمقارنة",
      "قياسات الما ما كيتقارنوش",
    ],
    [
      "The crops' water needs are described in different ways that cannot be put on the same scale.",
      "Les besoins en eau des cultures sont décrits de manières différentes qui ne peuvent pas être mises sur la même échelle.",
      "احتياجات الماء للمحاصيل موصوفة بطرق مختلفة لا يمكن وضعها على مقياس واحد.",
      "احتياجات الزراعات من الما موصوفة بطرق مختلفة، وما يمكنش نجمعوها فنفس المقياس للمقارنة.",
    ],
  ],
  [
    "WATER_CLASS_COMPARISON",
    [
      "Compared by water-need class",
      "Comparaison par classe de besoin en eau",
      "قورنت بحسب فئة احتياج الماء",
      "المقارنة بفئة احتياجات الما",
    ],
    [
      "Crops are compared by a coarse water-need class from the catalog. It is a rough guide, not a computed water balance.",
      "Les cultures sont comparées selon une classe grossière de besoin en eau du catalogue. C'est un repère approximatif, pas un bilan hydrique calculé.",
      "تُقارن المحاصيل بحسب فئات تقريبية لاحتياجاتها من الماء في دليل المحاصيل. هذا مؤشر تقريبي وليس حصيلة مائية محسوبة.",
      "كنقارنو الزراعات بفئات تقريبية لاحتياجات الما من الدليل. هادا غير مؤشر تقريبي وماشي حصيلة مائية محسوبة.",
    ],
  ],
  [
    "WEATHER_NOT_EVALUATED",
    [
      "Weather not yet evaluated",
      "Météo pas encore évaluée",
      "الطقس لم يُقيَّم بعد",
      "الطقس ما تقيّمش باقي",
    ],
    [
      "This calendar-only result does not use weather data yet; the weather-based comparison comes in a later stage.",
      "Ce résultat de calendrier seul n'utilise pas encore de données météo ; la comparaison fondée sur la météo vient à une étape ultérieure.",
      "هذه النتيجة المبنية على التقويم فقط لا تستخدم بيانات الطقس بعد؛ وتأتي المقارنة المبنية على الطقس في مرحلة لاحقة.",
      "هاد النتيجة مبنية غير على التواريخ وما كتستعملش بيانات الطقس باقي. المقارنة بالطقس كتجي فمرحلة من بعد.",
    ],
  ],
  [
    "WEATHER_COVERAGE_INCOMPLETE",
    [
      "Weather record has gaps",
      "Relevé météo incomplet",
      "سجل الطقس ناقص",
      "سجل الطقس فيه نقص",
    ],
    [
      "Some days of weather data needed for a past season are missing, so that season was not used as a comparison.",
      "Des jours de données météo nécessaires pour une campagne passée manquent : cette campagne n'a pas été utilisée pour la comparaison.",
      "تنقص أيام من بيانات الطقس اللازمة لموسم سابق، لذلك لم يُستخدم ذلك الموسم في المقارنة.",
      "شي أيام من بيانات الطقس اللي خاصين لموسم فات ناقصين. داكشي علاش هاد الموسم ما دخلش فالمقارنة.",
    ],
  ],
  [
    "LEAP_BOUNDARY_UNAVAILABLE",
    [
      "Leap-day boundary unavailable",
      "Dates autour du 29 février non comparables",
      "تعذّرت مطابقة التواريخ حول 29 فبراير",
      "تواريخ 29 فبراير ما تطابقوش",
    ],
    [
      "A past season's dates run across 29 February in a way the comparison cannot align, so that season was left out.",
      "Les dates d'une campagne passée traversent le 29 février d'une manière que la comparaison ne peut pas aligner : cette campagne a été écartée.",
      "تمتد تواريخ موسم سابق عبر 29 فبراير بطريقة لا تستطيع المقارنة مواءمتها، لذلك استُبعد ذلك الموسم.",
      "تواريخ شي موسم فات كيدخل فيها 29 فبراير بطريقة ما قدرناش نطابقوها فالمقارنة. داكشي علاش حيدنا هاد الموسم.",
    ],
  ],
  [
    "TEMPERATURE_EVIDENCE_UNAVAILABLE",
    [
      "No temperature limits for this crop",
      "Pas de limites de température pour cette culture",
      "لا توجد حدود حرارة لهذا المحصول",
      "حدود الحرارة لهاد الزراعة ما كايناش",
    ],
    [
      "The catalog has no temperature rule for this crop that could be applied, so heat and cold damage was not assessed for it.",
      "Le catalogue n'a pas de règle de température applicable pour cette culture : les dégâts de chaleur et de froid n'ont pas été évalués.",
      "لا توجد في دليل المحاصيل قاعدة حرارة قابلة للتطبيق لهذا المحصول، لذلك لم يُقيَّم ضرر الحر والبرد له.",
      "الدليل ما فيهش قاعدة ديال الحرارة نقدروا نطبقوها لهاد الزراعة. داكشي علاش ضرر السخونية والبرد ما تقيّمش ليها.",
    ],
  ],
  [
    "TEMPERATURE_RULE_UNAVAILABLE",
    [
      "Temperature rule missing",
      "Règle de température manquante",
      "قاعدة الحرارة غير متوفرة",
      "قاعدة الحرارة ناقصة",
    ],
    [
      "No temperature rule is available for this crop and period.",
      "Aucune règle de température n'est disponible pour cette culture et cette période.",
      "لا توجد قاعدة حرارة لهذا المحصول وهذه الفترة.",
      "ما كايناش قاعدة ديال الحرارة لهاد الزراعة وهاد الفترة باش نقدروا نستعملوها فالتقييم.",
    ],
  ],
  [
    "TEMPERATURE_RULE_UNSUPPORTED",
    [
      "Temperature rule not supported",
      "Règle de température non prise en charge",
      "قاعدة الحرارة غير مدعومة",
      "قاعدة الحرارة ما يمكنش نستعملوها دابا",
    ],
    [
      "A temperature rule exists but is written in a way Rotavise cannot compare with the weather data it has.",
      "Une règle de température existe mais elle est écrite d'une manière que Rotavise ne peut pas comparer aux données météo dont elle dispose.",
      "توجد قاعدة حرارة لكنها مكتوبة بطريقة لا تستطيع روتافيس مقارنتها ببيانات الطقس المتوفرة.",
      "كاينة قاعدة ديال الحرارة ولكن مكتوبة بطريقة ما يقدرش روتافيس يقارنها ببيانات الطقس اللي عندو.",
    ],
  ],
  [
    "TEMPERATURE_RULE_UNREVIEWED",
    [
      "Temperature rule not reviewed",
      "Règle de température non relue",
      "قاعدة الحرارة غير مراجَعة",
      "قاعدة الحرارة ما تراجعاتش كفاية",
    ],
    [
      "The temperature rule has not been checked or reviewed enough to be used to rank crops.",
      "La règle de température n'a pas été assez vérifiée ou relue pour servir à classer les cultures.",
      "لم يُتحقَّق من قاعدة الحرارة أو تُراجع بالقدر الكافي لاستخدامها في ترتيب المحاصيل.",
      "قاعدة الحرارة ما تأكداتش ولا تراجعاتش بالقدر الكافي باش نستعملوها فترتيب الزراعات.",
    ],
  ],
  [
    "TEMPERATURE_RULE_AMBIGUOUS",
    [
      "Temperature rules conflict",
      "Plusieurs règles de température possibles",
      "قواعد الحرارة متعارضة",
      "كاينين قواعد حرارة وما واضحاش شكون نستعملو",
    ],
    [
      "More than one temperature rule applies to the same stage and basis, so it is unclear which to use.",
      "Plusieurs règles de température s'appliquent au même stade et à la même base : on ne sait pas laquelle utiliser.",
      "تنطبق أكثر من قاعدة حرارة على المرحلة والأساس نفسهما، فلا يتضح أيّها يُستخدم.",
      "كاينة كثر من قاعدة ديال الحرارة كتنطبق على نفس مرحلة النمو ونفس أساس القياس. ما واضحاش شكون خاص نستعملو.",
    ],
  ],
  [
    "TEMPERATURE_EXPOSURE",
    [
      "Temperature exposure",
      "Exposition aux températures",
      "التعرض لدرجات الحرارة",
      "التعرض لدرجات الحرارة",
    ],
    [
      "In past seasons the temperature went beyond a sourced limit for this crop on some days. The count is shown with the result.",
      "Lors de campagnes passées, la température a dépassé une limite sourcée pour cette culture certains jours. Le nombre de jours est indiqué avec le résultat.",
      "في مواسم سابقة تجاوزت الحرارة حداً موثقاً لهذا المحصول في بعض الأيام. ويُعرض العدد مع النتيجة.",
      "فمواسم اللي فاتو، الحرارة دازت شي حد موثق لهاد الزراعة فشي أيام. عدد هاد الأيام كيبان مع النتيجة.",
    ],
  ],
  [
    "CLIMATE_ANALOGS_INSUFFICIENT",
    [
      "Not enough past seasons",
      "Pas assez de campagnes passées",
      "مواسم سابقة غير كافية",
      "المواسم اللي فاتو ما كافيينش",
    ],
    [
      "There were not enough complete past seasons of weather to judge the climate fit of the rotations.",
      "Il n'y avait pas assez de campagnes passées complètes de météo pour juger l'adaptation climatique des rotations.",
      "لا تتوفر بيانات طقس كاملة لعدد كافٍ من المواسم السابقة لتقييم ملاءمة الدورات الزراعية للمناخ.",
      "ما كايناش بيانات طقس كاملة ديال عدد كافي من المواسم اللي فاتو باش نحكمو واش الدورات مناسبة للمناخ.",
    ],
  ],
  [
    "INSUFFICIENT_COMPLETE_ANALOGS",
    [
      "Too few complete past seasons",
      "Trop peu de campagnes complètes",
      "مواسم كاملة قليلة جداً",
      "المواسم الكاملة أقل من المطلوب",
    ],
    [
      "Fewer complete past seasons than the minimum could be built from the weather record, so no climate comparison is made.",
      "Moins de campagnes passées complètes que le minimum requis ont pu être construites à partir du relevé météo : aucune comparaison climatique n'est faite.",
      "أمكن بناء عدد من المواسم السابقة الكاملة أقل من الحد الأدنى من سجل الطقس، لذلك لا تُجرى مقارنة مناخية.",
      "من سجل الطقس قدرنا نوجدو مواسم سابقة كاملة أقل من الحد الأدنى المطلوب. داكشي علاش ما كايناش مقارنة مناخية.",
    ],
  ],
  [
    "INSUFFICIENT_PERIOD_ANALOGS",
    [
      "Too few past seasons for the period",
      "Trop peu de campagnes pour la période",
      "مواسم قليلة للفترة",
      "مواسم قليلة كتغطي هاد الفترة",
    ],
    [
      "There are too few past seasons covering the exact period of the plan to compare how that period usually goes.",
      "Trop peu de campagnes passées couvrent exactement la période du plan pour comparer son déroulement habituel.",
      "عدد المواسم السابقة التي تغطي فترة الخطة بدقة قليل جداً لمقارنة ما يحدث فيها عادةً.",
      "المواسم اللي فاتو وكيغطيو بالضبط فترة الخطة قليلين بزاف باش نقارنو شنو كيوقع فيها عادة.",
    ],
  ],
  [
    "INSUFFICIENT_SHARED_ANALOGS",
    [
      "Too few shared past seasons",
      "Trop peu de campagnes communes",
      "مواسم مشتركة قليلة",
      "المواسم المشتركة ما كافيينش",
    ],
    [
      "The crops being compared do not share enough past seasons with usable weather, so they cannot be ranked fairly against each other.",
      "Les cultures comparées n'ont pas assez de campagnes passées communes avec une météo exploitable : elles ne peuvent pas être classées équitablement.",
      "لا تتشارك المحاصيل المقارَنة مواسم سابقة كافية ببيانات طقس صالحة، لذلك لا يمكن ترتيبها بعدالة.",
      "الزراعات اللي كنقارنو ما عندهمش عدد كافي من نفس المواسم ببيانات طقس صالحة. ما نقدرش نرتبوهم بإنصاف.",
    ],
  ],
  [
    "CLIMATE_CHECKS_DIFFER",
    [
      "Different climate checks per crop",
      "Contrôles climatiques différents selon les cultures",
      "فحوص المناخ تختلف بين المحاصيل",
      "فحوص المناخ مختلفة بين الزراعات",
    ],
    [
      "Not every crop has the same kinds of temperature checks, so only the checks every crop has were compared, to keep the ranking fair.",
      "Toutes les cultures n'ont pas les mêmes types de contrôles de température : seuls les contrôles communs ont été comparés pour garder un classement équitable.",
      "لا تملك كل المحاصيل أنواع فحوص الحرارة نفسها، لذلك قورنت الفحوص المشتركة فقط للحفاظ على عدالة الترتيب.",
      "ماشي كل زراعة عندها نفس أنواع فحوص الحرارة. باش يبقى الترتيب منصف، قارنا غير الفحوص اللي مشتركة بين جميع الزراعات.",
    ],
  ],
  [
    "FUTURE_CLIMATE_UNAVAILABLE",
    [
      "Future climate not available",
      "Climat futur indisponible",
      "المناخ المستقبلي غير متاح",
      "بيانات المناخ الجاي ما متوفراش",
    ],
    [
      "Future climate projections were not available for your location, so the result uses past weather only.",
      "Les projections climatiques futures n'étaient pas disponibles pour votre emplacement : le résultat n'utilise que la météo passée.",
      "لم تتوفر إسقاطات مناخية مستقبلية لموقعك، لذلك تعتمد النتيجة على الطقس السابق فقط.",
      "معطيات سيناريوهات المناخ الجاي ما متوفراش للبلاصة ديالك. النتيجة مبنية غير على الطقس اللي فات.",
    ],
  ],
  [
    "ROTATION_PROXY_UNAVAILABLE",
    [
      "No rotation indicator",
      "Pas d'indicateur de rotation",
      "لا يوجد مؤشر للدورة الزراعية",
      "مؤشر الدورة ما متوفرش",
    ],
    [
      "The rotation rules needed for a soil-health indicator are missing for these crops.",
      "Les règles de rotation nécessaires à un indicateur de santé du sol manquent pour ces cultures.",
      "قواعد الدورة الزراعية اللازمة لمؤشر صحة التربة غير متوفرة لهذه المحاصيل.",
      "قواعد الدورة الزراعية اللي خاصين باش نخرجو مؤشر لصحة التربة ما متوفرينش لهاد الزراعات.",
    ],
  ],
  [
    "ROTATION_PROXY_COMPARISON",
    [
      "Compared by rotation rules",
      "Comparaison par règles de rotation",
      "قورنت بحسب قواعد الدورة الزراعية",
      "المقارنة بقواعد الدورة الزراعية",
    ],
    [
      "Soil health is judged only through the catalog's rotation rules (such as preferred previous crops). It is a rough indicator, not a soil measurement.",
      "La santé du sol n'est jugée qu'à travers les règles de rotation du catalogue (comme les précédents préférés). C'est un indicateur approximatif, pas une mesure du sol.",
      "تُقدَّر صحة التربة عبر قواعد الدورة الزراعية في دليل المحاصيل فقط (مثل المحاصيل السابقة المفضلة). وهو مؤشر تقريبي لا قياس للتربة.",
      "صحة التربة كتتقيّم غير بقواعد الدورة الزراعية فالدليل، بحال الزراعة المفضلة قبل كل زراعة. هادا مؤشر تقريبي، ماشي قياس للتربة.",
    ],
  ],
  [
    "CONSTRAINTS_PREVENT_RANKING",
    [
      "Constraints block the ranking",
      "Des contraintes bloquent le classement",
      "القيود تمنع الترتيب",
      "كاينين قيود كيمنعو الترتيب",
    ],
    [
      "A crop was refused or lacks evidence, so no climate ranking is given for this option.",
      "Une culture a été refusée ou manque de données : aucun classement climatique n'est donné pour cette option.",
      "رُفض محصول أو تنقصه الأدلة، لذلك لا يُعطى ترتيب مناخي لهذا الخيار.",
      "شي زراعة ترفضات ولا ناقصاها معلومات موثقة. داكشي علاش هاد الاختيار ما عندوش ترتيب على أساس المناخ.",
    ],
  ],
  [
    "RANKING_NOT_IMPLEMENTED",
    [
      "Ranking not available yet",
      "Classement pas encore disponible",
      "الترتيب غير متاح بعد",
      "الترتيب ما متوفرش باقي",
    ],
    [
      "This early, calendar-only result lists options without ranking them.",
      "Ce résultat préliminaire, fondé sur le calendrier seul, liste les options sans les classer.",
      "تعرض هذه النتيجة الأولية المبنية على التقويم فقط الخيارات دون ترتيبها.",
      "هاد النتيجة الأولية مبنية غير على التواريخ. كتبين الاختيارات بلا ما ترتبها.",
    ],
  ],
  [
    "RANKED_WITH_HEURISTIC_WEIGHTS",
    [
      "Ranked with product weights",
      "Classement selon des pondérations choisies par Rotavise",
      "ترتيب بأوزان اختارتها روتافيس",
      "ترتيب بأوزان اختارها روتافيس",
    ],
    [
      "The ranking combines several criteria using weights chosen by Rotavise and your priorities, not weights proven by research.",
      "Le classement combine plusieurs critères avec des pondérations choisies par Rotavise et vos priorités, pas des pondérations prouvées par la recherche.",
      "يجمع الترتيب عدة معايير بأوزان اختارتها روتافيس مع أولوياتك، لا بأوزان أثبتها البحث.",
      "الترتيب كيجمع عدة معايير بالأوزان اللي اختارها روتافيس ومع الأولويات ديالك. هاد الأوزان ما مثبتاش بالبحث العلمي.",
    ],
  ],
  [
    "RANKING_SENSITIVE",
    [
      "Ranking is sensitive to weights",
      "Classement sensible aux pondérations",
      "الترتيب حساس للأوزان",
      "الترتيب كيتبدل بتغيير الأوزان",
    ],
    [
      "Shifting a small share of weight between criteria changes the order, so the top options are close and should not be over-trusted.",
      "Déplacer une petite part de pondération entre critères change l'ordre : les meilleures options sont proches et ne doivent pas être surinterprétées.",
      "نقل جزء صغير من الوزن بين المعايير يغيّر الترتيب، فالخيارات الأولى متقاربة ولا ينبغي الإفراط في الثقة بها.",
      "إلا بدلنا غير شوية من الوزن بين المعايير، كيتبدل الترتيب. الاختيارات اللولة متقاربة، وما خاصش نعطيو ثقة كبيرة لترتيبها.",
    ],
  ],
  [
    "SINGLE_COMPARABLE_OPTION",
    [
      "Only one option to compare",
      "Une seule option comparable",
      "خيار واحد فقط للمقارنة",
      "غير اختيار واحد قابل للمقارنة",
    ],
    [
      "Only one option could be compared fairly, so there is no ranking between options.",
      "Une seule option pouvait être comparée équitablement : il n'y a donc pas de classement entre options.",
      "أمكن مقارنة خيار واحد فقط بعدالة، لذلك لا يوجد ترتيب بين الخيارات.",
      "غير اختيار واحد قدرنا نقارنوه بإنصاف. داكشي علاش ما كاينش ترتيب بين الاختيارات.",
    ],
  ],
  [
    "HISTORICAL_COMPARISON_ONLY",
    [
      "Past seasons only",
      "Campagnes passées seulement",
      "المواسم السابقة فقط",
      "المقارنة غير بالمواسم اللي فاتو",
    ],
    [
      "The comparison describes how options would have fared in past seasons; it is not a forecast of the coming season.",
      "La comparaison décrit comment les options se seraient comportées lors de campagnes passées ; ce n'est pas une prévision de la prochaine campagne.",
      "تصف المقارنة كيف كانت ستؤدي الخيارات في مواسم سابقة؛ وليست توقعاً للموسم القادم.",
      "المقارنة كتبين كيفاش كانت غادي تدوز هاد الاختيارات فالمواسم اللي فاتو. ماشي توقع للموسم الجاي.",
    ],
  ],
]);
