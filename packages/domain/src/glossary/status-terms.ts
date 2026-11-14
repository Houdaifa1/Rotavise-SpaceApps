import { rows } from "./types.js";

// Effects of a reason on a result.
export const effectTerms = rows("effect", [
  [
    "pass",
    ["Passed", "Contrôle satisfait", "مستوفى", "الفحص داز"],
    [
      "A check was made and the crop or rotation met it.",
      "Un contrôle a été fait et la culture ou la rotation l'a satisfait.",
      "أُجري فحص واستوفاه المحصول أو الدورة الزراعية.",
      "دار الفحص ولقينا بلي الزراعة ولا الدورة كتحترم الشرط اللي تفحص.",
    ],
  ],
  [
    "condition",
    [
      "Condition to check",
      "Condition à vérifier",
      "شرط يجب التحقق منه",
      "شرط خاص يتأكد",
    ],
    [
      "Possible, but something must be confirmed or watched, for example locally on your field.",
      "Possible, mais quelque chose doit être confirmé ou surveillé, par exemple localement sur votre parcelle.",
      "ممكن، لكن يجب تأكيد شيء أو مراقبته، مثلاً محلياً في حقلك.",
      "هاد الاختيار ممكن، ولكن كاين شي حاجة خاصها تأكيد ولا تتبع، مثلا فالقطعة ديالك.",
    ],
  ],
  [
    "failure",
    ["Not met", "Condition non satisfaite", "غير مستوفى", "الشرط ما تحترمش"],
    [
      "A check was made and the crop or rotation did not meet it, so it is set aside.",
      "Un contrôle a été fait et la culture ou la rotation ne l'a pas satisfait : elle est écartée.",
      "أُجري فحص ولم يستوفه المحصول أو الدورة الزراعية، فيُستبعد.",
      "دار الفحص ولقينا بلي الزراعة ولا الدورة ما كتحترمش الشرط، وداكشي علاش كنحيدوها من الاختيارات.",
    ],
  ],
  [
    "gap",
    [
      "Missing evidence",
      "Données manquantes",
      "أدلة ناقصة",
      "معلومات موثقة ناقصة",
    ],
    [
      "Rotavise lacks the evidence to check this. It does not mean the crop is bad; it means this point could not be judged.",
      "Rotavise n'a pas les données pour vérifier ce point. Cela ne veut pas dire que la culture est mauvaise, seulement que ce point n'a pas pu être jugé.",
      "تنقص روتافيس الأدلة لفحص هذه النقطة. لا يعني ذلك أن المحصول سيئ، بل أنه تعذّر الحكم على هذه النقطة.",
      "روتافيس ما عندوش المعلومات الموثقة باش يتحقق من هاد النقطة. هادا ما كيعنيش بلي الزراعة خايبة، غير ما قدرناش نحكمو فهاد الجانب.",
    ],
  ],
  [
    "deferred",
    ["Left for later", "Reporté", "مؤجَّل", "متأجل لمرحلة من بعد"],
    [
      "This check is not done at this stage of the calculation.",
      "Ce contrôle n'est pas réalisé à ce stade du calcul.",
      "لا يُجرى هذا الفحص في هذه المرحلة من الحساب.",
      "هاد الفحص ما كيتدارش فهاد المرحلة ديال الحساب، وكيبقى لمرحلة من بعد.",
    ],
  ],
  [
    "info",
    ["For your information", "À titre d'information", "للعلم", "غير للمعلومة"],
    [
      "A fact about how the result was produced, with no effect on whether a crop is accepted.",
      "Un fait sur la façon dont le résultat a été produit, sans effet sur l'acceptation d'une culture.",
      "معلومة عن كيفية إنتاج النتيجة، دون أثر على قبول المحصول.",
      "هاد المعلومة كتشرح كيفاش تخرجات النتيجة، وما عندها حتى تأثير على قبول الزراعة.",
    ],
  ],
]);

// Statuses of candidates, crops, outcomes, plans and requests.
export const statusTerms = rows("status", [
  [
    "eligible",
    ["Eligible", "Éligible", "مؤهَّل", "كتحترم الفحوص اللي تدارو"],
    [
      "Every check that could be made was met.",
      "Tous les contrôles réalisables ont été satisfaits.",
      "استُوفيت كل الفحوص التي أمكن إجراؤها.",
      "جميع الفحوص اللي قدرنا نديروها دازو، والزراعة ولا الدورة احترمات الشروط ديالهم.",
    ],
  ],
  [
    "conditional",
    [
      "Possible with conditions",
      "Possible sous conditions",
      "ممكن بشروط",
      "ممكنة بشروط",
    ],
    [
      "Possible, but at least one condition must be checked on your field.",
      "Possible, mais au moins une condition doit être vérifiée sur votre parcelle.",
      "ممكن، لكن يجب فحص شرط واحد على الأقل في حقلك.",
      "هاد الاختيار ممكن، ولكن كاين على الأقل شرط واحد خاصك تتأكد منو فالقطعة ديالك.",
    ],
  ],
  [
    "excluded",
    ["Excluded", "Exclu", "مستبعَد", "محيدة من الاختيارات"],
    [
      "Set aside because it failed a binding check or you excluded it.",
      "Écarté car il a échoué à un contrôle contraignant ou parce que vous l'avez exclu.",
      "استُبعد لأنه أخفق في فحص ملزم أو لأنك استبعدته.",
      "هاد الاختيار تحيد حيث ما احترمش شي شرط ضروري فالفحص، ولا حيث نتا اللي حيدتيه.",
    ],
  ],
  [
    "insufficient_evidence",
    [
      "Not enough evidence",
      "Données insuffisantes",
      "أدلة غير كافية",
      "المعلومات الموثقة ما كافياش",
    ],
    [
      "There is not enough sourced evidence to judge it, so no verdict is given. This is not a refusal.",
      "Il n'y a pas assez de données sourcées pour en juger : aucun verdict n'est donné. Ce n'est pas un refus.",
      "لا توجد أدلة موثقة كافية للحكم عليه، لذلك لا يُعطى حكم. وليس هذا رفضاً.",
      "ما كايناش معلومات بمصادر كافية باش نحكمو على هاد الاختيار. داكشي علاش ما كنعطيوش حكم، وهادا ماشي رفض.",
    ],
  ],
  [
    "comparisons_available",
    [
      "Comparisons available",
      "Comparaisons disponibles",
      "المقارنات متاحة",
      "المقارنات واجدين",
    ],
    [
      "At least one rotation could be compared, so ranked options are given.",
      "Au moins une rotation a pu être comparée : des options classées sont fournies.",
      "أمكن مقارنة دورة زراعية واحدة على الأقل، لذلك تُعطى خيارات مرتبة.",
      "قدرنا نقارنو على الأقل دورة زراعية وحدة، وداكشي علاش كنعطيو اختيارات مرتبة.",
    ],
  ],
  [
    "no_feasible_rotation",
    [
      "No feasible rotation",
      "Aucune rotation réalisable",
      "لا توجد دورة زراعية ممكنة",
      "ما لقيناش دورة ممكنة",
    ],
    [
      "Within the dates and rules given, no rotation could be built.",
      "Avec les dates et règles indiquées, aucune rotation n'a pu être construite.",
      "ضمن التواريخ والقواعد المعطاة تعذّر بناء أي دورة زراعية.",
      "بالتواريخ والقواعد اللي عندنا، ما قدرناش نوجدو حتى دورة زراعية ممكنة.",
    ],
  ],
  [
    "schedulable",
    ["Can be planned", "Planifiable", "قابل للتخطيط", "يمكن نخططو ليها"],
    [
      "The crop has enough evidence (calendar and cycle length) to be placed in a rotation.",
      "La culture dispose de suffisamment de données (calendrier et durée de cycle) pour entrer dans une rotation.",
      "للمحصول أدلة كافية (التقويم ومدة الدورة) ليدخل في دورة زراعية.",
      "هاد الزراعة عندها معلومات موثقة كافية على التواريخ ومدة النمو باش تدخل فدورة زراعية.",
    ],
  ],
  [
    "not_in_catalog",
    [
      "Not in the catalog",
      "Absent du catalogue",
      "غير موجود في دليل المحاصيل",
      "ما كايناش فالدليل",
    ],
    [
      "The catalog has no record for the crop.",
      "Le catalogue n'a pas de fiche pour cette culture.",
      "لا توجد في دليل المحاصيل بطاقة لهذا المحصول.",
      "دليل الزراعات ما فيه حتى ورقة معلومات لهاد الزراعة.",
    ],
  ],
  [
    "unsupported_for_plan",
    [
      "Not supported in plans",
      "Non pris en charge dans les plans",
      "غير مدعوم في الخطط",
      "ما كتدخلش فالخطط باقي",
    ],
    [
      "The crop is in the catalog but of a kind that cannot be placed in a rotation plan yet.",
      "La culture est dans le catalogue mais d'un type qui ne peut pas encore entrer dans un plan de rotation.",
      "المحصول في دليل المحاصيل لكنه من نوع لا يمكن إدراجه في خطة دورة زراعية بعد.",
      "هاد الزراعة كاينة فالدليل، ولكن النوع ديالها ما يقدرش يدخل باقي فخطة ديال الدورة الزراعية.",
    ],
  ],
  [
    "rejected",
    ["Rejected", "Rejeté", "مرفوض", "مرفوضة"],
    [
      "No valid rotation could be built that includes this crop.",
      "Aucune rotation valide incluant cette culture n'a pu être construite.",
      "تعذّر بناء أي دورة زراعية صالحة تتضمن هذا المحصول.",
      "ما قدرناش نوجدو حتى دورة زراعية صالحة كتدخل فيها هاد الزراعة.",
    ],
  ],
  [
    "queued",
    ["Waiting", "En attente", "في الانتظار", "كتسنى الدور"],
    [
      "The request was accepted and is waiting its turn.",
      "La demande a été acceptée et attend son tour.",
      "قُبل الطلب وينتظر دوره.",
      "الطلب تقبل ودابا كيتسنى الدور ديالو باش تبدا المعالجة.",
    ],
  ],
  [
    "running",
    ["In progress", "En cours", "قيد التنفيذ", "خدام دابا"],
    [
      "The request is being processed now.",
      "La demande est en cours de traitement.",
      "يجري تنفيذ الطلب الآن.",
      "الطلب ديالك كيتعالج دابا، والنتيجة ما وجداتش باقي.",
    ],
  ],
  [
    "submitted",
    ["Sent to NASA", "Envoyé à la NASA", "أُرسل إلى ناسا", "تصيفط لناسا"],
    [
      "The satellite data request was sent and is being prepared by NASA. This can take hours.",
      "La demande de données satellite a été envoyée et est en préparation chez la NASA. Cela peut prendre des heures.",
      "أُرسل طلب بيانات الأقمار وتجهّزه ناسا. قد يستغرق ذلك ساعات.",
      "طلب بيانات الأقمار تصيفط، وناسا كتوجد فيه. هاد الخدمة تقدر تاخد ساعات.",
    ],
  ],
  [
    "completed",
    ["Done", "Terminé", "اكتمل", "كمل"],
    [
      "The request finished and the result is ready.",
      "La demande est terminée et le résultat est prêt.",
      "اكتمل الطلب والنتيجة جاهزة.",
      "الطلب سالا والنتيجة ديالو واجدة باش تشوفها.",
    ],
  ],
  [
    "failed",
    ["Failed", "Échec", "فشل", "ما كملش"],
    [
      "The request could not be completed. The error code says why.",
      "La demande n'a pas pu aboutir. Le code d'erreur en donne la raison.",
      "تعذّر إكمال الطلب. ويبيّن رمز الخطأ السبب.",
      "ما قدرناش نكملو الطلب. رمز الخطأ كيبين شنو السبب.",
    ],
  ],
  [
    "awaiting_processing",
    [
      "Waiting to start",
      "En attente de démarrage",
      "بانتظار البدء",
      "كيتسنى يبدا",
    ],
    [
      "Stage: the plan is saved and waiting to be processed.",
      "Étape : le plan est enregistré et attend d'être traité.",
      "المرحلة: الخطة محفوظة وتنتظر المعالجة.",
      "مرحلة فالخطة: الخطة تحفظات ودابا كتسنى المعالجة ديالها تبدا.",
    ],
  ],
  [
    "verifying_evidence",
    [
      "Checking the evidence",
      "Vérification des données",
      "التحقق من الأدلة",
      "كنتحققو من المعلومات الموثقة",
    ],
    [
      "Stage: the catalog evidence used by the plan is being checked.",
      "Étape : les données du catalogue utilisées par le plan sont en cours de vérification.",
      "المرحلة: يجري التحقق من أدلة دليل المحاصيل التي تستخدمها الخطة.",
      "مرحلة فالخطة: كنتحققو من المعلومات الموثقة فالدليل اللي كتستعملها الخطة.",
    ],
  ],
  [
    "generating_sequences",
    [
      "Building rotations",
      "Construction des rotations",
      "بناء الدورات الزراعية",
      "كنوجدو الدورات",
    ],
    [
      "Stage: possible rotations are being built from the crop calendars.",
      "Étape : les rotations possibles sont construites à partir des calendriers culturaux.",
      "المرحلة: تُبنى الدورات الزراعية الممكنة من التقاويم الزراعية.",
      "مرحلة فالخطة: كنوجدو الدورات الزراعية الممكنة من تواريخ الزرع والحصاد ديال الزراعات.",
    ],
  ],
  [
    "retrieving_weather",
    [
      "Getting weather",
      "Récupération de la météo",
      "جلب بيانات الطقس",
      "كنجيبو بيانات الطقس",
    ],
    [
      "Stage: weather data for the field's location is being fetched.",
      "Étape : les données météo de l'emplacement de la parcelle sont en cours de récupération.",
      "المرحلة: تُجلب بيانات الطقس لموقع الحقل.",
      "مرحلة فالخطة: كنجيبو بيانات الطقس ديال البلاصة اللي فيها القطعة.",
    ],
  ],
  [
    "calculating",
    ["Calculating", "Calcul en cours", "جارٍ الحساب", "الحساب خدام"],
    [
      "Stage: the rotations are being scored and compared.",
      "Étape : les rotations sont en cours de notation et de comparaison.",
      "المرحلة: تُقيَّم الدورات الزراعية وتُقارَن.",
      "مرحلة فالخطة: كنعطيو النقط للدورات الزراعية وكنقارنوها مع بعضها.",
    ],
  ],
  [
    "complete",
    ["Complete", "Terminé", "مكتمل", "الخطة كملات"],
    [
      "Stage: the plan finished and its result can be read.",
      "Étape : le plan est terminé et son résultat peut être lu.",
      "المرحلة: انتهت الخطة ويمكن قراءة نتيجتها.",
      "مرحلة فالخطة: الحساب سالا ودابا تقدر تقرا النتيجة ديال الخطة.",
    ],
  ],
  [
    "awaiting_intake",
    [
      "Waiting to start",
      "En attente de démarrage",
      "بانتظار البدء",
      "كيتسنى فحص المعلومات",
    ],
    [
      "Stage of an early-format plan: waiting for the input check.",
      "Étape d'un plan au format ancien : en attente du contrôle des données saisies.",
      "مرحلة خطة بالصيغة القديمة: بانتظار فحص المدخلات.",
      "مرحلة فخطة بالصيغة القديمة: كتسنى الفحص ديال المعلومات اللي دخلتي.",
    ],
  ],
  [
    "verifying_intake",
    [
      "Checking your inputs",
      "Vérification de vos données",
      "فحص البيانات التي أدخلتها",
      "كنفحصو المعلومات ديالك",
    ],
    [
      "Stage of an early-format plan: your inputs are being checked.",
      "Étape d'un plan au format ancien : vos données saisies sont en cours de vérification.",
      "مرحلة خطة بالصيغة القديمة: تُفحص مدخلاتك.",
      "مرحلة فخطة بالصيغة القديمة: كنفحصو المعلومات اللي دخلتي.",
    ],
  ],
  [
    "intake_complete",
    [
      "Inputs checked",
      "Données vérifiées",
      "اكتمل فحص المدخلات",
      "فحص المعلومات كمل",
    ],
    [
      "Stage of an early-format plan: the input check finished.",
      "Étape d'un plan au format ancien : le contrôle des données saisies est terminé.",
      "مرحلة خطة بالصيغة القديمة: انتهى فحص المدخلات.",
      "مرحلة فخطة بالصيغة القديمة: الفحص ديال المعلومات اللي دخلتي كمل.",
    ],
  ],
  [
    "intake_failed",
    [
      "Input check failed",
      "Échec du contrôle des données",
      "فشل فحص المدخلات",
      "فحص المعلومات ما كملش",
    ],
    [
      "Stage of an early-format plan: the input check could not be completed.",
      "Étape d'un plan au format ancien : le contrôle des données saisies n'a pas pu aboutir.",
      "مرحلة خطة بالصيغة القديمة: تعذّر إكمال فحص المدخلات.",
      "مرحلة فخطة بالصيغة القديمة: ما قدرناش نكملو فحص المعلومات اللي دخلتي.",
    ],
  ],
  [
    "baseline_unavailable",
    [
      "Your current rotation could not be scored",
      "Votre rotation actuelle n'a pas pu être notée",
      "تعذّر تقييم دورتك الزراعية الحالية",
      "الدورة الحالية ما قدرناش نعطيوها نقطة",
    ],
    [
      "Your current rotation could not be scored, so alternatives are not compared against it.",
      "Votre rotation actuelle n'a pas pu être notée : les alternatives ne sont pas comparées à elle.",
      "تعذّر تقييم دورتك الزراعية الحالية، لذلك لا تُقارَن البدائل بها.",
      "ما قدرناش نعطيو نقطة للدورة الحالية ديالك، وداكشي علاش ما كنقارنوش البدائل معاها.",
    ],
  ],
  [
    "insufficient_alternatives",
    [
      "Fewer than two alternatives",
      "Moins de deux alternatives",
      "أقل من بديلين",
      "لقينا أقل من جوج بدائل",
    ],
    [
      "Fewer than two different alternatives to your current rotation could be found and scored.",
      "Moins de deux alternatives différentes à votre rotation actuelle ont pu être trouvées et notées.",
      "لم نتمكن من العثور على بديلين مختلفين أو أكثر لدورتك الزراعية الحالية وتقييمهما.",
      "قدرنا نلقاو ونعطيو نقط لأقل من جوج بدائل مختلفين على الدورة الحالية ديالك.",
    ],
  ],
  [
    "scored",
    ["Scored", "Notée", "مقيَّم", "تحسبات النقطة ديالها"],
    [
      "Your current rotation was scored with the same method as the alternatives.",
      "Votre rotation actuelle a été notée avec la même méthode que les alternatives.",
      "قُيِّمت دورتك الزراعية الحالية بالطريقة نفسها التي قُيِّمت بها البدائل.",
      "الدورة الحالية ديالك خذات نقطة بنفس الطريقة اللي استعملنا مع البدائل.",
    ],
  ],
  [
    "not_provided",
    ["Not provided", "Non fournie", "غير مقدَّم", "ما تعطاش"],
    [
      "No current rotation was given and none could be inferred.",
      "Aucune rotation actuelle n'a été fournie et aucune n'a pu être déduite.",
      "لم تُقدَّم دورة زراعية حالية ولم يمكن استنتاجها.",
      "ما عطيتيش الدورة الزراعية الحالية ديالك، وما قدرناش نستنتجوها من المعلومات اللي عندنا.",
    ],
  ],
  [
    "not_evaluable",
    [
      "Could not be evaluated",
      "Non évaluable",
      "تعذّر تقييمه",
      "ما قدرناش نقيّموها",
    ],
    [
      "Your current rotation was given but cannot be evaluated with the evidence available.",
      "Votre rotation actuelle a été fournie mais ne peut pas être évaluée avec les données disponibles.",
      "قُدِّمت دورتك الزراعية الحالية، لكن لا يمكن تقييمها بالأدلة المتوفرة.",
      "عطيتي الدورة الزراعية الحالية ديالك، ولكن ما يمكنش نقيّموها بالمعلومات الموثقة اللي متوفرة.",
    ],
  ],
  [
    "farmer_declared",
    [
      "Declared by you",
      "Déclarée par vous",
      "صرّحتَ به أنت",
      "نتا اللي صرحتي بها",
    ],
    [
      "The current rotation is the one you described.",
      "La rotation actuelle est celle que vous avez décrite.",
      "الدورة الزراعية الحالية هي التي وصفتَها.",
      "الدورة الزراعية الحالية هي نفس الدورة اللي وصفتيها لينا نتا.",
    ],
  ],
  [
    "inferred_from_history",
    [
      "Inferred from your history",
      "Déduite de votre historique",
      "مستنتَج من سجلك",
      "استنتجناها من السجل ديالك",
    ],
    [
      "No current rotation was declared, so it was guessed from the crops in your history. Check that it is right.",
      "Aucune rotation actuelle n'a été déclarée : elle a été devinée à partir des cultures de votre historique. Vérifiez qu'elle est juste.",
      "لم تُحدَّد دورة زراعية حالية، فتم تقديرها من محاصيل سجلك. تأكد من صحتها.",
      "ما صرحتيش بالدورة الحالية، وخمنّاها من الزراعات اللي فالسجل ديالك. تأكد واش صحيحة.",
    ],
  ],
  [
    "engine_ranked",
    [
      "Found by the ranking",
      "Trouvée par le classement",
      "بديل اقترحته روتافيس ورتّبته",
      "بديل لقاه روتافيس ورتبو",
    ],
    [
      "An alternative found and ranked by Rotavise, not one you declared.",
      "Une alternative trouvée et classée par Rotavise, non déclarée par vous.",
      "بديل وجدته روتافيس ورتّبته، ولم تصرّح به أنت.",
      "هاد البديل لقاه روتافيس ورتبو فالمقارنة، ماشي نتا اللي صرحتي به.",
    ],
  ],
  [
    "current",
    [
      "Your current rotation",
      "Votre rotation actuelle",
      "دورتك الزراعية الحالية",
      "الدورة الحالية ديالك",
    ],
    [
      "The baseline the alternatives are compared with.",
      "La référence à laquelle les alternatives sont comparées.",
      "الأساس الذي تُقارَن به البدائل.",
      "هادي هي الدورة المرجعية اللي كنقارنو معاها البدائل المقترحة.",
    ],
  ],
  [
    "alternative",
    ["Alternative", "Alternative", "بديل", "بديل"],
    [
      "A different rotation suggested for comparison with your current one.",
      "Une rotation différente proposée pour être comparée à l'actuelle.",
      "دورة زراعية مختلفة مقترحة للمقارنة مع دورتك الزراعية الحالية.",
      "دورة زراعية مختلفة كنقترحوها باش تقارنها مع الدورة الحالية ديالك.",
    ],
  ],
  [
    "reviewed",
    ["Reviewed", "Relu", "مراجَع", "راجعها مختص"],
    [
      "Every binding rule of the crop has been reviewed by a specialist.",
      "Chaque règle contraignante de la culture a été relue par un spécialiste.",
      "راجع مختص كل القواعد الملزمة لهذا المحصول.",
      "كل قاعدة ملزمة لهاد الزراعة تراجعات من طرف مختص.",
    ],
  ],
  [
    "pending",
    [
      "Review pending",
      "Relecture en attente",
      "في انتظار المراجعة",
      "كتسنى المراجعة",
    ],
    [
      "Not every binding rule of the crop has been reviewed by a specialist yet.",
      "Toutes les règles contraignantes de la culture n'ont pas encore été relues par un spécialiste.",
      "لم يراجع مختص بعد كل القواعد الملزمة لهذا المحصول.",
      "ماشي جميع القواعد الملزمة لهاد الزراعة تراجعات من طرف مختص باقي.",
    ],
  ],
  [
    "available",
    ["Available", "Disponible", "متاح", "متوفر"],
    [
      "The result could be computed with the evidence available.",
      "Le résultat a pu être calculé avec les données disponibles.",
      "أمكن حساب النتيجة بالأدلة المتوفرة.",
      "قدرنا نحسبو النتيجة باستعمال المعلومات الموثقة اللي متوفرة.",
    ],
  ],
]);

// How well a rule, a source or a number has been checked.
export const evidenceTerms = rows("evidence", [
  [
    "extracted",
    [
      "Extracted from a source",
      "Extraite d'une source",
      "مستخرَجة من مصدر",
      "تخرجات من مصدر",
    ],
    [
      "The rule was read from a source but has not been checked against it. Rotavise does not use such a rule to accept or refuse a crop.",
      "La règle a été lue dans une source mais n'a pas été vérifiée par rapport à elle. Rotavise ne l'utilise pas pour accepter ou refuser une culture.",
      "استُخرجت القاعدة من مصدر، لكن لم يُتحقق من مطابقتها له. لا تستخدمها روتافيس لقبول محصول أو رفضه.",
      "القاعدة تخرجات من مصدر ولكن ما تأكدناش واش كاتوافقو. روتافيس ما كيستعملهاش باش يقبل زراعة ولا يرفضها.",
    ],
  ],
  [
    "double_checked",
    ["Double-checked", "Revérifiée", "مدقَّقة مرتين", "دازت من تدقيق ثاني"],
    [
      "The quote was found in the cited source and a second reading confirmed what it says. It is still not an expert review.",
      "La citation a été retrouvée dans la source citée et une seconde lecture a confirmé son sens. Ce n'est toujours pas une relecture par un expert.",
      "وُجد الاقتباس في المصدر المذكور وأكدت قراءة ثانية معناه. ومع ذلك ليست هذه مراجعة خبير.",
      "لقينا الاقتباس فالمصدر المذكور، وقراءة ثانية أكدات المعنى ديالو. هادا ماشي مراجعة ديال خبير.",
    ],
  ],
  [
    "expert_reviewed",
    [
      "Expert-reviewed",
      "Relue par un expert",
      "مراجَعة من خبير",
      "راجعها خبير",
    ],
    [
      "A named specialist reviewed the rule and recorded their qualification and the date.",
      "Un spécialiste identifié a relu la règle et consigné sa qualification et la date.",
      "راجع القاعدة مختص مذكور بالاسم، وسجّل مؤهلاته وتاريخ المراجعة.",
      "مختص معروف بالسمية راجع القاعدة وسجل المؤهلات ديالو وتاريخ المراجعة.",
    ],
  ],
  [
    "model_recall",
    [
      "Recalled by an AI model",
      "Issue de la mémoire d'un modèle d'IA",
      "من ذاكرة نموذج ذكاء اصطناعي",
      "من ذاكرة نموذج ذكاء اصطناعي",
    ],
    [
      "The knowledge was written from an AI model's memory, with a stated confidence, not quoted from a source. It is used like other rules, but a sourced rule wins if they disagree.",
      "La connaissance a été écrite de mémoire par un modèle d'IA, avec un niveau de confiance indiqué, sans citation d'une source. Elle est utilisée comme les autres règles, mais une règle sourcée l'emporte en cas de désaccord.",
      "كُتبت المعرفة من ذاكرة نموذج ذكاء اصطناعي مع درجة ثقة معلنة، دون اقتباس من مصدر. تُستخدم كباقي القواعد، لكن القاعدة الموثقة بمصدر تتقدم عند التعارض.",
      "المعلومة كتبها نموذج ذكاء اصطناعي من الذاكرة ديالو، مع درجة الثقة، بلا اقتباس من مصدر. كتستعمل بحال باقي القواعد، ولكن إلا تعارضات مع قاعدة موثقة بمصدر، كتسبق القاعدة الموثقة.",
    ],
  ],
  [
    "sourced",
    ["Sourced", "Sourcée", "موثقة بمصدر", "عندها مصدر مذكور"],
    [
      "The item comes from a cited publication or dataset.",
      "L'élément provient d'une publication ou d'un jeu de données cité.",
      "العنصر مأخوذ من منشور أو مجموعة بيانات مذكورة.",
      "هاد المعلومة جاية من منشور ولا مجموعة بيانات، والمصدر ديالها مذكور.",
    ],
  ],
  [
    "engineering_judgment",
    [
      "Rotavise's own choice",
      "Choix propre à Rotavise",
      "اختيار خاص بروتافيس",
      "اختيار ديال روتافيس",
    ],
    [
      "A reading aid or threshold chosen by Rotavise, not taken from a published standard.",
      "Un repère de lecture ou un seuil choisi par Rotavise, non tiré d'une norme publiée.",
      "مؤشر للمساعدة على فهم النتائج أو عتبة اختارتها روتافيس، وليس مأخوذاً من معيار منشور.",
      "مؤشر باش يسهل فهم النتيجة ولا عتبة اختارها روتافيس، وما خذاهاش من معيار منشور.",
    ],
  ],
  [
    "reference",
    ["Reference only", "Référence seulement", "مرجعي فقط", "غير للمرجع"],
    [
      "A rule strength: shown for information, never used to accept, refuse or rank.",
      "Niveau de règle : affichée à titre d'information, jamais utilisée pour accepter, refuser ou classer.",
      "درجة إلزام القاعدة: تُعرض للمعلومة فقط، ولا تُستخدم أبداً لقبول محصول أو رفضه أو ترتيبه.",
      "درجة إلزام القاعدة: كتبان غير للمعلومة، وما كتستعملش باش نقبلو زراعة ولا نرفضوها ولا نرتبوها.",
    ],
  ],
  [
    "soft",
    ["Advice", "Conseil", "توصية", "نصيحة"],
    [
      "A rule strength: a recommendation. Not meeting it leaves the crop possible, with a warning.",
      "Niveau de règle : une recommandation. Ne pas la respecter laisse la culture possible, avec une réserve.",
      "درجة إلزام القاعدة: توصية. عدم استيفائها يُبقي المحصول ممكناً مع تنبيه.",
      "درجة إلزام القاعدة: غير توصية. إلا ما تحترماتش، الزراعة كتبقى ممكنة ولكن مع تنبيه.",
    ],
  ],
  [
    "hard",
    ["Binding limit", "Limite contraignante", "حد ملزم", "حد ضروري"],
    [
      "A rule strength: a limit. Not meeting it excludes the crop.",
      "Niveau de règle : une limite. Ne pas la respecter exclut la culture.",
      "درجة إلزام القاعدة: حد ملزم. عدم استيفائه يؤدي إلى استبعاد المحصول.",
      "درجة إلزام القاعدة: حد ملزم. إلا ما تحترمش، كيتحيد هاد الاختيار ديال الزراعة.",
    ],
  ],
  [
    "synthetic",
    ["Test data", "Données de test", "بيانات اختبار", "بيانات غير للتجريب"],
    [
      "Invented data used only in tests. Production never serves it as real evidence.",
      "Données inventées utilisées seulement dans les tests. La production ne les sert jamais comme des données réelles.",
      "بيانات مختلقة تُستخدم للاختبارات فقط. لا تُقدَّم أبداً في النسخة المستخدمة فعلياً على أنها أدلة حقيقية.",
      "بيانات مخترعة كنستعملوها غير فالتجارب. النسخة اللي كيستعملوها الناس ما كتقدمهاش أبدا على أنها معلومات حقيقية.",
    ],
  ],
]);

// Scores shown on strategies and options.
export const scoreTerms = rows("score", [
  [
    "weightedLoss",
    ["Weighted loss", "Perte pondérée", "الخسارة الموزونة", "الخسارة الموزونة"],
    [
      "One number from 0 to 1 combining the losses of the compared criteria with your priorities. Lower is better; it is not a yield or an income.",
      "Un nombre de 0 à 1 qui combine les pertes des critères comparés selon vos priorités. Plus c'est bas, mieux c'est ; ce n'est ni un rendement ni un revenu.",
      "قيمة من 0 إلى 1 تجمع درجات الخسارة في المعايير المقارَنة بحسب أولوياتك. الأقل أفضل؛ وهي لا تمثل مردودية المحصول ولا الدخل.",
      "رقم من 0 حتى 1 كيجمع خسائر المعايير اللي تقارنو، على حساب الأولويات ديالك. الأقل أحسن، وماشي مردودية المحصول ولا الدخل.",
    ],
  ],
  [
    "rank",
    ["Rank", "Rang", "الرتبة", "الرتبة"],
    [
      "Position among the rotations compared, 1 being the lowest weighted loss. Close ranks are not meaningfully different.",
      "Position parmi les rotations comparées, 1 étant la perte pondérée la plus faible. Des rangs proches ne sont pas réellement différents.",
      "الموضع بين الدورات الزراعية المقارَنة، والرتبة 1 هي الأقل خسارة موزونة. الرتب المتقاربة لا فرق جوهرياً بينها.",
      "البلاصة وسط الدورات اللي تقارنو. الرتبة 1 عندها أقل خسارة موزونة. الرتب المتقاربة ما كتعنيش فرق مهم بينها.",
    ],
  ],
  [
    "climate",
    [
      "Climate loss",
      "Perte climatique",
      "الخسارة المناخية",
      "الخسارة المناخية",
    ],
    [
      "How much heat, cold or other temperature damage the crops would have met in past seasons, against each crop's own sourced limits. It is a loss score, not a yield.",
      "Quels dégâts de chaleur, de froid ou autres liés à la température les cultures auraient subis lors de campagnes passées, selon les limites sourcées propres à chaque culture. C'est un score de perte, pas un rendement.",
      "مقدار أضرار درجات الحرارة، من حر وبرد وغيرهما، التي كانت ستتعرض لها المحاصيل في مواسم سابقة، بحسب الحدود الموثقة لكل محصول. هذه درجة خسارة وليست مردودية المحصول.",
      "شحال من ضرر السخونية والبرد وباقي تأثيرات الحرارة كانت غادي تلقاه الزراعات فالمواسم اللي فاتو، على حساب الحدود الموثقة ديال كل زراعة. هادي نقطة خسارة وماشي المردودية.",
    ],
  ],
  [
    "water",
    [
      "Water loss",
      "Perte liée à l'eau",
      "الخسارة المائية",
      "الخسارة المرتبطة بالما",
    ],
    [
      "A rough water-stress score from the catalog's water-need classes. It is not a computed water balance.",
      "Un score approximatif de stress hydrique issu des classes de besoin en eau du catalogue. Ce n'est pas un bilan hydrique calculé.",
      "درجة تقريبية للإجهاد المائي، مبنية على فئات احتياجات المحاصيل من الماء في دليل المحاصيل. وهي ليست حصيلة مائية محسوبة.",
      "نقطة تقريبية ديال الإجهاد المائي من فئات احتياجات الما اللي فالدليل. هادي ماشي حصيلة مائية محسوبة.",
    ],
  ],
  [
    "soil_health",
    [
      "Soil-health loss",
      "Perte liée à la santé du sol",
      "خسارة صحة التربة",
      "الخسارة فصحة التربة",
    ],
    [
      "A rough indicator from rotation rules such as previous-crop fit and family repeats. It is not a soil measurement.",
      "Un indicateur approximatif issu des règles de rotation comme l'enchaînement des précédents et les répétitions de famille. Ce n'est pas une mesure du sol.",
      "مؤشر تقريبي من قواعد الدورة الزراعية مثل ملاءمة المحصول السابق وتكرار الفصيلة. وليس قياساً للتربة.",
      "مؤشر تقريبي من قواعد الدورة الزراعية، بحال ملاءمة الزراعة اللي قبل وتكرار نفس الفصيلة. هادا ماشي قياس للتربة.",
    ],
  ],
  [
    "crop_health",
    [
      "Crop-health loss",
      "Perte liée à la santé des cultures",
      "خسارة صحة المحاصيل",
      "الخسارة فصحة الزراعات",
    ],
    [
      "A score from pest and disease waiting-period rules, using the problems you reported. It is not a diagnosis.",
      "Un score issu des règles de délai d'attente liées aux ravageurs et maladies, à partir des problèmes que vous avez signalés. Ce n'est pas un diagnostic.",
      "درجة من قواعد فترات الانتظار المتعلقة بالآفات والأمراض بناءً على المشكلات التي أبلغتَ عنها. وليست تشخيصاً.",
      "نقطة من قواعد مدة الانتظار بسبب الأمراض والآفات، باستعمال المشاكل اللي بلغتي عليها. هادا ماشي تشخيص.",
    ],
  ],
  [
    "versusCurrent",
    [
      "Versus your current rotation",
      "Par rapport à votre rotation actuelle",
      "مقارنةً بدورتك الزراعية الحالية",
      "بالمقارنة مع الدورة الحالية ديالك",
    ],
    [
      "The difference from your current rotation for each criterion. Positive means more loss than your current rotation; negative means less.",
      "L'écart avec votre rotation actuelle pour chaque critère. Positif signifie plus de perte que votre rotation actuelle ; négatif, moins.",
      "الفرق عن دورتك الزراعية الحالية في كل معيار. الموجب يعني خسارة أكثر من دورتك الزراعية الحالية، والسالب أقل.",
      "الفرق مع الدورة الحالية ديالك فكل معيار. إلا كان موجب فالخسارة كثر، وإلا كان سالب فالخسارة أقل.",
    ],
  ],
  [
    "priorities",
    ["Your priorities", "Vos priorités", "أولوياتك", "الأولويات ديالك"],
    [
      "Four sliders (climate, water, soil health, crop health) saying how much each criterion matters to you. They set the weights used in the ranking.",
      "Quatre curseurs (climat, eau, santé du sol, santé des cultures) indiquant l'importance de chaque critère pour vous. Ils fixent les pondérations du classement.",
      "أربعة أشرطة للتحكم (المناخ، الماء، صحة التربة، صحة المحاصيل) تحدد بها أهمية كل معيار لك. وهي تحدد الأوزان المستخدمة في الترتيب.",
      "ربعة أشرطة كتبدل بهم أهمية المناخ والما وصحة التربة وصحة الزراعات عندك. هما اللي كيحددو أوزان المعايير فالترتيب.",
    ],
  ],
  [
    "meanChange",
    [
      "Change under future climate",
      "Variation sous le climat futur",
      "التغير في المناخ المستقبلي",
      "التغيير مع المناخ الجاي",
    ],
    [
      "The average change in climate loss between past seasons and future-climate scenarios across the climate models. Positive means worse.",
      "La variation moyenne de la perte climatique entre les campagnes passées et les scénarios du climat futur, sur l'ensemble des modèles climatiques. Positif signifie une dégradation.",
      "متوسط التغير في الخسارة المناخية بين المواسم السابقة وسيناريوهات المناخ المستقبلي عبر النماذج المناخية. الموجب يعني الأسوأ.",
      "متوسط التغيير فالخسارة المناخية بين المواسم اللي فاتو وسيناريوهات المناخ الجاي عبر النماذج المناخية. الموجب كيعني النتيجة أسوأ.",
    ],
  ],
]);
