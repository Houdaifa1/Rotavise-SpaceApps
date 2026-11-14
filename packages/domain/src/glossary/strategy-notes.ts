import { rows } from "./types.js";

// Keys of the notes attached to each rotation strategy (engine 7). The
// interface shows these translations instead of the English default text.
export const strategyNoteCodes = rows("strategy_note", [
  [
    "WHY_RANKED_BY_PRIORITIES",
    ["Why this rank", "Pourquoi ce rang", "سبب هذه الرتبة", "علاش هاد الرتبة"],
    [
      "The rotation's position among all rotations compared, using your four priority sliders. A lower weighted loss is better.",
      "La position de la rotation parmi toutes celles comparées, selon vos quatre curseurs de priorité. Une perte pondérée plus faible est meilleure.",
      "موقع الدورة الزراعية بين جميع الدورات المقارَنة، بحسب درجات الأهمية التي حددتها لأولوياتك الأربع. كلما انخفضت الخسارة الموزونة كانت النتيجة أفضل.",
      "هاد الرتبة هي بلاصة الدورة بين جميع الدورات اللي تقارنو، على حساب الأولويات الأربعة اللي حددتي. الخسارة الموزونة إلا كانت أقل كتكون أحسن.",
    ],
  ],
  [
    "WHY_LOWER_LOSS_THAN_CURRENT",
    [
      "Better than your current rotation",
      "Meilleure que votre rotation actuelle",
      "أفضل من دورتك الزراعية الحالية",
      "أحسن من الدورة الحالية ديالك",
    ],
    [
      "This alternative is suggested because its weighted loss is lower than that of your current rotation.",
      "Cette alternative est proposée car sa perte pondérée est inférieure à celle de votre rotation actuelle.",
      "يُقترح هذا البديل لأن خسارته الموزونة أقل من خسارة دورتك الزراعية الحالية.",
      "كنقترحو هاد البديل حيث الخسارة الموزونة ديالو أقل من ديال الدورة الحالية ديالك.",
    ],
  ],
  [
    "WHY_NOT_BETTER_THAN_CURRENT",
    [
      "Not better than your current rotation",
      "Pas meilleure que votre rotation actuelle",
      "ليس أفضل من دورتك الزراعية الحالية",
      "ماشي أحسن من الدورة الحالية ديالك",
    ],
    [
      "This option is shown as a different possibility, but on your priorities it does not beat your current rotation.",
      "Cette option est montrée comme une autre possibilité, mais selon vos priorités elle ne fait pas mieux que votre rotation actuelle.",
      "يُعرض هذا الخيار كاحتمال مختلف، لكنه لا يتفوق على دورتك الزراعية الحالية وفق أولوياتك.",
      "هاد الاختيار باين كإمكانية أخرى، ولكن على حساب الأولويات ديالك ما كيتفوقش على الدورة الحالية ديالك.",
    ],
  ],
  [
    "WHY_BEST_ON_DIMENSION",
    [
      "Best on one criterion",
      "Meilleure sur un critère",
      "الأفضل في معيار واحد",
      "الأحسن فواحد المعيار",
    ],
    [
      "Of the strategies shown, this one has the lowest loss on the named criterion (climate, water, soil health or crop health).",
      "Parmi les stratégies affichées, celle-ci a la perte la plus faible sur le critère indiqué (climat, eau, santé du sol ou santé des cultures).",
      "بين الاستراتيجيات المعروضة، لهذه الاستراتيجية أقل خسارة في المعيار المذكور (المناخ أو الماء أو صحة التربة أو صحة المحاصيل).",
      "من بين الاستراتيجيات اللي باينين، هادي عندها أقل خسارة فالمعيار المذكور: المناخ، الما، صحة التربة ولا صحة الزراعات.",
    ],
  ],
  [
    "PRIORITIES_SLIDERS_USED",
    [
      "Your four sliders were used",
      "Vos quatre curseurs ont été utilisés",
      "استُخدمت أولوياتك الأربع",
      "استعملنا الأولويات الأربعة ديالك",
    ],
    [
      "Rotations are ranked with your climate, water, soil-health and crop-health sliders. A criterion without evidence is left out and the others share its weight.",
      "Les rotations sont classées avec vos curseurs climat, eau, santé du sol et santé des cultures. Un critère sans données est écarté et les autres se partagent son poids.",
      "تُرتَّب الدورات الزراعية بحسب درجات الأهمية التي حددتها للمناخ والماء وصحة التربة وصحة المحاصيل. يُستبعد المعيار الذي لا تتوفر له أدلة، وتُوزَّع أهميته على المعايير الأخرى.",
      "الدورات كيترتبو على حساب الأهمية اللي عطيتي للمناخ والما وصحة التربة وصحة الزراعات. المعيار اللي ما عندوش معلومات موثقة كيتحيد، ووزنو كيتقسم على لخرين.",
    ],
  ],
  [
    "PRIORITIES_CONTEXT_NOT_RANKED",
    [
      "Your context does not change the rank",
      "Votre contexte ne change pas le rang",
      "معلومات وضعك لا تغيّر الترتيب",
      "هاد المعلومات ما كتبدلش الترتيب",
    ],
    [
      "Your answers about equipment, market, forage and erosion do not change the ranking. They only decide which benefits and gaps are spelled out.",
      "Vos réponses sur le matériel, le marché, le fourrage et l'érosion ne changent pas le classement. Elles décident seulement des avantages et lacunes détaillés.",
      "إجاباتك عن المعدات والسوق والعلف والتعرية لا تغيّر الترتيب؛ فهي تحدد فقط الفوائد والثغرات التي تُذكر بالتفصيل.",
      "الأجوبة ديالك على المعدات والسوق والعلف والتعرية ما كتبدلش الترتيب. غير كتحدد الفوائد والنواقص اللي كنشرحو ليك.",
    ],
  ],
  [
    "EVIDENCE_RULE_SOURCES",
    [
      "Where the crop rules come from",
      "D'où viennent les règles des cultures",
      "مصدر قواعد المحاصيل",
      "منين جاو قواعد الزراعات",
    ],
    [
      "How many crop rules were used and how well each was checked: double-checked, expert-reviewed, only extracted, or recalled by an AI model.",
      "Le nombre de règles de culture utilisées et leur niveau de vérification : vérifiées une seconde fois, relues par un expert, simplement extraites d'une source ou écrites de mémoire par un modèle d'IA.",
      "عدد قواعد المحاصيل المستخدمة ومستوى التحقق منها: تدقيق ثانٍ، أو مراجعة خبير، أو استخراج من مصدر فقط، أو معلومات من ذاكرة نموذج ذكاء اصطناعي.",
      "شحال من قاعدة استعملنا، وكيفاش تأكدات كل وحدة: تدقيق ثاني، مراجعة خبير، غير تخرجات من مصدر، ولا كتبها نموذج ذكاء اصطناعي من الذاكرة ديالو.",
    ],
  ],
  [
    "EVIDENCE_WEATHER",
    [
      "Weather data used",
      "Données météo utilisées",
      "بيانات الطقس المستخدمة",
      "بيانات الطقس اللي استعملنا",
    ],
    [
      "The weather behind the result is NASA POWER daily data, with rain corrected using NASA GPM IMERG satellite rain when that was available.",
      "La météo derrière le résultat provient des données quotidiennes NASA POWER, avec la pluie corrigée par les pluies satellitaires NASA GPM IMERG lorsqu'elles étaient disponibles.",
      "تعتمد النتيجة على بيانات الطقس اليومية من ناسا POWER، مع تصحيح كميات الأمطار بتقديرات الأقمار الاصطناعية من ناسا GPM IMERG عند توفرها.",
      "النتيجة كتستعمل بيانات الطقس اليومية من ناسا POWER. إلا توفرت تقديرات الشتا من أقمار ناسا GPM IMERG، كنستعملوها باش نصححو كميات الشتا.",
    ],
  ],
  [
    "EVIDENCE_FUTURE_CLIMATE",
    [
      "Future climate comparison",
      "Comparaison avec le climat futur",
      "المقارنة مع المناخ المستقبلي",
      "المقارنة مع المناخ الجاي",
    ],
    [
      "How the rotation's climate loss changes under NASA NEX-GDDP-CMIP6 future scenarios from five climate models. A positive change means worse.",
      "Comment la perte climatique de la rotation change selon les scénarios futurs NASA NEX-GDDP-CMIP6 issus de cinq modèles climatiques. Un changement positif signifie une dégradation.",
      "كيف تتغير الخسارة المناخية للدورة الزراعية في سيناريوهات المناخ المستقبلي من ناسا NEX-GDDP-CMIP6، باستخدام خمسة نماذج مناخية. التغير الموجب يعني تدهور النتيجة.",
      "كيفاش كتبدل الخسارة المناخية ديال الدورة فسيناريوهات ناسا NEX-GDDP-CMIP6 بخمسة نماذج مناخية. التغيير إلا كان موجب كيعني النتيجة ولات أسوأ.",
    ],
  ],
  [
    "EVIDENCE_BARE_FIELD_SHARE",
    [
      "Time with no crop",
      "Temps sans culture",
      "المدة بلا محصول",
      "المدة اللي القطعة فيها بلا زراعة",
    ],
    [
      "The share of the planning period when, by the crop calendar, the field has no crop. It comes from sowing and harvest windows, not from satellite images.",
      "La part de la période planifiée pendant laquelle, selon le calendrier cultural, la parcelle n'a pas de culture. Elle vient des périodes de semis et de récolte, pas d'images satellite.",
      "نسبة فترة التخطيط التي يخلو فيها الحقل من محصول بحسب التقويم الزراعي. وهي مأخوذة من فترات الزرع والحصاد لا من صور الأقمار.",
      "النسبة من مدة التخطيط اللي القطعة كتبقى فيها بلا زراعة، على حساب تواريخ الزرع والحصاد. هاد المعلومة ما جاياش من صور الأقمار.",
    ],
  ],
  [
    "BENEFIT_NITROGEN_FIXING_CROP",
    [
      "Includes a nitrogen-fixing crop",
      "Inclut une culture fixatrice d'azote",
      "تتضمن محصولاً يثبّت الآزوت",
      "فيها زراعة كتثبت الآزوت",
    ],
    [
      "The rotation includes a legume (family Fabaceae), which can fix nitrogen. The family comes from the catalog; amounts of nitrogen are not modelled.",
      "La rotation inclut une légumineuse (famille des Fabacées), capable de fixer l'azote. La famille vient du catalogue ; les quantités d'azote ne sont pas modélisées.",
      "تتضمن الدورة الزراعية محصولاً من البقوليات (فصيلة Fabaceae) يمكنه تثبيت الآزوت. الفصيلة مأخوذة من دليل المحاصيل، ولا تُحسب كميات الآزوت بالنماذج.",
      "الدورة فيها زراعة من البقوليات، من فصيلة Fabaceae، تقدر تثبت الآزوت. الفصيلة جاية من الدليل، ولكن كميات الآزوت ما كيتحسبوش بالنماذج.",
    ],
  ],
  [
    "BENEFIT_MORE_CROP_FAMILIES",
    [
      "More crop families",
      "Plus de familles de cultures",
      "فصائل محاصيل أكثر",
      "فصائل نباتية كثر",
    ],
    [
      "The rotation uses more botanical families than your current one, which spreads pest and disease pressure.",
      "La rotation utilise plus de familles botaniques que l'actuelle, ce qui répartit la pression des ravageurs et maladies.",
      "تتضمن الدورة الزراعية فصائل نباتية أكثر من دورتك الزراعية الحالية، مما يوزّع ضغط الآفات والأمراض.",
      "الدورة فيها فصائل نباتية كثر من الدورة الحالية ديالك. هاد التنويع كيوزع ضغط الأمراض والآفات بين زراعات مختلفة.",
    ],
  ],
  [
    "BENEFIT_FEWER_SAME_FAMILY_REPEATS",
    [
      "Fewer same-family repeats",
      "Moins de répétitions de la même famille",
      "تكرار أقل للفصيلة نفسها",
      "تكرار أقل لنفس الفصيلة",
    ],
    [
      "Fewer back-to-back crops of the same family than your current rotation, which helps break pest cycles.",
      "Moins de cultures successives de la même famille que dans votre rotation actuelle, ce qui aide à rompre les cycles des ravageurs.",
      "محاصيل متتالية أقل من الفصيلة نفسها مقارنة بدورتك الزراعية الحالية، مما يساعد على كسر دورات الآفات.",
      "الزراعات اللي كيجيو وحدة ورا وحدة من نفس الفصيلة أقل من الدورة الحالية ديالك. هادشي كيعاون يقطع دورة حياة الآفات.",
    ],
  ],
  [
    "BENEFIT_LOWER_WATER_LOSS",
    [
      "Lower water-stress loss",
      "Moindre perte par stress hydrique",
      "خسارة أقل من الإجهاد المائي",
      "خسارة أقل بسبب نقص الما",
    ],
    [
      "Lower water-stress loss than your current rotation, on the catalog's water-need classes.",
      "Perte par stress hydrique plus faible que votre rotation actuelle, selon les classes de besoin en eau du catalogue.",
      "خسارة إجهاد مائي أقل من دورتك الزراعية الحالية بحسب فئات احتياج الماء في دليل المحاصيل.",
      "الخسارة بسبب الإجهاد المائي أقل من الدورة الحالية ديالك، على حساب فئات احتياجات الما اللي فالدليل.",
    ],
  ],
  [
    "BENEFIT_LOWER_CLIMATE_LOSS",
    [
      "Lower climate loss",
      "Moindre perte climatique",
      "خسارة مناخية أقل",
      "خسارة مناخية أقل",
    ],
    [
      "Less heat and cold damage than your current rotation, measured against each crop's own sourced limits in past seasons.",
      "Moins de dégâts de chaleur et de froid que votre rotation actuelle, mesurés selon les limites sourcées propres à chaque culture lors de campagnes passées.",
      "ضرر حر وبرد أقل من دورتك الزراعية الحالية، مقيساً بالحدود الموثقة لكل محصول في مواسم سابقة.",
      "ضرر السخونية والبرد أقل من الدورة الحالية ديالك، على حساب الحدود الموثقة ديال كل زراعة فالمواسم اللي فاتو.",
    ],
  ],
  [
    "BENEFIT_BETTER_PREDECESSOR_FIT",
    [
      "Better previous-crop fit",
      "Meilleur enchaînement des précédents",
      "ملاءمة أفضل للمحصول السابق",
      "ترتيب الزراعات مناسب كثر",
    ],
    [
      "Its crop changes follow the catalog's preferred previous crops more often than your current rotation.",
      "Ses enchaînements de cultures respectent plus souvent les précédents préférés du catalogue que votre rotation actuelle.",
      "تراعي تعاقبات المحاصيل في هذه الدورة الزراعية المحاصيل السابقة المفضلة في دليل المحاصيل أكثر مما تراعيها دورتك الحالية.",
      "تتابع الزراعات فهاد الدورة كيحترم الزراعات المفضلة قبل كل زراعة، على حساب الدليل، كثر من الدورة الحالية ديالك.",
    ],
  ],
  [
    "BENEFIT_FEWER_HEALTH_WARNINGS",
    [
      "Fewer crop-health warnings",
      "Moins d'alertes sanitaires",
      "تحذيرات أقل بشأن صحة المحاصيل",
      "تنبيهات أقل على صحة الزراعات",
    ],
    [
      "Fewer waiting-period warnings about pests and diseases than your current rotation.",
      "Moins d'alertes de délai d'attente liées aux ravageurs et maladies que votre rotation actuelle.",
      "تحذيرات أقل بشأن فترات الانتظار المتعلقة بالآفات والأمراض مقارنة بدورتك الزراعية الحالية.",
      "كاينين تنبيهات أقل على مدة الانتظار بسبب الأمراض والآفات مقارنة مع الدورة الحالية ديالك.",
    ],
  ],
  [
    "BENEFIT_BETTER_UNDER_FUTURE_CLIMATE",
    [
      "Holds up better in the future climate",
      "Résiste mieux au climat futur",
      "أكثر صموداً في المناخ المستقبلي",
      "كتبقى أحسن مع المناخ الجاي",
    ],
    [
      "Under the future climate scenarios, this rotation's climate loss grows less than that of your current rotation.",
      "Selon les scénarios climatiques futurs, la perte climatique de cette rotation augmente moins que celle de votre rotation actuelle.",
      "في سيناريوهات المناخ المستقبلي، تزداد الخسارة المناخية لهذه الدورة الزراعية بمقدار أقل من الزيادة في دورتك الحالية.",
      "فسيناريوهات المناخ الجاي، الخسارة المناخية ديال هاد الدورة كتزاد بمقدار أقل من الزيادة ديال الدورة الحالية ديالك.",
    ],
  ],
  [
    "BENEFIT_FORAGE_CROP",
    [
      "Includes a forage crop",
      "Inclut une culture fourragère",
      "يتضمن محصولاً علفياً",
      "فيها زراعة علفية",
    ],
    [
      "The rotation includes a forage crop, useful for feeding livestock, shown because you said forage matters.",
      "La rotation inclut une culture fourragère, utile pour nourrir le bétail, signalée parce que vous avez indiqué que le fourrage compte.",
      "تتضمن الدورة الزراعية محصولاً علفياً مفيداً لتغذية المواشي، ويُذكر لأنك أشرت إلى أهمية العلف.",
      "الدورة فيها زراعة علفية كتصلح لماكلة الماشية. كنبيّنوها حيث قلتي بلي العلف مهم عندك.",
    ],
  ],
  [
    "GAP_DIMENSION_NOT_COMPARED",
    [
      "A criterion was not compared",
      "Un critère n'a pas été comparé",
      "لم يُقارَن معيار",
      "شي معيار ما تقارنش",
    ],
    [
      "One of the four criteria (climate, water, soil health, crop health) could not be compared for lack of evidence, so it did not influence the rank.",
      "L'un des quatre critères (climat, eau, santé du sol, santé des cultures) n'a pas pu être comparé faute de données : il n'a pas influencé le rang.",
      "تعذّرت مقارنة أحد المعايير الأربعة (المناخ، الماء، صحة التربة، صحة المحاصيل) لنقص الأدلة، فلم يؤثر في الرتبة.",
      "واحد من المعايير الأربعة، المناخ ولا الما ولا صحة التربة ولا صحة الزراعات، ما قدرناش نقارنوه بسبب نقص فالمعلومات الموثقة. ما دخلش فالترتيب.",
    ],
  ],
  [
    "GAP_FUTURE_CLIMATE_UNAVAILABLE",
    [
      "Future climate not compared",
      "Climat futur non comparé",
      "المناخ المستقبلي لم يُقارَن",
      "المناخ الجاي ما تقارنش",
    ],
    [
      "Future climate projections have not been prepared for this field's area yet.",
      "Les projections climatiques futures n'ont pas encore été préparées pour la zone de cette parcelle.",
      "لم تُعدَّ بعد الإسقاطات المناخية المستقبلية لمنطقة هذا الحقل.",
      "معطيات سيناريوهات المناخ الجاي ما تجهزاتش باقي للمنطقة اللي فيها هاد القطعة.",
    ],
  ],
  [
    "GAP_NO_MARKET_DATA",
    [
      "No market data",
      "Pas de données de marché",
      "لا توجد بيانات سوق",
      "معلومات السوق ما كايناش",
    ],
    [
      "The catalog has no prices or market information, so income and market suitability are not compared. Check local prices.",
      "Le catalogue n'a ni prix ni informations de marché : le revenu et l'adéquation au marché ne sont pas comparés. Vérifiez les prix locaux.",
      "لا يحتوي دليل المحاصيل على أسعار أو معلومات سوق، لذلك لا يُقارَن الدخل ولا ملاءمة السوق. تحقق من الأسعار المحلية.",
      "الدليل ما فيهش الأثمنة ولا معلومات السوق. ما كنقارنوش الدخل ولا واش الزراعة مناسبة للسوق. تأكد من الأثمنة فالمنطقة ديالك.",
    ],
  ],
  [
    "GAP_EROSION_NOT_ASSESSED",
    [
      "Erosion not assessed",
      "Érosion non évaluée",
      "التعرية غير مقيَّمة",
      "التعرية ما تقيّماتش",
    ],
    [
      "Erosion and water infiltration are not part of the ranking, because slope and terrain data are not used by the rotation engine yet. Ask a local adviser.",
      "L'érosion et l'infiltration de l'eau ne font pas partie du classement, car la pente et le relief ne sont pas encore utilisés par le moteur de rotation. Demandez conseil localement.",
      "لا تدخل التعرية وتسرّب الماء إلى داخل التربة في الترتيب، لأن حساب الدورة الزراعية لا يستخدم بعد بيانات الانحدار والتضاريس. استشر مرشداً فلاحياً محلياً.",
      "التعرية ودخول الما للتربة ما داخلينش فالترتيب، حيث حساب الدورة ما كيستعملش باقي بيانات الانحدار والتضاريس. سول مستشار فلاحي فالمنطقة.",
    ],
  ],
  [
    "GAP_NO_EQUIPMENT_DATA",
    [
      "No machinery data",
      "Pas de données sur le matériel",
      "لا توجد بيانات عن المعدات",
      "معلومات المعدات ما كايناش",
    ],
    [
      "The catalog has no machinery requirements, so equipment limits are not checked for these crops.",
      "Le catalogue n'a pas d'exigences de matériel : les limites d'équipement ne sont pas vérifiées pour ces cultures.",
      "لا تتوفر في دليل المحاصيل متطلبات المعدات، لذلك لا تُفحص حدود المعدات لهذه المحاصيل.",
      "الدليل ما فيهش شنو كتحتاج هاد الزراعات من معدات. داكشي علاش ما كنتحققوش من القيود ديال المعدات.",
    ],
  ],
  [
    "GAP_RECALLED_RULES",
    [
      "Some rules recalled by AI",
      "Certaines règles issues de la mémoire de l'IA",
      "بعض القواعد من ذاكرة الذكاء الاصطناعي",
      "شي قواعد جاية من ذاكرة الذكاء الاصطناعي",
    ],
    [
      "Some of the rules used were recalled by an AI model and have not been checked against a published source.",
      "Certaines règles utilisées ont été écrites de mémoire par un modèle d'IA et n'ont pas été vérifiées par rapport à une source publiée.",
      "كتب نموذج ذكاء اصطناعي بعض القواعد المستخدمة من ذاكرته، ولم يُتحقق من مطابقتها لمصدر منشور.",
      "شي قواعد اللي استعملنا كتبها نموذج ذكاء اصطناعي من الذاكرة ديالو، وما تقارناتش مع مصدر منشور.",
    ],
  ],
  [
    "RISK_LOCAL_REVIEW",
    [
      "Have it reviewed locally",
      "Faites-le relire localement",
      "اعرضه على مختص محلي",
      "خلي مختص فالمنطقة يراجعها",
    ],
    [
      "Have a local agronomist review this strategy before you act on it.",
      "Faites relire cette stratégie par un agronome local avant d'agir.",
      "اعرض هذه الاستراتيجية على مهندس زراعي محلي قبل العمل بها.",
      "قبل ما تطبق هاد الاستراتيجية، خلي مهندس فلاحي فالمنطقة ديالك يراجعها معاك.",
    ],
  ],
  [
    "RISK_RULE_CONDITIONS",
    [
      "Rule conditions to check locally",
      "Conditions de règles à vérifier localement",
      "شروط قواعد تُفحص محلياً",
      "شروط خاصك تتأكد منها فالقطعة",
    ],
    [
      "Some rules apply only under conditions Rotavise cannot check, or were not met. Check them on your field.",
      "Certaines règles ne valent que sous des conditions que Rotavise ne peut pas vérifier, ou qui n'étaient pas remplies. Vérifiez-les sur votre parcelle.",
      "تنطبق بعض القواعد بشروط لا تستطيع روتافيس فحصها أو لم تتحقق. افحصها في حقلك.",
      "شي قواعد ما كتنطبق غير بشروط ما يقدرش روتافيس يتحقق منها، ولا ما تحققاتش. تأكد من هاد الشروط فالقطعة ديالك.",
    ],
  ],
  [
    "RISK_RAINFED_ARID",
    [
      "Risky without irrigation here",
      "Risqué sans irrigation ici",
      "محفوف بالمخاطر دون ري هنا",
      "الزراعة بلا سقي فيها مخاطرة هنا",
    ],
    [
      "At this field's rainfall, growing the named crop without irrigation is very uncertain according to a source.",
      "Avec la pluviométrie de cette parcelle, cultiver la culture indiquée sans irrigation est très incertain selon une source.",
      "بحسب مصدر، فإن كمية الأمطار في هذا الحقل تجعل نجاح المحصول المذكور دون سقي غير مضمون بدرجة كبيرة.",
      "على حساب كمية الشتا فهاد القطعة، كاين مصدر كيحذر بلي نجاح هاد الزراعة بلا سقي ما مضمونش بدرجة كبيرة.",
    ],
  ],
  [
    "RISK_WORSE_UNDER_FUTURE_CLIMATE",
    [
      "Worse under the future climate",
      "Pire sous le climat futur",
      "أسوأ في المناخ المستقبلي",
      "أسوأ مع المناخ الجاي",
    ],
    [
      "The rotation's climate loss is higher under the future climate scenarios than in past seasons.",
      "La perte climatique de la rotation est plus élevée sous les scénarios climatiques futurs que lors des campagnes passées.",
      "الخسارة المناخية للدورة الزراعية أعلى في سيناريوهات المناخ المستقبلية منها في المواسم السابقة.",
      "الخسارة المناخية ديال الدورة أعلى فسيناريوهات المناخ الجاي مقارنة مع المواسم اللي فاتو.",
    ],
  ],
  [
    "REMINDER_SUPPORTS_NOT_REPLACES",
    [
      "A support, not a replacement",
      "Une aide, pas un remplacement",
      "دعم وليس بديلاً",
      "كيعاونك فالقرار وما كيعوضكش",
    ],
    [
      "Rotavise supports your own judgement and local agricultural expertise; it does not replace them.",
      "Rotavise appuie votre propre jugement et l'expertise agricole locale ; il ne les remplace pas.",
      "تدعم روتافيس حكمك الشخصي والخبرة الزراعية المحلية ولا تحل محلهما.",
      "روتافيس كيعاونك فالتقدير ديالك ومع الخبرة الفلاحية المحلية. ما كيعوض لا الحكم ديالك لا خبرة المختصين فالمنطقة.",
    ],
  ],
  [
    "REMINDER_LOCAL_REVIEW",
    [
      "Check with a local expert",
      "Vérifiez avec un expert local",
      "تحقق مع خبير محلي",
      "تأكد مع مختص فالمنطقة",
    ],
    [
      "Before changing your rotation, check the options with an agronomist or extension officer who knows your soil, water and market.",
      "Avant de changer votre rotation, vérifiez les options avec un agronome ou un conseiller agricole qui connaît votre sol, votre eau et votre marché.",
      "قبل تغيير دورتك الزراعية، تحقق من الخيارات مع مهندس زراعي أو مرشد يعرف تربتك ومياهك وسوقك.",
      "قبل ما تبدل الدورة الزراعية ديالك، راجع الاختيارات مع مهندس ولا مستشار فلاحي كيعرف التربة والما والسوق ديال المنطقة.",
    ],
  ],
  [
    "REMINDER_RULES_NOT_EXPERT_REVIEWED",
    [
      "Rules not expert-reviewed",
      "Règles non relues par un expert",
      "القواعد غير مراجَعة من خبير",
      "القواعد ما راجعهاش خبير",
    ],
    [
      "The crop rules have not been reviewed by an agricultural expert, and satellite and model data are estimates for your area, not measurements on your field.",
      "Les règles des cultures n'ont pas été relues par un expert agricole, et les données satellite et de modèle sont des estimations pour votre zone, pas des mesures sur votre parcelle.",
      "لم يراجع خبير زراعي قواعد المحاصيل، وبيانات الأقمار والنماذج تقديرات لمنطقتك لا قياسات في حقلك.",
      "قواعد الزراعات ما راجعهاش خبير فلاحي. بيانات الأقمار والنماذج غير تقديرات للمنطقة ديالك، ماشي قياسات من القطعة ديالك.",
    ],
  ],
  [
    "REMINDER_AI_RECALL",
    [
      "Some rules recalled by AI",
      "Certaines règles issues de la mémoire de l'IA",
      "بعض القواعد من ذاكرة الذكاء الاصطناعي",
      "شي قواعد جاية من ذاكرة الذكاء الاصطناعي",
    ],
    [
      "Some crop rules were recalled by an AI model and have not been checked against a source.",
      "Certaines règles de culture ont été écrites de mémoire par un modèle d'IA et n'ont pas été vérifiées par rapport à une source.",
      "كتب نموذج ذكاء اصطناعي بعض قواعد المحاصيل من ذاكرته، ولم يُتحقق من مطابقتها لمصدر.",
      "شي قواعد ديال الزراعات كتبها نموذج ذكاء اصطناعي من الذاكرة ديالو وما تقارناتش مع مصدر.",
    ],
  ],
  [
    "BASELINE_NOT_PROVIDED",
    [
      "No current rotation to compare with",
      "Aucune rotation actuelle à comparer",
      "لا توجد دورة زراعية حالية للمقارنة",
      "ما عندناش الدورة الحالية للمقارنة",
    ],
    [
      "No current rotation was given and no dated crop history could stand in for it, so alternatives are shown without a comparison to your current rotation.",
      "Aucune rotation actuelle n'a été fournie et aucun historique daté ne pouvait la remplacer : les alternatives sont montrées sans comparaison avec votre rotation actuelle.",
      "لم تُقدَّم دورة زراعية حالية ولم يصلح أي سجل محاصيل مؤرَّخ بديلاً عنها، لذلك تُعرض البدائل دون مقارنة بدورتك الزراعية الحالية.",
      "ما عطيتيش الدورة الحالية ديالك، وما لقيناش سجل زراعات بالتواريخ يقدر يعوضها. كنبيّنو البدائل بلا مقارنة مع الدورة الحالية ديالك.",
    ],
  ],
  [
    "BASELINE_INFERRED_FROM_HISTORY",
    [
      "Current rotation guessed from your history",
      "Rotation actuelle estimée d'après votre historique",
      "الدورة الزراعية الحالية مقدَّرة من سجلك",
      "خمنّا الدورة الحالية من السجل ديالك",
    ],
    [
      "You did not say which rotation you will continue, so your recorded crops were repeated in date order as the current rotation. Tell the tool your rotation to replace this guess.",
      "Vous n'avez pas indiqué quelle rotation vous poursuivez : vos cultures enregistrées ont été répétées par ordre de date comme rotation actuelle. Indiquez votre rotation pour remplacer cette hypothèse.",
      "لم تذكر الدورة الزراعية التي ستواصلها، فاعتُبر تكرار محاصيل سجلك حسب ترتيب تواريخها دورتك الحالية. حدّد دورتك في الأداة لتعويض هذا الافتراض.",
      "ما قلتيش شنو الدورة اللي غادي تكمل بها. كررنا الزراعات المسجلة عندك بترتيب تواريخها كدورة حالية. دخل الدورة ديالك فالأداة باش تعوض هاد التخمين.",
    ],
  ],
  [
    "BASELINE_CROP_NOT_SCHEDULABLE",
    [
      "A crop of your rotation cannot be planned",
      "Une culture de votre rotation n'est pas planifiable",
      "محصول في دورتك الزراعية لا يمكن تخطيطه",
      "شي زراعة فالدورة ديالك ما يمكنش نخططو ليها",
    ],
    [
      "Your current rotation includes a crop that cannot be scheduled with the catalog evidence for this field, so the rotation cannot be scored.",
      "Votre rotation actuelle comprend une culture qui ne peut pas être planifiée avec les données du catalogue pour cette parcelle : la rotation ne peut pas être notée.",
      "تتضمن دورتك الزراعية الحالية محصولاً لا يمكن تحديد مواعيده بالبيانات الموثقة في دليل المحاصيل لهذا الحقل، لذلك لا يمكن تقييم الدورة الزراعية.",
      "الدورة الحالية ديالك فيها زراعة ما قدرناش نحددو ليها تواريخ بالمعلومات الموثقة فالدليل لهاد القطعة. داكشي علاش ما نقدرش نعطيو نقطة للدورة.",
    ],
  ],
  [
    "BASELINE_NO_FEASIBLE_SCHEDULE",
    [
      "Your rotation does not fit the dates",
      "Votre rotation ne tient pas dans les dates",
      "دورتك الزراعية لا تتوافق مع التواريخ",
      "الدورة ديالك ما كتوافقش التواريخ",
    ],
    [
      "Your current rotation cannot be scheduled between the start date and the end of the planning period under the catalog rules.",
      "Votre rotation actuelle ne peut pas être planifiée entre la date de début et la fin de la période de planification selon les règles du catalogue.",
      "لا يمكن جدولة دورتك الزراعية الحالية بين تاريخ البدء ونهاية فترة التخطيط وفق قواعد دليل المحاصيل.",
      "ما قدرناش نبرمجو الدورة الحالية ديالك بين تاريخ البداية ونهاية مدة التخطيط، على حساب قواعد الدليل.",
    ],
  ],
  [
    "BASELINE_STOPPED_BY_RULE",
    [
      "Your rotation breaks a hard rule",
      "Votre rotation enfreint une règle stricte",
      "دورتك الزراعية تخالف قاعدة صارمة",
      "الدورة ديالك كتخالف قاعدة ضرورية",
    ],
    [
      "Your current rotation breaks a binding rule for one of its crops, so it is scored only up to that point.",
      "Votre rotation actuelle enfreint une règle contraignante pour l'une de ses cultures : elle n'est notée que jusqu'à ce point.",
      "تخالف دورتك الزراعية الحالية قاعدة ملزمة لأحد محاصيلها، لذلك تُقيَّم حتى تلك النقطة فقط.",
      "الدورة الحالية ديالك كتخالف قاعدة ملزمة فواحدة من الزراعات ديالها. داكشي علاش التنقيط كيتحسب غير حتى لهاديك النقطة.",
    ],
  ],
]);
