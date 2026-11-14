import { rows } from "./types.js";

export const fieldSuggestionTerms = rows("reason_code", [
  [
    "SUGGESTED_OUTLINE_CHECK_IT",
    [
      "Check this outline",
      "Vérifiez ce contour",
      "تحقّق من هذا المخطط",
      "تأكّد من هاد الحدود",
    ],
    [
      "This is a suggested field outline. Check and edit it before saving.",
      "Ce contour est une proposition. Vérifiez-le et corrigez-le avant de l'enregistrer.",
      "هذا مخطط مقترح للحقل. تحقّق منه وعدّله قبل الحفظ.",
      "هادي غير حدود مقترحة للحقل. تأكّد منها وصلّحها قبل ما تسجّلها.",
    ],
  ],
  [
    "FIELD_BOUNDARY_ACCURACY_UNMEASURED",
    [
      "Accuracy not measured",
      "Précision non mesurée",
      "الدقة غير مقاسة",
      "الدقة ما تقاساتش",
    ],
    [
      "Boundary accuracy on Moroccan fields has not been measured.",
      "La précision des contours sur les parcelles marocaines n'a pas été mesurée.",
      "لم تُقَس دقة هذه الحدود في الحقول المغربية.",
      "دقة هاد الحدود فالحقول المغربية ما تقاساتش.",
    ],
  ],
  [
    "FIELD_BOUNDARY_NOT_LEGAL_PARCEL",
    [
      "Not a cadastral boundary",
      "Ce n'est pas une limite cadastrale",
      "ليست حدوداً عقارية رسمية",
      "ماشي حدود عقارية رسمية",
    ],
    [
      "This outline comes from satellite interpretation. It does not establish ownership or legal parcel limits.",
      "Ce contour provient de l'interprétation d'images satellites. Il ne prouve ni la propriété ni les limites foncières.",
      "هذا المخطط مستمد من تفسير صور الأقمار الصناعية، ولا يثبت الملكية أو الحدود العقارية.",
      "هاد الحدود جاية من تفسير صور الأقمار الصناعية. ما كتثبتش الملكية ولا الحدود القانونية.",
    ],
  ],
  [
    "FIELD_BOUNDARY_MAY_MERGE_SPLIT_OR_MISS",
    [
      "Fields may be missed or mixed",
      "Des parcelles peuvent être omises ou confondues",
      "قد تُغفل الحقول أو تُخلط حدودها",
      "ممكن شي حقول ما تبانش ولا تتخلط حدودها",
    ],
    [
      "Suggestions may merge neighbours, split one field, or miss fields. Use a manual outline when needed.",
      "Les propositions peuvent réunir des parcelles voisines, diviser une parcelle ou en omettre. Tracez un contour manuel si nécessaire.",
      "قد يدمج المخطط حقولاً متجاورة أو يقسّم حقلاً واحداً أو يُغفل بعض الحقول. ارسم الحدود يدوياً عند الحاجة.",
      "الحدود المقترحة ممكن تجمع حقول حدّ بعضياتها، ولا تقسّم حقل واحد، ولا ما تبيّنوش. رسم الحدود بيدك إلا احتجتي.",
    ],
  ],
  [
    "FIELD_BOUNDARY_CONFIDENCE_IS_REGIONAL",
    [
      "Regional confidence only",
      "Confiance régionale seulement",
      "الثقة تخص المنطقة فقط",
      "الثقة كتخص المنطقة فقط",
    ],
    [
      "Confidence comes from a 500 metre source cell. It is not the probability that this outline is correct. An absent value means unknown.",
      "La confiance provient d'une cellule source de 500 mètres. Elle n'est pas la probabilité que ce contour soit correct. Une valeur absente signifie qu'elle est inconnue.",
      "تستند الثقة إلى خلية مصدر بطول 500 متر، وليست احتمال صحة حدود هذا الحقل. غياب القيمة يعني أنها غير معروفة.",
      "الثقة جاية من خانة ديال المصدر بطول 500 متر. ماشي نسبة صحة هاد الحدود. إلا ما كانتش القيمة راه ما معروفةش.",
    ],
  ],
]);
