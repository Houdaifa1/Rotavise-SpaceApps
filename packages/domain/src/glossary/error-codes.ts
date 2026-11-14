import { rows } from "./types.js";

// Stable codes the API returns in `{ "code": ... }` error bodies and in the
// `error` field of failed plans and requests. None carries personal data, and
// none reveals a provider's own message.
export const errorCodes = rows("error", [
  [
    "NO_FIELD_FOUND",
    [
      "No suggested outline here",
      "Aucun contour proposé ici",
      "لا يوجد مخطط مقترح هنا",
      "ما كاين حتى حد مقترح هنا",
    ],
    [
      "No imported outline contains this point. Draw, paint or upload your field boundary.",
      "Aucun contour importé ne contient ce point. Dessinez votre parcelle, peignez des cellules ou importez son contour.",
      "لا يحتوي أي مخطط مستورد هذه النقطة. ارسم حدود حقلك أو حدّد خلايا على الخريطة أو ارفع ملف الحدود.",
      "حتى حد مستورد ما فيه هاد النقطة. رسم حدود الحقل ديالك، ولا علّم الخانات فالخريطة، ولا حمّل ملف الحدود.",
    ],
  ],
  [
    "FIELD_BOUNDARIES_UNAVAILABLE",
    [
      "Field outlines unavailable",
      "Contours des parcelles indisponibles",
      "مخططات الحقول غير متاحة",
      "حدود الحقول ما متوفرينش",
    ],
    [
      "Suggested outlines cannot be read right now. Try again or draw your field.",
      "Les contours proposés ne peuvent pas être chargés pour le moment. Réessayez ou dessinez votre parcelle.",
      "يتعذر تحميل المخططات المقترحة الآن. حاول مجدداً أو ارسم حدود حقلك.",
      "ما قدرناش نجيبو الحدود المقترحة دابا. عاود جرّب ولا رسم الحقل ديالك.",
    ],
  ],
  [
    "INVALID_INPUT",
    [
      "Invalid input",
      "Données invalides",
      "البيانات المُدخلة غير صالحة",
      "المعلومات اللي دخلتي ما صالحةش",
    ],
    [
      "The request is not in the expected form or has a value that is not allowed. Correct it and send it again.",
      "La demande n'a pas la forme attendue ou contient une valeur non autorisée. Corrigez-la et renvoyez-la.",
      "الطلب ليس بالشكل المتوقع أو يحتوي قيمة غير مسموحة. صحّحه وأعد إرساله.",
      "الطلب ماشي بالشكل المطلوب ولا فيه شي قيمة ما مسموحاش. صححو وصيفطو من جديد.",
    ],
  ],
  [
    "UNAUTHORIZED",
    [
      "Sign-in needed",
      "Connexion requise",
      "يلزم تسجيل الدخول",
      "خاصك تدخل للحساب",
    ],
    [
      "You are not signed in, or your session or token is no longer valid.",
      "Vous n'êtes pas connecté, ou votre session ou votre jeton n'est plus valide.",
      "لم تسجّل الدخول أو لم تعد جلستك أو رمزك صالحاً.",
      "ما دخلتيش للحساب، ولا الجلسة ديالك ولا رمز الدخول ما بقاوش صالحين.",
    ],
  ],
  [
    "NOT_FOUND",
    ["Not found", "Introuvable", "غير موجود", "ما لقيناهش"],
    [
      "What you asked for does not exist, or it belongs to someone else.",
      "Ce que vous demandez n'existe pas ou appartient à quelqu'un d'autre.",
      "ما طلبتَه غير موجود أو يخص شخصاً آخر.",
      "الشي اللي طلبتي ما كاينش، ولا راه ديال شي واحد آخر.",
    ],
  ],
  [
    "IDEMPOTENCY_CONFLICT",
    [
      "Conflict with a saved version",
      "Conflit avec une version enregistrée",
      "تعارض مع نسخة محفوظة",
      "تعارض مع نسخة محفوظة",
    ],
    [
      "Someone changed the record first, or the same request key was reused with different content. Reload and try again.",
      "Quelqu'un a modifié l'enregistrement avant vous, ou la même clé de demande a été réutilisée avec un contenu différent. Rechargez et réessayez.",
      "غيّر أحدٌ السجل قبلك، أو أُعيد استخدام مفتاح الطلب نفسه بمحتوى مختلف. أعد التحميل وحاول مجدداً.",
      "شي واحد بدل السجل قبلك، ولا تعاود استعمل نفس مفتاح الطلب بمحتوى مختلف. عاود حمل الصفحة وجرب من جديد.",
    ],
  ],
  [
    "RATE_LIMITED",
    [
      "Too many requests",
      "Trop de demandes",
      "طلبات كثيرة جداً",
      "طلبات كثر من المسموح",
    ],
    [
      "You reached a usage limit. Wait the time given in the Retry-After header and try again.",
      "Vous avez atteint une limite d'utilisation. Attendez le délai indiqué dans l'en-tête Retry-After puis réessayez.",
      "بلغتَ حداً للاستخدام. انتظر المدة المذكورة في ترويسة Retry-After ثم حاول مجدداً.",
      "وصلتي للحد ديال الاستعمال. تسنى المدة اللي فخانة Retry-After ديال الرد، ومن بعد عاود جرب.",
    ],
  ],
  [
    "CATALOG_UNAVAILABLE",
    [
      "Catalog unavailable",
      "Catalogue indisponible",
      "دليل المحاصيل غير متاح",
      "دليل الزراعات ما متوفرش",
    ],
    [
      "The crop catalog could not be read right now. Try again later.",
      "Le catalogue des cultures n'a pas pu être lu pour le moment. Réessayez plus tard.",
      "تعذّرت قراءة دليل المحاصيل الآن. حاول لاحقاً.",
      "ما قدرناش نقراو دليل الزراعات دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "CATALOG_NOT_FOUND",
    [
      "Catalog version not found",
      "Version du catalogue introuvable",
      "إصدار دليل المحاصيل غير موجود",
      "نسخة الدليل ما لقيناهاش",
    ],
    [
      "No catalog with that identifier and version exists.",
      "Aucun catalogue avec cet identifiant et cette version n'existe.",
      "لا يوجد كتالوج بهذا المعرّف والإصدار.",
      "ما كاين حتى دليل بهاد المعرّف وهاد النسخة اللي طلبتي.",
    ],
  ],
  [
    "STORED_REQUEST_INVALID",
    [
      "Saved request no longer valid",
      "Demande enregistrée devenue invalide",
      "الطلب المحفوظ لم يعد صالحاً",
      "الطلب المحفوظ ما بقاش صالح",
    ],
    [
      "The saved request could not be read back safely, so it was not processed. This is a fault on our side, not in your input.",
      "La demande enregistrée n'a pas pu être relue en toute sécurité : elle n'a pas été traitée. C'est un défaut de notre côté, pas de vos données.",
      "تعذّرت إعادة قراءة الطلب المحفوظ بأمان فلم يُعالج. هذا خلل من جانبنا لا في مدخلاتك.",
      "ما قدرناش نقراو الطلب المحفوظ بطريقة سليمة، وداكشي علاش ما تعالجش. هادا خلل من عندنا، ماشي فالمعلومات اللي دخلتي.",
    ],
  ],
  [
    "PLAN_UNAVAILABLE",
    [
      "Plans unavailable",
      "Plans indisponibles",
      "الخطط غير متاحة",
      "خدمة التخطيط ما متوفراش",
    ],
    [
      "The planning service could not be reached right now. Try again later.",
      "Le service de planification n'est pas joignable pour le moment. Réessayez plus tard.",
      "تعذّر الوصول إلى خدمة التخطيط الآن. حاول لاحقاً.",
      "ما قدرناش نتاصلو بخدمة التخطيط دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "FIELD_UNAVAILABLE",
    [
      "Fields unavailable",
      "Parcelles indisponibles",
      "الحقول غير متاحة",
      "خدمة القطع ما متوفراش",
    ],
    [
      "The field service could not be reached right now. Try again later.",
      "Le service des parcelles n'est pas joignable pour le moment. Réessayez plus tard.",
      "تعذّر الوصول إلى خدمة الحقول الآن. حاول لاحقاً.",
      "ما قدرناش نتاصلو بخدمة القطع الفلاحية دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "AUTH_UNAVAILABLE",
    [
      "Sign-in unavailable",
      "Connexion indisponible",
      "تسجيل الدخول غير متاح",
      "الدخول للحساب ما متوفرش",
    ],
    [
      "The sign-in service could not be reached right now. Try again later.",
      "Le service de connexion n'est pas joignable pour le moment. Réessayez plus tard.",
      "تعذّر الوصول إلى خدمة تسجيل الدخول الآن. حاول لاحقاً.",
      "ما قدرناش نتاصلو بخدمة الدخول للحساب دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "INVALID_ORIGIN_OR_CONTENT_TYPE",
    [
      "Request refused for safety",
      "Demande refusée par sécurité",
      "رُفض الطلب لأسباب أمنية",
      "الطلب ترفض لأسباب أمنية",
    ],
    [
      "The request came from an origin that is not allowed or was not sent as JSON.",
      "La demande vient d'une origine non autorisée ou n'a pas été envoyée en JSON.",
      "جاء الطلب من مصدر غير مسموح به أو لم يُرسل بصيغة JSON.",
      "الطلب جا من أصل ما مسموحش به، ولا ما تصيفطش بصيغة JSON.",
    ],
  ],
  [
    "INVALID_REDIRECT",
    [
      "Invalid return address",
      "Adresse de retour invalide",
      "عنوان العودة غير صالح",
      "عنوان الرجوع ما صالحش",
    ],
    [
      "The address to return to after signing in is not an allowed one.",
      "L'adresse de retour après connexion n'est pas autorisée.",
      "عنوان العودة بعد تسجيل الدخول غير مسموح به.",
      "العنوان اللي غادي ترجع ليه من بعد الدخول للحساب ماشي من العناوين المسموح بها.",
    ],
  ],
  [
    "RETRIES_EXHAUSTED",
    [
      "Gave up after retries",
      "Abandon après plusieurs essais",
      "توقف بعد استنفاد المحاولات",
      "وقف من بعد عدة محاولات",
    ],
    [
      "The calculation was tried several times and kept failing, so it was stopped.",
      "Le calcul a été tenté plusieurs fois sans succès : il a été arrêté.",
      "جُرّب الحساب مرات عدة وظل يفشل فأُوقف.",
      "جربنا الحساب عدة مرات وبقى كيفشل. داكشي علاش وقفناه.",
    ],
  ],
  [
    "QUEUE_TERMINAL_WITHOUT_RESULT",
    [
      "Ended without a result",
      "Terminé sans résultat",
      "انتهى دون نتيجة",
      "سالا بلا نتيجة",
    ],
    [
      "The background job ended without leaving a result. This is a fault on our side.",
      "La tâche en arrière-plan s'est terminée sans laisser de résultat. C'est un défaut de notre côté.",
      "انتهت المهمة الخلفية دون ترك نتيجة. هذا خلل من جانبنا.",
      "الخدمة اللي خدامة فالخلفية سالات بلا ما تخلي نتيجة. هادا خلل من عندنا.",
    ],
  ],
  [
    "CATALOG_EVIDENCE_INVALID",
    [
      "Catalog evidence invalid",
      "Données du catalogue invalides",
      "أدلة دليل المحاصيل غير صالحة",
      "المعلومات الموثقة فالدليل ما صالحةش",
    ],
    [
      "The catalog data needed for the plan failed its integrity check, so no result was produced.",
      "Les données du catalogue nécessaires au plan ont échoué au contrôle d'intégrité : aucun résultat n'a été produit.",
      "فشلت بيانات دليل المحاصيل اللازمة للخطة في فحص السلامة فلم تُنتج نتيجة.",
      "بيانات الدليل اللي كتحتاجها الخطة ما دازتش من فحص السلامة. داكشي علاش ما خرجات حتى نتيجة.",
    ],
  ],
  [
    "WEATHER_UNAVAILABLE",
    [
      "Weather unavailable",
      "Météo indisponible",
      "بيانات الطقس غير متوفرة",
      "بيانات الطقس ما متوفراش",
    ],
    [
      "The weather data needed for the plan could not be obtained, so no result was produced rather than guessing.",
      "Les données météo nécessaires au plan n'ont pas pu être obtenues : aucun résultat n'a été produit plutôt que de deviner.",
      "تعذّر الحصول على بيانات الطقس اللازمة للخطة، فلم تُنتج نتيجة بدلاً من التخمين.",
      "ما قدرناش نجيبو بيانات الطقس اللي كتحتاجها الخطة. داكشي علاش ما خرجنا حتى نتيجة باش ما نخمنوش.",
    ],
  ],
  [
    "PLANNING_LIMIT_EXCEEDED",
    [
      "Plan too large",
      "Plan trop volumineux",
      "الخطة أكبر من الحد",
      "الخطة كبيرة على حد الحساب",
    ],
    [
      "The plan asked for more than the calculation limits allow. Reduce the number of crops or the length.",
      "Le plan demande plus que ce que les limites de calcul permettent. Réduisez le nombre de cultures ou la durée.",
      "تطلب الخطة أكثر مما تسمح به حدود الحساب. قلّل عدد المحاصيل أو المدة.",
      "الخطة كتطلب كثر من اللي كيسمح به حد الحساب. نقص عدد الزراعات ولا مدة الخطة.",
    ],
  ],
  [
    "WORKFLOW_VERSION_UNSUPPORTED",
    [
      "Plan version not supported",
      "Version du plan non prise en charge",
      "إصدار الخطة غير مدعوم",
      "نسخة الخطة ما كتخدمش هنا",
    ],
    [
      "The plan was made by a calculation version that this server no longer runs.",
      "Le plan a été fait par une version du calcul que ce serveur n'exécute plus.",
      "أُنشئت الخطة بإصدار حساب لم يعد هذا الخادم يشغّله.",
      "الخطة تدارَت بنسخة من الحساب اللي هاد الخادم ما بقاش كيشغلها.",
    ],
  ],
  [
    "CALCULATION_FAILED",
    ["Calculation failed", "Échec du calcul", "فشل الحساب", "الحساب ما نجحش"],
    [
      "The calculation stopped on an unexpected problem. This is a fault on our side.",
      "Le calcul s'est arrêté sur un problème inattendu. C'est un défaut de notre côté.",
      "توقف الحساب بسبب مشكلة غير متوقعة. هذا خلل من جانبنا.",
      "الحساب وقف على مشكل ما كانش متوقع. هادا خلل من عندنا.",
    ],
  ],
  [
    "CROP_HEALTH_UNAVAILABLE",
    [
      "Crop-health service unavailable",
      "Service de santé des cultures indisponible",
      "خدمة صحة المحاصيل غير متاحة",
      "خدمة صحة الزراعات ما متوفراش",
    ],
    [
      "The crop-health service could not be reached right now. Try again later.",
      "Le service de santé des cultures n'est pas joignable pour le moment. Réessayez plus tard.",
      "تعذّر الوصول إلى خدمة صحة المحاصيل الآن. حاول لاحقاً.",
      "ما قدرناش نتاصلو بخدمة صحة الزراعات دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "AI_NOT_CONFIGURED",
    [
      "Photo check not switched on",
      "Analyse de photo non activée",
      "فحص الصور غير مفعّل",
      "فحص الصور ما مفعلش",
    ],
    [
      "The photo check is not set up on this server yet.",
      "L'analyse de photo n'est pas encore configurée sur ce serveur.",
      "لم يُعدّ فحص الصور على هذا الخادم بعد.",
      "خدمة فحص الصور ما تجهزاتش باقي فهاد الخادم.",
    ],
  ],
  [
    "AI_DAILY_LIMIT",
    [
      "Daily photo-check limit reached",
      "Limite quotidienne d'analyses de photos atteinte",
      "تم بلوغ الحد اليومي لفحص الصور",
      "فحص الصور وصل للحد اليومي",
    ],
    [
      "The photo check has reached its daily limit. Try again tomorrow.",
      "L'analyse de photo a atteint sa limite quotidienne. Réessayez demain.",
      "بلغ فحص الصور حده اليومي. حاول غداً.",
      "خدمة فحص الصور وصلات للحد ديال اليوم. عاود جرب غدا.",
    ],
  ],
  [
    "AI_UNAVAILABLE",
    [
      "Photo check unavailable",
      "Analyse de photo indisponible",
      "فحص الصور غير متاح",
      "فحص الصور ما متوفرش",
    ],
    [
      "The photo-check provider could not be reached or cannot be used for this crop. Try again later.",
      "Le fournisseur de l'analyse de photo n'est pas joignable ou ne peut pas être utilisé pour cette culture. Réessayez plus tard.",
      "تعذّر الوصول إلى مزوّد فحص الصور أو لا يمكن استخدامه لهذا المحصول. حاول لاحقاً.",
      "ما قدرناش نتاصلو بمزود فحص الصور، ولا الخدمة ما يمكنش تستعمل لهاد الزراعة. عاود جرب من بعد.",
    ],
  ],
  [
    "AI_BUSY",
    [
      "Photo check busy",
      "Service d'analyse de photos occupé",
      "فحص الصور مشغول",
      "خدمة فحص الصور مشغولة",
    ],
    [
      "The photo check is handling too many requests. Try again in a moment.",
      "L'analyse de photo traite trop de demandes. Réessayez dans un instant.",
      "يعالج فحص الصور طلبات كثيرة. حاول بعد قليل.",
      "خدمة فحص الصور عندها طلبات كثر من اللي تقدر تعالج دابا. عاود جرب من بعد شوية.",
    ],
  ],
  [
    "AI_DECLINED",
    [
      "Photo could not be assessed",
      "Photo non évaluable",
      "تعذّر تقييم الصورة",
      "ما قدرناش نقيّمو الصورة",
    ],
    [
      "The photo check could not give an answer for this photo, for example because the image was not clear enough.",
      "L'analyse de photo n'a pas pu répondre pour cette photo, par exemple parce que l'image n'était pas assez nette.",
      "تعذّر على فحص الصور إعطاء إجابة لهذه الصورة، مثلاً لأنها غير واضحة بما يكفي.",
      "خدمة فحص الصور ما قدراتش تعطي جواب على هاد الصورة، مثلا حيث الصورة ما واضحةش كفاية.",
    ],
  ],
  [
    "AI_REQUEST_REJECTED",
    [
      "Photo request rejected",
      "Demande d'analyse de photo rejetée",
      "رُفض طلب فحص الصورة",
      "طلب فحص الصورة ترفض",
    ],
    [
      "The photo-check provider rejected the request. This is a fault on our side.",
      "Le fournisseur de l'analyse de photo a rejeté la demande. C'est un défaut de notre côté.",
      "رفض مزوّد فحص الصور الطلب. هذا خلل من جانبنا.",
      "مزود فحص الصور رفض الطلب. هادا خلل من عندنا.",
    ],
  ],
  [
    "CROP_NOT_COVERED",
    [
      "Crop not covered by the photo check",
      "Culture non couverte par l'analyse de photos",
      "المحصول غير مشمول بفحص الصور",
      "فحص الصور ما كيغطيش هاد الزراعة",
    ],
    [
      "The catalog has no pests or diseases recorded for this crop, so the photo check has nothing to compare with.",
      "Le catalogue ne recense aucun ravageur ni maladie pour cette culture : l'analyse n'a rien à comparer.",
      "لا توجد في دليل المحاصيل آفات أو أمراض مسجلة لهذا المحصول، فلا شيء يقارنه به فحص الصور.",
      "الدليل ما فيه حتى مرض ولا آفة مسجلة لهاد الزراعة. داكشي علاش فحص الصور ما عندوش باش يقارن.",
    ],
  ],
  [
    "EXPLANATION_CHECK_FAILED",
    [
      "Explanation failed its check",
      "L'explication n'a pas passé le contrôle",
      "فشل التحقق من الشرح",
      "الشرح ما دازش من الفحص",
    ],
    [
      "The generated explanation did not match the plan's facts, so it was not shown.",
      "L'explication générée ne correspondait pas aux faits du plan : elle n'a pas été affichée.",
      "لم يطابق الشرح المولَّد حقائق الخطة فلم يُعرض.",
      "الشرح اللي تولد ما توافقش مع الحقائق ديال الخطة، وداكشي علاش ما عرضناهش.",
    ],
  ],
  [
    "NOT_READY",
    [
      "Plan not finished yet",
      "Plan pas encore terminé",
      "الخطة لم تنتهِ بعد",
      "الخطة ما سالاتش باقي",
    ],
    [
      "The plan has no result yet, so it cannot be explained. Wait until it is complete.",
      "Le plan n'a pas encore de résultat : il ne peut pas être expliqué. Attendez qu'il soit terminé.",
      "ليست للخطة نتيجة بعد، فلا يمكن شرحها. انتظر حتى تكتمل.",
      "الخطة ما عندها حتى نتيجة باقي، وداكشي علاش ما نقدرش نشرحوها. تسنى حتى تكمل.",
    ],
  ],
  [
    "PHOTO_INVALID",
    [
      "Photo not valid",
      "Photo non valide",
      "الصورة غير صالحة",
      "الصورة ما صالحةش",
    ],
    [
      "The file is not a supported image (JPEG, PNG or WebP).",
      "Le fichier n'est pas une image prise en charge (JPEG, PNG ou WebP).",
      "الملف ليس صورة مدعومة (JPEG أو PNG أو WebP).",
      "الملف ماشي صورة من الأنواع اللي كنقبلو: JPEG ولا PNG ولا WebP.",
    ],
  ],
  [
    "PHOTO_TOO_LARGE",
    [
      "Photo too large",
      "Photo trop volumineuse",
      "الصورة كبيرة جداً",
      "حجم الصورة كبير بزاف",
    ],
    [
      "The photo is bigger than the allowed size. Use a smaller image.",
      "La photo dépasse la taille autorisée. Utilisez une image plus petite.",
      "الصورة أكبر من الحجم المسموح. استخدم صورة أصغر.",
      "حجم الصورة كثر من المسموح به. استعمل صورة بحجم أصغر.",
    ],
  ],
  [
    "PHOTO_TOO_SMALL",
    [
      "Photo too small",
      "Photo trop petite",
      "الصورة صغيرة جداً",
      "الصورة صغيرة بزاف",
    ],
    [
      "The photo is too small to show the plant clearly. Take a closer, larger picture.",
      "La photo est trop petite pour montrer clairement la plante. Prenez une photo plus proche et plus grande.",
      "الصورة صغيرة جداً ولا تُظهر النبات بوضوح. التقط صورة أقرب وأكبر.",
      "الصورة صغيرة بزاف وما كتبينش النبتة مزيان. صور من قريب بصورة أكبر.",
    ],
  ],
  [
    "PHOTO_UNREADABLE",
    [
      "Photo could not be read",
      "Photo illisible",
      "تعذّرت قراءة الصورة",
      "ما قدرناش نقراو الصورة",
    ],
    [
      "The image file is damaged or cannot be decoded. Try another photo.",
      "Le fichier image est endommagé ou ne peut pas être décodé. Essayez une autre photo.",
      "ملف الصورة تالف أو لا يمكن فك ترميزه. جرّب صورة أخرى.",
      "ملف الصورة خاسر ولا ما قدرناش نفكو الترميز ديالو. جرب صورة أخرى.",
    ],
  ],
  [
    "INVALID_WEATHER_REQUEST",
    [
      "Invalid weather request",
      "Demande météo invalide",
      "طلب طقس غير صالح",
      "طلب الطقس ما صالحش",
    ],
    [
      "The location or dates asked for are not valid for the weather service.",
      "L'emplacement ou les dates demandés ne sont pas valides pour le service météo.",
      "الموقع أو التواريخ المطلوبة غير صالحة لخدمة الطقس.",
      "البلاصة ولا التواريخ اللي طلبتي ما صالحينش لخدمة الطقس.",
    ],
  ],
  [
    "WEATHER_BUSY",
    [
      "Weather service busy",
      "Service météo occupé",
      "خدمة الطقس مشغولة",
      "خدمة الطقس مشغولة",
    ],
    [
      "The weather service is busy. Try again in a moment.",
      "Le service météo est occupé. Réessayez dans un instant.",
      "خدمة الطقس مشغولة. حاول بعد قليل.",
      "خدمة الطقس مشغولة دابا. عاود جرب من بعد شوية.",
    ],
  ],
  [
    "WEATHER_TIMEOUT",
    [
      "Weather source too slow",
      "Source météo trop lente",
      "مصدر الطقس بطيء",
      "مصدر الطقس تأخر",
    ],
    [
      "The weather source did not answer in time. Try again later.",
      "La source météo n'a pas répondu à temps. Réessayez plus tard.",
      "لم يجب مصدر الطقس في الوقت المناسب. حاول لاحقاً.",
      "مصدر بيانات الطقس ما جاوبش فالوقت المطلوب. عاود جرب من بعد.",
    ],
  ],
  [
    "WEATHER_UPSTREAM_INVALID",
    [
      "Weather source sent bad data",
      "La source météo a envoyé des données invalides",
      "أرسل مصدر الطقس بيانات غير صالحة",
      "مصدر الطقس صيفط بيانات ما صالحةش",
    ],
    [
      "The weather source answered with data that failed checks, so it was not used.",
      "La source météo a répondu avec des données qui ont échoué aux contrôles : elles n'ont pas été utilisées.",
      "ردّ مصدر الطقس ببيانات فشلت في الفحوص فلم تُستخدم.",
      "مصدر بيانات الطقس جاوب ببيانات ما دازتش من الفحوص، وداكشي علاش ما استعملناهاش.",
    ],
  ],
  [
    "WEATHER_UPSTREAM_UNAVAILABLE",
    [
      "Weather source unavailable",
      "Source météo indisponible",
      "مصدر الطقس غير متاح",
      "مصدر الطقس ما متوفرش",
    ],
    [
      "The weather source could not be reached. Try again later.",
      "La source météo n'a pas pu être jointe. Réessayez plus tard.",
      "تعذّر الوصول إلى مصدر الطقس. حاول لاحقاً.",
      "ما قدرناش نتاصلو بمصدر بيانات الطقس. عاود جرب من بعد.",
    ],
  ],
  [
    "WEATHER_STORAGE_UNAVAILABLE",
    [
      "Weather storage unavailable",
      "Stockage météo indisponible",
      "تخزين بيانات الطقس غير متاح",
      "تخزين بيانات الطقس ما متوفرش",
    ],
    [
      "Weather data could not be saved or read right now. Try again later.",
      "Les données météo n'ont pas pu être enregistrées ou lues pour le moment. Réessayez plus tard.",
      "تعذّر حفظ بيانات الطقس أو قراءتها الآن. حاول لاحقاً.",
      "ما قدرناش نحفظو ولا نقراو بيانات الطقس دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "WEATHER_CANCELLED",
    [
      "Weather request cancelled",
      "Demande météo annulée",
      "أُلغي طلب الطقس",
      "طلب الطقس تلغى",
    ],
    [
      "The weather request was cancelled before it finished.",
      "La demande météo a été annulée avant la fin.",
      "أُلغي طلب الطقس قبل أن ينتهي.",
      "طلب بيانات الطقس تلغى قبل ما يكمل الخدمة ديالو.",
    ],
  ],
  [
    "OBSERVATIONS_NOT_CONFIGURED",
    [
      "Satellite data not switched on",
      "Données satellite non activées",
      "بيانات الأقمار غير مفعّلة",
      "طلبات بيانات الأقمار ما مفعلينش",
    ],
    [
      "This server has no NASA Earthdata account set up, so satellite requests cannot be made.",
      "Ce serveur n'a pas de compte NASA Earthdata configuré : les demandes de données satellite sont impossibles.",
      "ليس لهذا الخادم حساب ناسا Earthdata مُعدّ، لذلك لا يمكن تقديم طلبات بيانات الأقمار.",
      "هاد الخادم ما فيهش حساب ناسا Earthdata مجهز. داكشي علاش ما يمكنش نطلبو بيانات الأقمار.",
    ],
  ],
  [
    "OBSERVATION_AUTH_FAILED",
    [
      "NASA sign-in refused",
      "Connexion à la NASA refusée",
      "رفضت ناسا تسجيل الدخول",
      "ناسا رفضات الدخول",
    ],
    [
      "NASA refused the server's sign-in. The administrator must check the Earthdata account.",
      "La NASA a refusé la connexion du serveur. L'administrateur doit vérifier le compte Earthdata.",
      "رفضت ناسا تسجيل دخول الخادم. على المسؤول فحص حساب Earthdata.",
      "ناسا رفضات الدخول ديال الخادم. المسؤول خاصو يتأكد من حساب Earthdata.",
    ],
  ],
  [
    "OBSERVATION_UPSTREAM_UNAVAILABLE",
    [
      "NASA service unavailable",
      "Service NASA indisponible",
      "خدمة ناسا غير متاحة",
      "خدمة ناسا ما متوفراش",
    ],
    [
      "The NASA data service could not be reached. Try again later.",
      "Le service de données de la NASA n'a pas pu être joint. Réessayez plus tard.",
      "تعذّر الوصول إلى خدمة بيانات ناسا. حاول لاحقاً.",
      "ما قدرناش نتاصلو بخدمة بيانات ناسا. عاود جرب من بعد.",
    ],
  ],
  [
    "OBSERVATION_UPSTREAM_INVALID",
    [
      "NASA sent unexpected data",
      "La NASA a envoyé des données inattendues",
      "أرسلت ناسا بيانات غير متوقعة",
      "ناسا صيفطات بيانات ما متوقعةش",
    ],
    [
      "The NASA service answered in a form that failed checks, so the data was not used.",
      "Le service de la NASA a répondu sous une forme qui a échoué aux contrôles : les données n'ont pas été utilisées.",
      "ردّت خدمة ناسا بشكل فشل في الفحوص فلم تُستخدم البيانات.",
      "خدمة ناسا جاوبات بصيغة ما دازتش من الفحوص. داكشي علاش ما استعملناش البيانات.",
    ],
  ],
  [
    "OBSERVATION_CANCELLED",
    [
      "Satellite request cancelled",
      "Demande satellite annulée",
      "أُلغي طلب الأقمار",
      "طلب بيانات الأقمار تلغى",
    ],
    [
      "The satellite data request was cancelled before it finished.",
      "La demande de données satellite a été annulée avant la fin.",
      "أُلغي طلب بيانات الأقمار قبل أن ينتهي.",
      "طلب بيانات الأقمار تلغى قبل ما يكمل الخدمة ديالو.",
    ],
  ],
  [
    "SCENARIO_UPSTREAM_UNAVAILABLE",
    [
      "Climate projections unavailable",
      "Projections climatiques indisponibles",
      "الإسقاطات المناخية غير متوفرة",
      "معطيات المناخ الجاي ما متوفراش",
    ],
    [
      "The future-climate data source could not be reached. Try again later.",
      "La source des données de climat futur n'a pas pu être jointe. Réessayez plus tard.",
      "تعذّر الوصول إلى مصدر بيانات المناخ المستقبلي. حاول لاحقاً.",
      "ما قدرناش نتاصلو بمصدر بيانات المناخ الجاي. عاود جرب من بعد.",
    ],
  ],
  [
    "SCENARIO_UPSTREAM_INVALID",
    [
      "Climate projections invalid",
      "Projections climatiques invalides",
      "الإسقاطات المناخية غير صالحة",
      "معطيات المناخ الجاي ما صالحةش",
    ],
    [
      "The future-climate source answered with data that failed checks, so it was not used.",
      "La source de climat futur a répondu avec des données qui ont échoué aux contrôles : elles n'ont pas été utilisées.",
      "ردّ مصدر المناخ المستقبلي ببيانات فشلت في الفحوص فلم تُستخدم.",
      "مصدر بيانات المناخ الجاي جاوب ببيانات ما دازتش من الفحوص. داكشي علاش ما استعملناهاش.",
    ],
  ],
  [
    "SCENARIO_STORAGE_UNAVAILABLE",
    [
      "Climate storage unavailable",
      "Stockage climatique indisponible",
      "تخزين بيانات المناخ غير متاح",
      "تخزين بيانات المناخ ما متوفرش",
    ],
    [
      "Future-climate data could not be saved or read right now. Try again later.",
      "Les données de climat futur n'ont pas pu être enregistrées ou lues pour le moment. Réessayez plus tard.",
      "تعذّر حفظ بيانات المناخ المستقبلي أو قراءتها الآن. حاول لاحقاً.",
      "ما قدرناش نحفظو ولا نقراو بيانات المناخ الجاي دابا. عاود جرب من بعد.",
    ],
  ],
  [
    "SCENARIO_CANCELLED",
    [
      "Climate request cancelled",
      "Demande climatique annulée",
      "أُلغي طلب المناخ",
      "طلب المناخ تلغى",
    ],
    [
      "The future-climate request was cancelled before it finished.",
      "La demande de climat futur a été annulée avant la fin.",
      "أُلغي طلب المناخ المستقبلي قبل أن ينتهي.",
      "طلب بيانات المناخ الجاي تلغى قبل ما يكمل الخدمة ديالو.",
    ],
  ],
  [
    "FIELD_TOO_LARGE_FOR_TERRAIN",
    [
      "Field too large for the terrain check",
      "Parcelle trop grande pour l'analyse du relief",
      "الحقل أكبر من أن تُحلَّل تضاريسه دفعة واحدة",
      "القطعة كبيرة بزاف على فحص التضاريس",
    ],
    [
      "The saved outline covers more ground than the terrain analysis can sample at once.",
      "Le contour enregistré couvre plus de terrain que l'analyse du relief ne peut en échantillonner d'un coup.",
      "يغطي المحيط المحفوظ مساحة أكبر مما يستطيع تحليل التضاريس أخذ عينات منه دفعة واحدة.",
      "الحدود المحفوظة كتغطي مساحة أكبر من اللي تحليل التضاريس يقدر ياخد منها عينات فمرة وحدة.",
    ],
  ],
  [
    "NO_CLEAN_PIXEL",
    [
      "No clear satellite pixel",
      "Aucun pixel satellite exploitable",
      "لا توجد بكسلات صالحة للاستعمال",
      "ما كاين حتى بكسل صالح",
    ],
    [
      "None of the satellite pixels inside the field were usable (for example because of clouds or water), so no summary was made.",
      "Aucun des pixels satellite de la parcelle n'était exploitable (nuages ou eau, par exemple) : aucun résumé n'a été fait.",
      "لم يصلح أي بكسل أقمار داخل الحقل (بسبب الغيوم أو الماء مثلاً) فلم يُنشأ ملخص.",
      "حتى بكسل من صور الأقمار داخل القطعة ما كان صالح للاستعمال، مثلا بسبب السحاب ولا الما. داكشي علاش ما خرجنا حتى ملخص.",
    ],
  ],
]);
