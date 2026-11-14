// Names recalled by the AI model for release 0.12.0 (recorded 2026-11-09).
// Nothing here is sourced: each name carries a recall record with its own
// confidence. Absent means "no name I am reasonably sure of"; those crops are
// reported as gaps in the review file instead of being filled with guesses.
//
// Crop rows: id | fr | ar | ary | confidence of ar | confidence of ary
//   fr   French name, added only when 0.11.0 has none
//   ar   Modern Standard Arabic, added only when 0.11.0 has none
//   ary  Moroccan Arabic (Darija), written in Arabic script as Moroccans
//        write it; spelling is not standardised, so a native speaker should
//        review every one (see names-for-native-review.md)
//   confidence letters: h high, m medium, l low ("-" when the name is "-")
export const CROP_NAMES = `
acacia-raddiana|-|الطلح|الطلح|m|m
acacia-saligna|-|أكاسيا سالينيا|-|l|-
aleppo-pine|-|-|الصنوبر|-|m
alfalfa|Luzerne|البرسيم الحجازي|الفصة|h|m
almond|-|-|اللوز|-|h
aloe-vera|-|-|ألوفيرا|-|m
ammi-visnaga|-|-|بشنيخة|-|l
anise|-|-|حبة حلاوة|-|m
apple|-|-|التفاح|-|h
apricot|-|المشمش|المشماش|h|h
argan|-|-|أركان|-|h
artemisia|-|-|الشيح|-|h
artichoke|-|-|الخرشف|-|m
arugula|-|-|الجرجير|-|h
asparagus|-|-|الهليون|-|m
atlas-cedar|-|-|الأرز|-|h
atriplex|-|-|القطف|-|m
avocado|-|-|الأفوكا|-|m
azarole|-|-|الزعرور|-|h
banana|-|-|الموز|-|h
bay-laurel|-|-|ورق سيدنا موسى|-|m
berseem|-|-|البرسيم|-|h
bitter-orange|-|-|النارنج|-|m
bitter-vetch|-|-|الكرسنة|-|m
black-oat|-|الشوفان الخشن|-|l|-
blackberry|-|-|العليق|-|m
borage|-|لسان الثور|لسان الثور|h|m
bottle-gourd|-|القرع القاروري|القرعة|m|m
bread-wheat|-|-|القمح الطري|-|h
broccoli|-|-|بروكولي|-|m
cabbage|-|الملفوف|الكرنب|h|h
calendula|-|الآذريون|-|m|-
camelina|-|الكاميلينا|-|l|-
cannabis|-|-|الكيف|-|h
cape-gooseberry|-|عنب الثعلب|-|m|-
caper|-|-|الكبار|-|m
caraway|-|-|الكراوية|-|m
carob|-|-|الخروب|-|h
carrot|-|الجزر|الخيزو|h|h
castor|-|-|الخروع|-|m
cauliflower|-|-|القرنبيط|-|m
celery|-|-|الكرفس|-|m
chamomile|-|-|البابونج|-|h
chard|-|-|السلق|-|m
cherry|-|-|حب الملوك|-|h
chickpea|-|-|الحمص|-|h
chilli|-|-|الفلفلة الحارة|-|m
citrus|-|الحمضيات|الحوامض|h|m
cocksfoot|-|الدكتيلس|-|l|-
coriander|-|-|القزبر|-|m
cotton|-|-|القطن|-|h
courgette|-|الكوسا|الكورجيط|h|m
cowpea|-|-|اللوبيا|-|m
cucumber|-|-|الخيار|-|m
cumin|-|-|الكمون|-|h
damask-rose|-|-|الورد البلدي|-|h
date-palm|-|-|النخلة|-|h
desert-truffle|-|-|الترفاس|-|h
dry-bean|-|-|اللوبيا|-|m
durum-wheat|-|-|القمح الصلب|-|h
dwarf-palm|-|الدوم|الدوم|m|m
eggplant|-|الباذنجان|البدنجال|h|h
endive|-|-|الهندباء|-|m
esparto|-|-|الحلفاء|-|m
eucalyptus|-|-|الكاليتوس|-|m
faba-bean|-|-|الفول|-|h
fennel|-|-|الشمر|-|m
fenugreek|-|-|الحلبة|-|h
fig|-|التين|الكرموس|h|h
finger-millet|-|الدخن الإصبعي|-|m|-
flax|-|-|الكتان|-|h
forage-rape|-|الكولزا العلفية|-|l|-
foxtail-millet|-|دخن ذيل الثعلب|-|m|-
garden-cress|-|-|حب الرشاد|-|h
garlic|-|-|التوم|-|m
grapefruit|-|الجريب فروت|-|h|-
grapevine|-|-|الدالية|-|h
grass-pea|-|-|الجلبان|-|m
green-bean|-|الفاصوليا الخضراء|اللوبيا الخضراء|h|m
groundnut|-|الفول السوداني|الكاوكاو|h|h
guava|-|-|الجوافة|-|h
hairy-vetch|-|البيقية المشعرة|-|l|-
hazelnut|-|-|البندق|-|h
hemp|-|-|القنب|-|m
henna|-|-|الحنة|-|h
holm-oak|-|-|البلوط|-|h
hyssop|-|الزوفا|الزوفا|h|m
jojoba|-|-|الجوجوبا|-|m
jujube|-|-|الزفزوف|-|m
juniper-cade|-|-|القطران|-|m
kiwi|-|-|الكيوي|-|m
lambs-lettuce|-|خس الحمل|-|m|-
lavender|-|-|الخزامة|-|m
leek|-|-|الكرات|-|m
lemon-balm|-|-|الترنجان|-|m
lemon-verbena|-|-|لويزة|-|h
lemon|-|-|الحامض|-|h
lentil|-|-|العدس|-|h
lentisk|-|-|الضرو|-|h
lettuce|-|الخس|الخس|h|h
lima-bean|-|فاصوليا ليما|-|m|-
loquat|-|-|الأكيدنيا|-|h
luffa|-|اللوفة|-|m|-
maize|Maïs|الذرة|الذرة|h|h
mallow|-|-|الخبيزة|-|h
mandarin|-|-|الماندرين|-|m
mango|-|-|المانجا|-|m
marjoram|-|-|البردقوش|-|m
marrubium|-|-|المريوة|-|h
melon|-|الشمام|البطيخ|h|h
milk-thistle|-|شوك مريم|-|l|-
mint|-|-|النعناع|-|h
mulberry|-|-|التوت|-|h
mulberry-black|-|-|التوت|-|m
mustard|-|-|الخردل|-|h
myrtle|-|-|الريحان|-|m
narrow-leaf-lupin|-|-|الترمس|-|h
nigella|-|-|السانوج|-|h
oat|-|-|الخرطال|-|l
oilseed-radish|-|الفجل الزيتي|-|m|-
okra|-|-|الباميا|-|m
oleaster|-|الزيتون البري|الزبوج|h|h
olive|-|الزيتون|الزيتون|h|h
onion|-|البصل|البصلة|h|h
oregano|-|-|الزعتر|-|m
parsley|-|-|المعدنوس|-|h
pea|-|البازلاء|الجلبانة|h|m
peach|-|الخوخ|الخوخ|h|h
pear|-|-|الإجاص|-|h
pearl-millet|-|-|الدخن|-|m
pennyroyal|-|-|الفليو|-|h
pepper|-|الفلفل الحلو|الفلفلة|h|m
perennial-ryegrass|-|الريغراس المعمر|-|m|-
persian-clover|-|البرسيم الفارسي|-|m|-
persimmon|-|-|الكاكي|-|m
phacelia|-|الفاسيليا|-|l|-
phalaris|-|الفالاريس|-|l|-
pineapple|-|-|الأناناس|-|h
pistachio|-|-|الفستق|-|m
plum|-|-|البرقوق|-|h
pomegranate|-|الرمان|الرمان|h|h
potato|-|البطاطس|البطاطا|h|h
prickly-pear|-|-|الهندية|-|h
pumpkin|-|-|القرعة الحمراء|-|m
purslane|-|-|الرجلة|-|m
quince|-|-|السفرجل|-|h
radicchio|-|الراديكيو|-|l|-
radish|-|-|الفجل|-|h
rapeseed|-|اللفت الزيتي|الكولزا|h|m
red-clover|-|البرسيم الأحمر|-|h|-
rice|-|-|الرز|-|h
rose-geranium|-|-|العطرشة|-|h
rosemary|-|-|الحصالبان|-|m
rue|-|-|الفيجل|-|h
runner-bean|-|الفاصوليا المتسلقة|-|m|-
safflower|-|-|العصفر|-|m
saffron|-|-|الزعفران|-|h
sage|-|-|الصالمية|-|h
sainfoin|-|الإسبرسيت|-|l|-
scorzonera|-|سكورزونيرا|-|l|-
sesame|Sésame|السمسم|الجنجلان|h|h
spelt|-|الإسبلت|-|l|-
spinach|-|-|السبانخ|-|m
stone-pine|-|-|الصنوبر|-|m
strawberry|-|-|الفراولة|-|h
strawberry-tree|-|القطلب|ساسنو|h|l
sugar-beet|-|الشمندر السكري|الشمندر السكري|h|m
sunflower|-|عباد الشمس|دوار الشمس|h|h
sweet-orange|-|-|البرتقال|-|m
sweet-potato|-|-|البطاطا الحلوة|-|m
sumac|-|-|السماق|-|m
table-beet|-|الشمندر الأحمر|الشمندر|h|h
tall-fescue|-|الفستوكة العالية|-|l|-
taro|-|-|القلقاس|-|m
teff|-|التيف|-|l|-
thuya|-|-|العرعار|-|h
thyme|-|-|الزعتر|-|h
tobacco|-|-|الدخان|-|m
tomato|-|الطماطم|ماطيشة|h|h
turnip|-|-|اللفت|-|h
walnut|-|-|الكركاع|-|h
watermelon|-|البطيخ|الدلاح|h|h
white-clover|-|البرسيم الأبيض|-|h|-
white-lupin|-|-|الترمس|-|h
ziziphus-lotus|-|السدرة|السدرة|h|h
sorghum|-|-|الذرة البيضاء|-|l
barley|-|-|الشعير|-|h
basil|-|-|الحبق|-|h
sorrel|-|-|الحميضة|-|m
soybean|-|-|الصوجا|-|m
sweet-corn|-|-|الذرة الحلوة|-|m
wormwood|-|-|الشيبة|-|m
`;

// Cultivar rows: "cropId/cultivarSuffix|language|name|confidence".
// The cultivar id is the part after the slash. Only cultivars with a real Arabic
// or Moroccan name are listed: international varieties keep their one name.
// "ar" here is the Arabic-script form of a name that is an Arabic word or a
// Moroccan place/person name; "ary" is used where the Moroccan form differs.
export const CULTIVAR_NAMES = `
barley/adrar|ar|أدرار|m
barley/amira|ar|أميرة|m
barley/assiya|ar|آسية|m
barley/chifaa|ar|شفاء|m
barley/firdaws|ar|فردوس|m
barley/oussama|ar|أسامة|m
barley/rihane|ar|ريحان|m
barley/tadmor|ar|تدمر|m
barley/arabi-abiad|ar|عربي أبيض|m
barley/arabi-aswad|ar|عربي أسود|m
bread-wheat/kanz|ar|كنز|m
bread-wheat/rajae|ar|رجاء|m
bread-wheat/nasma|ar|نسمة|m
bread-wheat/nesma|ar|نسمة|m
bread-wheat/kharouba|ar|خروبة|m
bread-wheat/khadija|ar|خديجة|m
bread-wheat/malika|ar|مليكة|m
bread-wheat/ibtissam|ar|ابتسام|m
bread-wheat/saada|ar|سعادة|m
bread-wheat/mehdia|ar|المهدية|m
bread-wheat/bouregreg|ar|أبي رقراق|m
bread-wheat/zaer|ar|زعير|m
bread-wheat/sais|ar|سايس|m
durum-wheat/karim|ar|كريم|m
durum-wheat/marzak|ar|مرزاق|m
durum-wheat/jawhar|ar|جوهر|m
durum-wheat/tarek|ar|طارق|m
durum-wheat/amjad|ar|أمجد|m
durum-wheat/marjana|ar|مرجانة|m
durum-wheat/faraj|ar|فرج|m
durum-wheat/louiza|ar|لويزة|m
durum-wheat/jawahir|ar|جواهر|m
durum-wheat/oum-rabia|ar|أم الربيع|m
durum-wheat/sebou|ar|سبو|m
durum-wheat/bidi-17|ar|بيدي 17|l
chickpea/bouchra|ar|بشرى|m
chickpea/bochra|ar|بشرى|m
chickpea/moubarak|ar|مبارك|m
chickpea/zahor|ar|زهور|m
chickpea/taounate|ar|تاونات|m
lentil/abda|ar|عبدة|m
lentil/bekria|ar|بكرية|m
lentil/bakria|ar|بكرية|m
lentil/karam|ar|كرم|m
lentil/jemaat-shaim|ar|جماعة اشعيم|m
faba-bean/hiba|ar|هبة|m
faba-bean/yasmine|ar|ياسمين|m
faba-bean/zina|ar|زينة|m
faba-bean/lobab|ar|لباب|m
oat/seddik|ar|صديق|m
oat/al-fawze|ar|الفوز|m
oat/nezha|ar|نزهة|m
oat/niema|ar|نعيمة|m
maize/doukkalia|ar|الدكالية|m
maize/el-abdia|ar|العبدية|m
berseem/saidi|ar|صعيدي|m
berseem/fahl|ar|فحل|m
berseem/meskawi|ar|مسكاوي|m
triticale/marwa|ar|مروى|m
triticale/ain-nzagh|ar|عين انزاغ|m
olive/picholine-marocaine|ar|البيشولين المغربية|h
olive/haouzia|ar|الحوزية|h
olive/menara|ar|المنارة|h
olive/dahbia|ar|الدهبية|h
olive/meslala|ar|المسلالة|h
date-palm/al-majhoul-mejhoul|ar|المجهول|h
date-palm/mejhoul-medjool|ar|المجهول|h
date-palm/boufakkos-boufeggous|ar|بوفكوس|h
date-palm/boufeggous|ar|بوفكوس|h
date-palm/bouskri|ar|بوسكري|h
date-palm/boustammi|ar|بوستمي|m
date-palm/jihel|ar|الجهل|m
date-palm/aziza|ar|عزيزة|m
date-palm/deglet-nour|ar|دقلة نور|h
date-palm/barhi|ar|برحي|h
date-palm/khalas|ar|خلاص|h
date-palm/zahidi|ar|زاهدي|h
date-palm/sukkari|ar|سكري|h
date-palm/ajwa|ar|عجوة|h
date-palm/hayani|ar|حياني|m
date-palm/khalt|ar|خلط|m
date-palm/najda|ar|نجدة|m
date-palm/bouittob|ar|بوعيطوب|m
fig/ghoudan|ar|غودان|l
fig/ghoudane|ar|غودان|l
fig/fassi|ar|فاسي|m
fig/nabout|ar|نبوط|l
fig/el-quoti-lbied|ar|القوطي البيض|m
fig/noukali|ar|نوكالي|l
fig/beldi-local|ar|البلدي|m
fig/beldi-local|ary|الكرموس البلدي|m
pomegranate/sefri|ar|الصفري|m
pomegranate/bzou|ar|بزو|l
pomegranate/chioukhi|ar|الشيوخي|m
pomegranate/djeibi|ar|الجيبي|l
pomegranate/zehri|ar|الزهري|m
pomegranate/zheri-precoce|ar|الزهري المبكر|l
prickly-pear/aakria|ary|العكرية|m
prickly-pear/dellahia|ary|الدلاحية|m
prickly-pear/sefra|ary|الصفرا|m
prickly-pear/mles|ary|ملس|l
prickly-pear/moussa|ary|موسى|m
prickly-pear/aissa|ary|عيسى|m
prickly-pear/derbana|ary|الدربانة|l
almond/local-seedling-beldi-populations|ar|اللوز البلدي|m
alfalfa/beldia-local-ecotype|ar|البلدية (نمط محلي)|m
alfalfa/demnat-3|ar|دمنات 3|m
alfalfa/tafilalt|ar|تافيلالت|m
cumin/local-beldi-populations|ar|الكمون البلدي|m
sweet-orange/baladi-local-orange|ar|البلدي|m
citrus/baladi-local-orange|ar|البرتقال البلدي|m
cherry/beldi-local-sefrou-from-a-search-snippet-source-not-saved|ar|حب الملوك البلدي (صفرو)|l
coriander/local-landrace-kuzbur-baladi|ar|القزبر البلدي|m
watermelon/zagora-draa-local-watermelon|ar|دلاح زاكورة ودرعة|m
watermelon/zagora-draa-local-watermelon|ary|الدلاح ديال زاكورة ودرعة|l
sesame/local-white-seeded-populations|ary|الجنجلان البلدي الأبيض|l
sesame/local-brown-dark-seeded-populations|ary|الجنجلان البلدي الداكن|l
saffron/taliouine-clonal-population|ar|زعفران تالوين|m
damask-rose/rosa-damascena-kelaat-m-gouna-population-pdo-area|ar|ورد قلعة مكونة|m
chives/local-common-chives-ciboulette-commune-per-pntta-bulletin-96|ar|الثوم المعمر البلدي|l
thyme/thymus-satureioides-zaatar-azukenni|ar|الزعتر (أزوكني)|m
oregano/origanum-compactum-moroccan-oregano-zaatar-mostly-wild|ar|الزعتر المغربي (بري)|m
mint/pennyroyal-mentha-pulegium-fliou|ar|الفليو|m
mint/mentha-suaveolens-timija|ary|تيمجا|l
mint/nana-mentha-spicata-spearmint|ar|النعناع النانا|l
cannabis/beldia-traditional-rif-landrace-as-recalled|ar|البلدية (نمط الريف التقليدي)|l
cladanthus/wild-moroccan-chamomile-babounj|ar|بابونج مغربي بري|m
ammi-visnaga/wild-khella-besnika|ar|الخلة (بشنيخة)|m
artemisia/wild-oriental-steppe-chih|ar|الشيح (بري)|m
cistus/wild-ladanum-jaa|ar|الجعد (بري)|l
jujube/ziziphus-lotus-wild-sedra|ar|السدرة (بري)|m
mulberry/morus-nigra-black-mulberry-local|ar|التوت الأسود البلدي|m
mulberry/morus-alba-white-mulberry|ar|التوت الأبيض|m
lavender/lavandula-stoechas-wild-moroccan|ar|الخزامى الجبلية (بري)|l
lavender/lavandula-dentata|ar|الخزامى المسننة|l
`;
