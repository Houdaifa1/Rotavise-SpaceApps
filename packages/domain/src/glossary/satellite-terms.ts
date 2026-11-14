import { VEGETATION_GLOSSARY } from "../observations/vegetation-analysis.js";
import { VEGETATION_HISTORY_GLOSSARY } from "../observations/vegetation-history.js";
import { rows } from "./types.js";

// Terms behind the satellite and model results. The vegetation and MODIS
// English texts are the ones the analysis modules already return, so the two
// cannot drift; the other languages are written here.
export const satelliteTerms = rows("term", [
  [
    "ndvi",
    [
      "NDVI (greenness)",
      "NDVI (verdure)",
      "NDVI (اخضرار النبات)",
      "NDVI (الاخضرار)",
    ],
    [
      VEGETATION_GLOSSARY.ndvi,
      "Le NDVI (indice de végétation par différence normalisée) mesure à quel point une parcelle paraît verte vue de l'espace, de -1 à 1. Un sol nu est bas, des cultures denses et saines sont élevées.",
      "يقيس مؤشر NDVI (مؤشر الغطاء النباتي بالفرق المعياري) مدى اخضرار الحقل كما يُرى من الفضاء، بقيم من -1 إلى 1. تكون القيم منخفضة للتربة العارية ومرتفعة للمحاصيل الكثيفة والسليمة.",
      "مؤشر NDVI كيقيس شحال القطعة كتبان خضرا من الفضاء، بقيم من -1 حتى 1. الأرض العريانة كتكون قيمتها منخفضة، والزراعات الكثيفة والصحيحة كتكون قيمتها مرتفعة.",
    ],
  ],
  [
    "green_season",
    ["Green season", "Saison verte", "موسم اخضرار", "موسم الاخضرار"],
    [
      VEGETATION_GLOSSARY.green_season,
      "Une saison verte est une période où la verdure de la parcelle est restée nettement au-dessus de son niveau bas habituel. Le satellite ne peut pas dire quelle culture c'était ; c'est à l'agriculteur de le dire.",
      "موسم الاخضرار فترة ظل فيها اخضرار الحقل أعلى بوضوح من مستواه المنخفض المعتاد. لا يستطيع القمر تحديد المحصول؛ فهذا يقوله المزارع.",
      "فترة بقات فيها القطعة خضرا بوضوح كثر من المستوى المنخفض المعتاد ديالها. القمر الاصطناعي ما يقدرش يعرف شنو كانت الزراعة، الفلاح هو اللي كيأكدها.",
    ],
  ],
  [
    "bare_field_period",
    [
      "Low-greenness period",
      "Période de faible verdure",
      "فترة اخضرار منخفض",
      "فترة الاخضرار القليل",
    ],
    [
      VEGETATION_GLOSSARY.bare_field_period,
      "Une période de faible verdure est un intervalle entre deux saisons vertes. C'est souvent du sol nu ou du chaume, mais le satellite ne peut pas le dire. Confirmez ce qui était sur la parcelle.",
      "فترة الاخضرار المنخفض مدة بين موسمي اخضرار. غالباً تكون تربة عارية أو بقايا حصاد لكن القمر لا يستطيع الجزم. تأكد مما كان في الحقل.",
      "فترة بين جوج مواسم ديال الاخضرار. غالبا كتكون الأرض عريانة ولا فيها بقايا الحصاد، ولكن القمر الاصطناعي ما يقدرش يجزم. أكد شنو كان فالقطعة.",
    ],
  ],
  [
    "vegetation_stress",
    [
      "Vegetation stress",
      "Stress de la végétation",
      "إجهاد النبات",
      "إجهاد النبات",
    ],
    [
      VEGETATION_GLOSSARY.vegetation_stress,
      "Le stress de la végétation signifie que la culture paraît moins verte que prévu, par exemple à cause de la sécheresse, de la chaleur, de ravageurs ou d'un semis tardif. Une valeur basse invite à aller voir la parcelle ; ce n'est pas un diagnostic.",
      "إجهاد النبات يعني أن المحصول يبدو أقل اخضراراً من المتوقع، مثلاً بسبب الجفاف أو الحر أو الآفات أو تأخر الزراعة. القيمة المنخفضة دعوة لتفقد الحقل وليست تشخيصاً.",
      "الزراعة كتبان أقل خضورية من المتوقع، مثلا بسبب الجفاف ولا السخونية ولا الآفات ولا تأخر الزرع. القياس المنخفض كيدعيك تشوف القطعة، وماشي تشخيص.",
    ],
  ],
  [
    "field_history_anomaly",
    [
      "Compared with the field's own history",
      "Comparé à l'historique de la parcelle",
      "مقارنة بتاريخ الحقل نفسه",
      "بالمقارنة مع سجل نفس القطعة",
    ],
    [
      VEGETATION_GLOSSARY.field_history_anomaly,
      "La comparaison porte sur la même période de l'année dans les autres années de la parcelle. Un écart marqué indique une parcelle nettement plus ou moins verte que d'habitude ; une autre culture ou une autre date de semis change aussi le résultat.",
      "تقارن الأداة الفترة نفسها من السنة في سنوات الحقل الأخرى. يعني الاختلاف الواضح أن الحقل أكثر أو أقل اخضراراً من المعتاد. كما أن اختلاف المحصول أو موعد الزرع يغيّر النتيجة.",
      "كنقارنو نفس الوقت من العام مع السنين لخرين ديال نفس القطعة. فرق واضح كيعني القطعة خضرا كثر ولا أقل من المعتاد. حتى تبديل الزراعة ولا موعد الزرع كيبدل النتيجة.",
    ],
  ],
  [
    "cloud_gap",
    [
      "Cloud gaps",
      "Données manquantes à cause des nuages",
      "بيانات تحجبها السحب",
      "نقص فالبيانات بسبب السحاب",
    ],
    [
      VEGETATION_GLOSSARY.cloud_gap,
      "Les nuages et la brume masquent certaines dates. De longs écarts entre dates exploitables rendent incertain le début ou la fin exact d'une période.",
      "تحجب الغيوم والضباب بعض التواريخ. الفجوات الطويلة بين التواريخ الصالحة تجعل بداية الفترة أو نهايتها غير مؤكدة.",
      "السحاب والضباب كيحجبو الرؤية فشي تواريخ. إلا كان فرق طويل بين التواريخ الصالحة، البداية ولا النهاية بالضبط ديال الفترة كتبقى غير مؤكدة.",
    ],
  ],
  [
    "modis.ndvi_history",
    [
      "Long greenness history (MODIS)",
      "Historique de verdure sur de nombreuses années (MODIS)",
      "سجل الاخضرار عبر سنوات طويلة (MODIS)",
      "سجل الاخضرار لسنين كثيرة (MODIS)",
    ],
    [
      VEGETATION_HISTORY_GLOSSARY["modis.ndvi_history"],
      "C'est le même indice de verdure (NDVI) que la chronologie satellite plus fine, mais mesuré tous les 16 jours depuis 2000 : il montre ce qui est habituel pour cette parcelle sur de nombreuses années, pas seulement les dernières.",
      "هو مؤشر الاخضرار نفسه (NDVI) في الجدول الزمني الأدق، لكنه مقيس كل 16 يوماً منذ عام 2000، فيُظهر ما هو معتاد لهذا الحقل عبر سنوات كثيرة لا في السنوات الأخيرة فقط.",
      "نفس مؤشر الاخضرار NDVI ديال صور الأقمار الأدق، ولكن كيتقاس كل 16 يوم من عام 2000. كيبين المعتاد فالقطعة عبر سنين كثيرة، ماشي غير السنين لخرين.",
    ],
  ],
  [
    "modis.usually_low",
    [
      "Usually-low window",
      "Période habituellement peu verte",
      "فترة اخضرار منخفض عادةً",
      "فترة الاخضرار فيها قليل عادة",
    ],
    [
      VEGETATION_HISTORY_GLOSSARY["modis.usually_low"],
      "Une période est habituellement peu verte lorsque, la plupart des années, la verdure de la parcelle se situait dans le bas de sa propre variation annuelle à ce moment. Cela correspond souvent à un sol nu ou à des chaumes, mais le satellite ne peut pas le confirmer ; indiquez ce qui était sur la parcelle.",
      "يكون الاخضرار منخفضاً عادةً إذا كانت قيمته في هذه الفترة، في معظم السنوات، ضمن أدنى مستوياتها السنوية في الحقل نفسه. قد تكون التربة عارية أو عليها بقايا حصاد، لكن القمر الاصطناعي لا يستطيع تأكيد ذلك؛ حدّد ما كان في الحقل.",
      "فهاد الفترة، فأغلب السنين، الاخضرار ديال القطعة كيكون فالجزء المنخفض من التغير ديالو فنفس العام. غالبا كتكون أرض عريانة ولا بقايا الحصاد، ولكن القمر ما كيأكدش. أكد شنو كان فالقطعة.",
    ],
  ],
  [
    "modis.pixel_size",
    [
      "Pixel size (about 6 hectares)",
      "Taille du pixel (environ 6 hectares)",
      "حجم البكسل (نحو 6 هكتارات)",
      "حجم البكسل (حوالي 6 هكتارات)",
    ],
    [
      VEGETATION_HISTORY_GLOSSARY["modis.pixel_size"],
      "Chaque mesure couvre un carré d'environ 250 m de côté, soit environ 6 hectares. Une petite parcelle partage ce carré avec son environnement : consultez la comparaison avec les voisins avant de vous fier à une période.",
      "تغطي كل قراءة مربعاً طول ضلعه نحو 250 م، أي نحو 6 هكتارات. يشترك الحقل الصغير في هذا المربع مع محيطه؛ راجع مقارنة البكسلات المجاورة قبل الاعتماد على الفترة المحددة.",
      "كل قياس كيغطي مربع ضلعو حوالي 250 متر، يعني حوالي 6 هكتارات. القطعة الصغيرة كتشارك هاد المربع مع اللي داير بها. شوف المقارنة مع البكسلات المجاورة قبل ما تعتمد على الفترة.",
    ],
  ],
  [
    "modis.peak_trend",
    [
      "Yearly peak trend",
      "Tendance du pic annuel",
      "اتجاه الذروة السنوية",
      "اتجاه أعلى قيمة فكل عام",
    ],
    [
      VEGETATION_HISTORY_GLOSSARY["modis.peak_trend"],
      "Le pic annuel est la mesure la plus verte de chaque année. Une hausse ou une baisse lente sur de nombreuses années peut refléter le climat, le choix des cultures, l'irrigation ou un changement alentour ; la tendance ne dit pas lequel.",
      "الذروة السنوية هي أكثر قراءة اخضراراً في كل سنة. قد يعكس ارتفاعها أو انخفاضها البطيء عبر سنوات كثيرة المناخ أو اختيار المحاصيل أو السقي أو تغيراً في المحيط؛ والاتجاه لا يبيّن أيّها.",
      "أعلى قيمة فالعام هي القياس اللي كانت فيه القطعة أكثر خضورية. الزيادة ولا النقص مع السنين يقدرو يكونو من المناخ ولا اختيار الزراعات ولا السقي ولا تبديل فالمحيط. الاتجاه ما كيقولش شنو السبب.",
    ],
  ],
  [
    "modis.hls_agreement",
    [
      "Agreement between the two satellite records",
      "Concordance entre les deux relevés satellite",
      "توافق سجلَّي الأقمار الاصطناعية",
      "التوافق بين جوج سجلات الأقمار",
    ],
    [
      VEGETATION_HISTORY_GLOSSARY["modis.hls_agreement"],
      "Le relevé ancien et plus grossier et le relevé récent et plus fin devraient raconter la même histoire pendant les années communes. L'accord renforce la confiance ; le désaccord est une raison d'aller voir la parcelle.",
      "ينبغي أن يروي السجل الأقدم الأقل دقة والسجل الأحدث الأدق القصة نفسها في السنوات المشتركة. الاتفاق يرفع الثقة والاختلاف سبب لتفقد الحقل.",
      "السجل القديم الأقل دقة والسجل الجديد الأدق خاصهم يبينو نتائج متوافقة فالسنين المشتركة. التوافق كيزيد الثقة، والاختلاف سبب باش تمشي تشوف القطعة.",
    ],
  ],
  [
    "terrain.elevation",
    ["Elevation", "Altitude", "الارتفاع", "العلو على سطح البحر"],
    [
      "Height of the ground above sea level, from the NASADEM 30 m elevation model. It is a surface model, so it can include trees or buildings.",
      "Hauteur du sol au-dessus du niveau de la mer, d'après le modèle d'altitude NASADEM à 30 m. C'est un modèle de surface : il peut inclure des arbres ou des bâtiments.",
      "ارتفاع الأرض عن سطح البحر من نموذج الارتفاع NASADEM بدقة 30 م. هو نموذج سطح، فقد يشمل الأشجار أو المباني.",
      "علو الأرض على سطح البحر من نموذج NASADEM بدقة 30 متر. هادا نموذج للسطح، يعني يقدر يدخل فيه حتى علو الشجر ولا البنايات.",
    ],
  ],
  [
    "terrain.dem_noise",
    [
      "Elevation uncertainty",
      "Incertitude de l'altitude",
      "هامش الخطأ في الارتفاع",
      "هامش الخطأ فالعلو",
    ],
    [
      "Elevation values are only accurate to a few metres vertically, which matters on flat land where the real slope is small.",
      "Les altitudes ne sont précises qu'à quelques mètres verticalement, ce qui compte sur terrain plat où la pente réelle est faible.",
      "قيم الارتفاع دقيقة إلى بضعة أمتار رأسياً فقط، وهذا مهم في الأرض المسطحة حيث الانحدار الفعلي صغير.",
      "قيم العلو فيها هامش خطأ ديال بضعة أمتار فالاتجاه العمودي. هادشي مهم فالأرض المسطحة اللي الميل الحقيقي ديالها قليل.",
    ],
  ],
  [
    "terrain.slope",
    ["Slope", "Pente", "الانحدار", "الانحدار"],
    [
      "How steeply the ground falls, in percent, computed from the 30 m elevation grid, with the FAO slope class for reading it.",
      "L'inclinaison du terrain, en pourcentage, calculée à partir de la grille d'altitude à 30 m, avec la classe de pente FAO pour la lire.",
      "شدة انحدار الأرض، بالنسبة المئوية، محسوبة من شبكة الارتفاع بدقة 30 م. تُعرض معها فئة الانحدار بحسب الفاو لتسهيل فهمها.",
      "شحال الأرض مايلة، بالنسبة المئوية، محسوب من شبكة العلو بدقة 30 متر. كنبيّنو حتى فئة الانحدار حسب الفاو باش تسهّل الفهم.",
    ],
  ],
  [
    "terrain.aspect",
    [
      "Aspect (slope direction)",
      "Exposition (direction de la pente)",
      "الاتجاه (جهة الانحدار)",
      "الجهة ديال الميل",
    ],
    [
      "The compass direction the slope faces. South-facing slopes in Morocco get more sun and dry faster than north-facing ones.",
      "La direction cardinale vers laquelle la pente est orientée. Au Maroc, les pentes orientées au sud reçoivent plus de soleil et sèchent plus vite que celles orientées au nord.",
      "الجهة التي ينحدر نحوها السفح. في المغرب تنال السفوح الجنوبية شمساً أكثر وتجف أسرع من الشمالية.",
      "الجهة اللي كيشوف ليها المنحدر. فالمغرب، المنحدرات اللي كتشوف للجنوب كتاخد شمس كثر وكتنشف أسرع من اللي كتشوف للشمال.",
    ],
  ],
  [
    "terrain.slope_below_noise",
    [
      "Slope too small to trust",
      "Pente trop faible pour être fiable",
      "انحدار ضعيف يصعب تأكيده",
      "الميل قليل وما يمكنش نعتمدو عليه",
    ],
    [
      "The computed slope is within the elevation data's own uncertainty, so treat the field as flat for practical purposes.",
      "La pente calculée est dans l'incertitude propre des données d'altitude : considérez la parcelle comme plate en pratique.",
      "الانحدار المحسوب ضمن عدم يقين بيانات الارتفاع نفسها، فاعتبر الحقل مسطحاً عملياً.",
      "الميل المحسوب داخل هامش الخطأ ديال بيانات العلو. فالتعامل مع القطعة، اعتابرها أرض مسطحة.",
    ],
  ],
  [
    "terrain.erosion_ls",
    [
      "Erosion tendency (LS factor)",
      "Tendance à l'érosion (facteur LS)",
      "قابلية التعرية (عامل LS)",
      "قابلية التعرية (عامل LS)",
    ],
    [
      "The RUSLE slope-length and steepness factor compared with a standard test plot (value 1). Higher means more tendency for water erosion on this terrain. It ignores rain, soil and crop cover, so it is a reading aid, not a soil-loss figure.",
      "Le facteur de longueur et d'inclinaison de pente RUSLE comparé à une parcelle d'essai standard (valeur 1). Plus il est élevé, plus le terrain tend à l'érosion hydrique. Il ignore la pluie, le sol et le couvert végétal : c'est un repère de lecture, pas une perte de sol chiffrée.",
      "عامل طول المنحدر وشدته في معادلة RUSLE مقارنةً بقطعة اختبار قياسية قيمتها 1. كلما ارتفع زادت قابلية الأرض للتعرية المائية. لا يأخذ المطر والتربة والغطاء النباتي في الحسبان؛ فهو مؤشر للفهم وليس كمية التربة المفقودة.",
      "عامل طول المنحدر وشدة الميل فمعادلة RUSLE، بالمقارنة مع قطعة اختبار مرجعية قيمتها 1. إلا طلع كتزيد قابلية التعرية بالما. ما كيحسبش الشتا ولا التربة ولا الغطاء النباتي. هادا مؤشر للفهم وماشي كمية التربة اللي كتضيع.",
    ],
  ],
  [
    "terrain.frost_pocket",
    [
      "Possible cold-air pocket",
      "Poche d'air froid possible",
      "جيب هواء بارد محتمل",
      "بلاصة يقدر يتجمع فيها البرد",
    ],
    [
      "The field sits lower than its surroundings on gentle slopes, where cold air can collect on still nights. It is a hint from the shape of the land, not a measured frost risk.",
      "La parcelle est plus basse que son environnement sur des pentes douces, là où l'air froid peut s'accumuler par nuit calme. C'est une indication tirée du relief, pas un risque de gel mesuré.",
      "يقع الحقل أخفض من محيطه ضمن تضاريس قليلة الانحدار، حيث قد يتجمع الهواء البارد في الليالي الهادئة. هذه إشارة من شكل الأرض، وليست قياساً لخطر الصقيع.",
      "القطعة جاية هابطة على اللي داير بها، فبلاصة الميل فيها خفيف. الهواء البارد يقدر يتجمع فيها فالليالي الهادئة. هادي إشارة من شكل الأرض، ماشي قياس لخطر الصقيع.",
    ],
  ],
  [
    "ecostress.lst",
    [
      "Land surface temperature",
      "Température de surface des terres",
      "درجة حرارة سطح الأرض",
      "حرارة سطح الأرض",
    ],
    [
      "How hot the ground and plants' surface felt to the ECOSTRESS sensor at 70 m during an overpass. It is not the air temperature.",
      "Température de la surface du sol et des plantes mesurée par le capteur ECOSTRESS, avec une résolution de 70 m, lors d'un passage. Ce n'est pas la température de l'air.",
      "مدى سخونة سطح الأرض والنبات كما قاسها مستشعر ECOSTRESS بدقة 70 م أثناء مرور. وهي ليست حرارة الهواء.",
      "شحال سخون سطح الأرض والنبات وقت مرور حساس ECOSTRESS بدقة 70 متر. هادي ماشي درجة حرارة الهواء.",
    ],
  ],
  [
    "ecostress.esi",
    [
      "Evaporative stress index",
      "Indice de stress évaporatif",
      "مؤشر الإجهاد التبخري",
      "مؤشر الإجهاد التبخري",
    ],
    [
      "A value from 0 to 1 comparing how much water the surface is losing with what it could lose. Lower means more water stress. It is a modelled index, not a field measurement.",
      "Une valeur de 0 à 1 comparant l'eau réellement perdue par la surface à celle qu'elle pourrait perdre. Plus c'est bas, plus le stress hydrique est fort. C'est un indice modélisé, pas une mesure sur la parcelle.",
      "قيمة من 0 إلى 1 تقارن ما يفقده السطح من ماء بما يمكن أن يفقده. الأقل يعني إجهاداً مائياً أكبر. وهو مؤشر منمذج لا قياس في الحقل.",
      "قيمة من 0 حتى 1 كتقارن الما اللي كيفقدو السطح مع اللي يقدر يفقدو. إلا نقصات كيعني الإجهاد المائي كثر. هادا مؤشر محسوب بنموذج، ماشي قياس فالقطعة.",
    ],
  ],
  [
    "ecostress.irregular_sampling",
    [
      "Uneven sampling in time",
      "Échantillonnage irrégulier dans le temps",
      "أخذ عينات غير منتظم زمنياً",
      "القياسات ماشي فأوقات منتظمة",
    ],
    [
      "ECOSTRESS rides on the International Space Station, so it passes at irregular dates and times of day. A month's average is a sample, not a full record.",
      "ECOSTRESS est installé sur la Station spatiale internationale : ses passages ont lieu à des dates et heures irrégulières. La moyenne d'un mois est un échantillon, pas un relevé complet.",
      "يعمل ECOSTRESS على متن محطة الفضاء الدولية، وتحدث مروراته في تواريخ وساعات غير منتظمة. ومتوسط الشهر عينة وليس سجلاً كاملاً.",
      "ECOSTRESS فوق محطة الفضاء الدولية وكيدوز فتواريخ وساعات مختلفة. متوسط الشهر غير عينة، ماشي سجل كامل.",
    ],
  ],
  [
    "grace.equivalent_water_height",
    [
      "Water storage anomaly",
      "Écart de stock d'eau par rapport à une référence",
      "فرق مخزون المياه عن الفترة المرجعية",
      "الفرق فمخزون الما",
    ],
    [
      "The change in total water stored in an area (groundwater, soil, surface water), expressed as centimetres of water over the ground, relative to a reference period. It comes from NASA's GRACE and GRACE-FO gravity satellites.",
      "La variation de l'eau totale stockée dans une zone (nappes, sol, eau de surface), exprimée en centimètres d'eau sur le sol, par rapport à une période de référence. Elle provient des satellites de gravimétrie GRACE et GRACE-FO de la NASA.",
      "التغير في إجمالي المياه المخزنة في منطقة (جوفية وتربة وسطحية) معبَّراً عنه بسنتيمترات من الماء فوق الأرض مقارنةً بفترة مرجعية. يأتي من قمري الجاذبية GRACE وGRACE-FO التابعين لناسا.",
      "الفرق فمجموع الما المخزون فالمنطقة، تحت الأرض وفالتربة وفالسطح، بالمقارنة مع فترة مرجعية. كيتعبر عليه بسنتيمترات ديال الما فوق الأرض. جاي من أقمار الجاذبية ديال ناسا GRACE وGRACE-FO.",
    ],
  ],
  [
    "grace.trend",
    [
      "Water storage trend",
      "Tendance du stockage d'eau",
      "اتجاه تخزين المياه",
      "اتجاه مخزون الما",
    ],
    [
      "The slope of the water storage anomaly over the years, with its uncertainty. A downward trend suggests the region is losing stored water; it does not say why.",
      "L'évolution au fil des ans de l'écart de stock d'eau par rapport à la référence, avec son incertitude. Une baisse suggère que la région perd de l'eau stockée ; elle n'en indique pas la cause.",
      "اتجاه تغير فرق مخزون المياه عن الفترة المرجعية عبر السنوات، مع هامش عدم اليقين. يشير الانخفاض إلى أن المنطقة تفقد جزءاً من مياهها المخزنة، دون أن يحدد السبب.",
      "كيفاش كيتبدل الفرق فمخزون الما مع السنين، ومعاه هامش عدم اليقين. إلا كان هابط، كيقدر يعني بلي المنطقة كتفقد الما المخزون. ما كيقولش شنو السبب.",
    ],
  ],
  [
    "grace.regional_not_field",
    [
      "Regional, not for one field",
      "Régional, pas pour une parcelle",
      "إقليمي لا لحقل واحد",
      "للمنطقة، ماشي لقطعة وحدة",
    ],
    [
      "GRACE sees cells hundreds of kilometres wide. The result describes the wider region, never your field's own water.",
      "GRACE voit des cellules larges de centaines de kilomètres. Le résultat décrit la région élargie, jamais l'eau propre à votre parcelle.",
      "يرى GRACE خلايا عرضها مئات الكيلومترات. وتصف النتيجة المنطقة الأوسع لا مياه حقلك بذاته.",
      "GRACE كيشوف خلايا العرض ديالها مئات الكيلومترات. النتيجة كتخص المنطقة الواسعة، وما كتقيسش الما ديال القطعة ديالك بوحدها.",
    ],
  ],
  [
    "gedi.agbd",
    [
      "Aboveground biomass density",
      "Densité de biomasse aérienne",
      "كثافة الكتلة الحيوية فوق الأرض",
      "كثافة الكتلة الحيوية فوق الأرض",
    ],
    [
      "An estimate of the dry plant matter above ground per hectare, in a 1 km cell, from NASA's GEDI laser instrument on the space station.",
      "Une estimation de la matière végétale sèche aérienne par hectare, dans une cellule de 1 km, d'après l'instrument laser GEDI de la NASA sur la station spatiale.",
      "تقدير للمادة النباتية الجافة فوق الأرض لكل هكتار ضمن خلية 1 كم، من جهاز الليزر GEDI التابع لناسا على المحطة الفضائية.",
      "تقدير للمادة النباتية الناشفة اللي فوق الأرض فكل هكتار، داخل خلية ديال 1 كلم. جاي من جهاز الليزر ديال ناسا GEDI فوق محطة الفضاء.",
    ],
  ],
  [
    "gedi.hedges_and_trees",
    [
      "Trees and hedges nearby",
      "Arbres et haies à proximité",
      "أشجار وأسيجة نباتية قريبة",
      "الشجر والسياجات النباتية اللي قراب",
    ],
    [
      "The value mostly reflects woody vegetation such as trees, orchards and hedges in and around the cell, which matters for windbreaks and shade.",
      "La valeur reflète surtout la végétation ligneuse (arbres, vergers, haies) dans et autour de la cellule, ce qui compte pour les brise-vent et l'ombre.",
      "تعكس القيمة في الغالب النباتات الخشبية مثل الأشجار والبساتين والأسيجة النباتية داخل الخلية وحولها، وهذا يهم مصدّات الرياح والظل.",
      "القيمة كتبين بالأساس النباتات الخشبية، بحال الشجر والبساتين والسياجات النباتية داخل الخلية وحولها. هادشي مهم لصد الرياح والظل.",
    ],
  ],
  [
    "gedi.not_crop_biomass",
    [
      "Not the biomass of your crop",
      "Pas la biomasse de votre culture",
      "ليست الكتلة الحيوية لمحصولك",
      "ماشي الكتلة الحيوية ديال الزراعة ديالك",
    ],
    [
      "GEDI does not measure annual crops reliably. This value is context about woody vegetation, never a yield or crop biomass estimate.",
      "GEDI ne mesure pas de façon fiable les cultures annuelles. Cette valeur est un contexte sur la végétation ligneuse, jamais une estimation de rendement ou de biomasse de culture.",
      "لا يقيس GEDI المحاصيل الحولية بموثوقية. هذه القيمة تعطي معلومات عن النباتات الخشبية، وليست تقديراً لمردودية المحصول أو كتلته الحيوية.",
      "GEDI ما كيقيسش الزراعات السنوية بشكل موثوق. هاد القيمة معلومات على النباتات الخشبية، وماشي تقدير للمردودية ولا الكتلة الحيوية ديال الزراعة.",
    ],
  ],
  [
    "product.hls",
    [
      "HLS (Landsat and Sentinel-2)",
      "HLS (Landsat et Sentinel-2)",
      "HLS (لاندسات وسنتينل-2)",
      "HLS (لاندسات وسنتينل-2)",
    ],
    [
      "Harmonized Landsat Sentinel-2: NASA's combined satellite imagery at 30 m, used for the field's greenness every few days when the sky is clear.",
      "Harmonized Landsat Sentinel-2 : imagerie satellite combinée de la NASA à 30 m, utilisée pour la verdure de la parcelle tous les quelques jours par ciel dégagé.",
      "Harmonized Landsat Sentinel-2: صور الأقمار المدمجة من ناسا بدقة 30 م، تُستخدم لاخضرار الحقل كل بضعة أيام حين تكون السماء صافية.",
      "صور كتجمع لاندسات وسنتينل-2 من ناسا بدقة 30 متر. كتستعمل باش نشوفو اخضرار القطعة كل بضعة أيام، إلا كانت السما صافية.",
    ],
  ],
  [
    "product.smap",
    [
      "SMAP soil moisture",
      "Humidité du sol SMAP",
      "رطوبة التربة SMAP",
      "رطوبة التربة SMAP",
    ],
    [
      "NASA SMAP Level-4 root-zone soil moisture on a 9 km grid, a modelled value that blends satellite and weather data. It describes the wider cell, not a single field.",
      "Humidité du sol de la zone racinaire SMAP niveau 4 de la NASA sur une grille de 9 km, une valeur modélisée qui combine satellite et météo. Elle décrit la cellule élargie, pas une parcelle précise.",
      "رطوبة التربة في منطقة الجذور من SMAP المستوى 4 لدى ناسا على شبكة 9 كم، وهي قيمة منمذجة تمزج بيانات الأقمار والطقس. وتصف الخلية الأوسع لا حقلاً بعينه.",
      "رطوبة التربة فمنطقة الجذور من ناسا SMAP المستوى 4، فشبكة ديال 9 كلم. قيمة محسوبة بنموذج كيجمع بيانات الأقمار والطقس. كتخص الخلية الواسعة، ماشي قطعة وحدة.",
    ],
  ],
  [
    "product.gpm",
    ["GPM IMERG rain", "Pluie GPM IMERG", "أمطار GPM IMERG", "الشتا GPM IMERG"],
    [
      "NASA's satellite-based daily rain estimate (IMERG Final). It is used to correct rain from the weather data, and is itself an estimate, not a rain-gauge reading.",
      "L'estimation quotidienne de pluie par satellite de la NASA (IMERG Final). Elle sert à corriger la pluie des données météo et reste une estimation, pas une lecture de pluviomètre.",
      "تقدير ناسا اليومي للمطر بالأقمار (IMERG Final). يُستخدم لتصحيح المطر في بيانات الطقس، وهو نفسه تقدير لا قراءة مقياس مطر.",
      "تقدير يومي ديال الشتا من أقمار ناسا، IMERG Final. كنستعملوه لتصحيح الشتا فبيانات الطقس. كيبقى غير تقدير، ماشي قياس من جهاز قياس المطر.",
    ],
  ],
  [
    "product.power",
    [
      "NASA POWER weather",
      "Météo NASA POWER",
      "طقس NASA POWER",
      "الطقس NASA POWER",
    ],
    [
      "NASA POWER daily weather (temperature, rain, solar radiation and more) on a grid much coarser than a field, built from satellite and model data. It is an estimate for the surrounding cell.",
      "Météo quotidienne NASA POWER (température, pluie, rayonnement solaire, etc.) sur une grille bien plus grossière qu'une parcelle, construite à partir de données satellite et de modèles. C'est une estimation pour la cellule environnante.",
      "بيانات الطقس اليومية من NASA POWER (الحرارة والمطر والإشعاع الشمسي وغيرها) على شبكة خلاياها أكبر بكثير من الحقل، مبنية على بيانات الأقمار والنماذج. وهي تقديرات للخلية المحيطة.",
      "بيانات الطقس اليومية من ناسا POWER، بحال الحرارة والشتا والإشعاع الشمسي، مبنية على الأقمار والنماذج. الشبكة ديالها أكبر بزاف من القطعة، والقيم تقديرات للخلية اللي دايرة بها.",
    ],
  ],
  [
    "product.nex_gddp",
    [
      "Future climate (NEX-GDDP-CMIP6)",
      "Climat futur (NEX-GDDP-CMIP6)",
      "المناخ المستقبلي (NEX-GDDP-CMIP6)",
      "المناخ الجاي (NEX-GDDP-CMIP6)",
    ],
    [
      "NASA's downscaled projections from climate models for the next decades under two emission scenarios (SSP2-4.5 and SSP5-8.5). They show possible futures, not forecasts.",
      "Projections de la NASA issues de modèles climatiques, affinées à une échelle plus détaillée, pour les prochaines décennies selon deux scénarios d'émissions (SSP2-4.5 et SSP5-8.5). Elles montrent des évolutions possibles, pas des prévisions météo.",
      "إسقاطات من ناسا للعقود القادمة ناتجة عن نماذج مناخية مع زيادة التفاصيل المكانية، وفق سيناريوهين للانبعاثات (SSP2-4.5 وSSP5-8.5). تعرض مسارات محتملة للمناخ، وليست تنبؤات بالطقس.",
      "معطيات من ناسا لسيناريوهات المناخ فالعقود الجاية، من نماذج مناخية بتفاصيل مكانية أدق، حسب جوج سيناريوهات ديال الانبعاثات: SSP2-4.5 وSSP5-8.5. كتبين احتمالات للمستقبل، ماشي توقعات الطقس.",
    ],
  ],
  [
    "product.nasadem",
    [
      "NASADEM elevation",
      "Altitude NASADEM",
      "ارتفاع NASADEM",
      "العلو NASADEM",
    ],
    [
      "NASA's 30 m global elevation model, a reprocessing of the Shuttle radar mission (SRTM) data.",
      "Le modèle d'altitude mondial à 30 m de la NASA, un retraitement des données de la mission radar de la navette (SRTM).",
      "نموذج الارتفاع العالمي لدى ناسا بدقة 30 م، وهو إعادة معالجة لبيانات مهمة رادار المكوك (SRTM).",
      "نموذج ناسا للعلو فالعالم بدقة 30 متر، ناتج عن إعادة معالجة بيانات مهمة رادار المكوك SRTM.",
    ],
  ],
  [
    "product.modis",
    ["MODIS greenness", "Verdure MODIS", "اخضرار MODIS", "الاخضرار MODIS"],
    [
      "NASA MODIS vegetation index (MOD13Q1) at 250 m every 16 days since 2000, giving a long record. Its pixels are coarse for small fields.",
      "Indice de végétation MODIS (MOD13Q1) de la NASA à 250 m tous les 16 jours depuis 2000, ce qui donne un long relevé. Ses pixels sont grossiers pour les petites parcelles.",
      "مؤشر الغطاء النباتي MODIS (MOD13Q1) لدى ناسا بدقة 250 م كل 16 يوماً منذ عام 2000، ما يعطي سجلاً طويلاً. وبكسلاته كبيرة للحقول الصغيرة.",
      "مؤشر الغطاء النباتي ديال ناسا MODIS، MOD13Q1، بدقة 250 متر كل 16 يوم من عام 2000. كيعطي سجل طويل، ولكن البكسلات ديالو كبار على القطع الصغيرة.",
    ],
  ],
  [
    "product.ecostress",
    ["ECOSTRESS", "ECOSTRESS", "ECOSTRESS", "ECOSTRESS"],
    [
      "A NASA thermal sensor on the International Space Station that measures surface temperature and an evaporative stress index at 70 m, at irregular times.",
      "Un capteur thermique de la NASA sur la Station spatiale internationale qui fournit la température de surface et un indice de stress évaporatif, avec une résolution de 70 m, à des moments irréguliers.",
      "مستشعر حراري لناسا على محطة الفضاء الدولية يقيس حرارة السطح ومؤشر إجهاد تبخري بدقة 70 م في أوقات غير منتظمة.",
      "حساس حراري ديال ناسا فوق محطة الفضاء الدولية، كيعطي حرارة السطح ومؤشر الإجهاد التبخري بدقة 70 متر، فأوقات ماشي منتظمة.",
    ],
  ],
  [
    "product.grace",
    [
      "GRACE and GRACE-FO",
      "GRACE et GRACE-FO",
      "GRACE وGRACE-FO",
      "GRACE وGRACE-FO",
    ],
    [
      "NASA gravity satellites that sense changes in the total water stored underground and on the surface over very large areas.",
      "Satellites de gravimétrie de la NASA qui détectent les variations de l'eau totale stockée sous terre et en surface sur de très grandes zones.",
      "أقمار جاذبية لناسا تستشعر تغيرات إجمالي المياه المخزنة تحت الأرض وعلى سطحها على مساحات كبيرة جداً.",
      "أقمار ديال ناسا كتقيس الجاذبية وكتلتقط التغير فمجموع الما المخزون تحت الأرض وفالسطح، على مساحات كبيرة بزاف.",
    ],
  ],
  [
    "product.gedi",
    ["GEDI", "GEDI", "GEDI", "GEDI"],
    [
      "A NASA laser instrument on the International Space Station that measures the height of vegetation. Its 1 km biomass map describes woody vegetation.",
      "Un instrument laser de la NASA sur la Station spatiale internationale qui mesure la hauteur de la végétation. Sa carte de biomasse à 1 km décrit la végétation ligneuse.",
      "جهاز ليزر لناسا على محطة الفضاء الدولية يقيس ارتفاع النباتات. وخريطة كتلته الحيوية بدقة 1 كم تصف النباتات الخشبية.",
      "جهاز ليزر ديال ناسا فوق محطة الفضاء الدولية كيقيس علو النباتات. خريطة الكتلة الحيوية ديالو بدقة 1 كلم كتوصف النباتات الخشبية.",
    ],
  ],
  [
    "product.soilgrids",
    [
      "SoilGrids soil estimate",
      "Estimation de sol SoilGrids",
      "تقدير التربة SoilGrids",
      "تقدير التربة SoilGrids",
    ],
    [
      "Global soil maps from ISRIC predicted by a model from many samples. They give a coarse estimate for a location, not a measurement of your field.",
      "Cartes mondiales des sols de l'ISRIC prédites par un modèle à partir de nombreux échantillons. Elles donnent une estimation grossière pour un emplacement, pas une mesure de votre parcelle.",
      "خرائط تربة عالمية من ISRIC يتنبأ بها نموذج انطلاقاً من عينات كثيرة. تعطي تقديراً تقريبياً لموقع، لا قياساً لحقلك.",
      "خرائط عالمية للتربة من ISRIC، محسوبة بنموذج انطلاقا من عينات كثيرة. كتعطي تقدير تقريبي للبلاصة، وماشي قياس ديال تربة القطعة ديالك.",
    ],
  ],
]);
