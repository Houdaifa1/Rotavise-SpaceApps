// Further crop problems recalled by the AI model (unverified). Fields:
//   id | kind | name | French name | scientific name | host crops (comma) |
//   visible signs | minimum break in years without hosts
// "-" means not recalled. The builder skips an id or organism already in the
// catalog. No treatment, product or dose is recorded anywhere.
export const ISSUES = `
puccinia-triticina | disease | Leaf rust of wheat | Rouille brune du blé | Puccinia triticina | durum-wheat,bread-wheat,triticale,spelt | Small round orange-brown pustules scattered on the upper leaf surface. | -
puccinia-graminis-tritici | disease | Stem rust of wheat | Rouille noire du blé | Puccinia graminis f. sp. tritici | durum-wheat,bread-wheat,barley,triticale | Elongated dark red-brown pustules that tear the stem and leaf sheath surface. | -
puccinia-hordei | disease | Leaf rust of barley | Rouille naine de l'orge | Puccinia hordei | barley | Small orange-brown pustules on the leaves, mostly on the upper side. | -
puccinia-coronata | disease | Crown rust of oat and ryegrass | Rouille couronnée | Puccinia coronata | oat,italian-ryegrass,perennial-ryegrass | Bright orange oval pustules on the leaves. | -
zymoseptoria-tritici | disease | Septoria leaf blotch | Septoriose du blé | Zymoseptoria tritici | durum-wheat,bread-wheat,triticale | Pale brown blotches with tiny black dots (pycnidia) starting on lower leaves. | 2
parastagonospora-nodorum | disease | Septoria glume blotch | Septoriose des glumes | Parastagonospora nodorum | durum-wheat,bread-wheat | Brown lens-shaped lesions on leaves and dark blotches on the ears. | 2
pyrenophora-tritici-repentis | disease | Tan spot of wheat | Hélminthosporiose du blé | Pyrenophora tritici-repentis | durum-wheat,bread-wheat | Tan oval spots with a yellow halo and a dark centre on the leaves. | 2
pyrenophora-teres | disease | Net blotch of barley | Hélminthosporiose en filet de l'orge | Pyrenophora teres | barley | Brown net-like or spot-like streaks on the leaves with yellow edges. | 2
rhynchosporium-secalis | disease | Barley scald | Rhynchosporiose de l'orge | Rhynchosporium secalis | barley,rye | Greyish blue-green blotches that dry to straw colour with a dark brown edge. | 2
fusarium-graminearum | disease | Fusarium head blight | Fusariose de l'épi | Fusarium graminearum | durum-wheat,bread-wheat,barley,maize,oat,triticale | Bleached spikelets in the ear, pink-orange spore masses, shrivelled grains. | 2
gaeumannomyces-tritici | disease | Take-all | Piétin échaudage | Gaeumannomyces tritici | durum-wheat,bread-wheat,barley,triticale | Patches of stunted whitened plants and black-brown roots and stem base. | 2
oculimacula-yallundae | disease | Eyespot of cereals | Piétin-verse | Oculimacula yallundae | durum-wheat,bread-wheat,barley,rye | Eye-shaped lesions on the stem base and lodging of the stems. | 2
tilletia-caries | disease | Common bunt of wheat | Carie du blé | Tilletia caries | durum-wheat,bread-wheat,spelt | Grains replaced by dark powdery spore balls smelling of fish. | 2
ustilago-nuda | disease | Loose smut of barley | Charbon nu de l'orge | Ustilago nuda | barley | Ears replaced by black powdery spore masses that blow away. | -
ustilago-tritici | disease | Loose smut of wheat | Charbon nu du blé | Ustilago tritici | durum-wheat,bread-wheat | Ears replaced by black powdery spore masses leaving bare stalks. | -
heterodera-avenae | pest | Cereal cyst nematode | Nématode à kyste des céréales | Heterodera avenae | durum-wheat,bread-wheat,barley,oat,triticale,rye | Patches of stunted yellowing plants with bushy shallow roots and small white cysts. | 3
heterodera-filipjevi | pest | Cereal cyst nematode (cereal cyst, filipjevi type) | Nématode à kyste des céréales | Heterodera filipjevi | durum-wheat,bread-wheat,barley | Stunted yellowing patches with knotted roots bearing small white cysts. | 3
pratylenchus-thornei | pest | Root lesion nematode | Nématode des lésions racinaires | Pratylenchus thornei | durum-wheat,bread-wheat,chickpea,lentil | Poor stunted patches with brown lesions on the roots. | 3
sitobion-avenae | pest | English grain aphid | Puceron des épis | Sitobion avenae | durum-wheat,bread-wheat,barley,oat,triticale | Green to brown aphids on ears and upper leaves with honeydew. | -
rhopalosiphum-padi | pest | Bird cherry-oat aphid | Puceron du merisier à grappes | Rhopalosiphum padi | durum-wheat,bread-wheat,barley,oat,maize,rye | Dark green aphids at the base of leaves and stems; yellowing from virus transmission. | -
schizaphis-graminum | pest | Greenbug | Puceron vert des céréales | Schizaphis graminum | durum-wheat,bread-wheat,barley,sorghum,oat | Pale green aphids on leaves with red-brown spots and yellowing. | -
aelia-germari | pest | Sunn pest (Aelia) | Punaise des céréales (Aelia) | Aelia germari | durum-wheat,bread-wheat,barley | Brown shield bugs; shrivelled grains and white empty ears. | -
eurygaster-maura | pest | Sunn pest (Eurygaster) | Punaise des céréales (Eurygaster) | Eurygaster maura | durum-wheat,bread-wheat,barley | Brown shield bugs; withered tillers and damaged shrivelled grains. | -
cephus-pygmaeus | pest | Wheat stem sawfly | Cèphe des céréales | Cephus pygmaeus | durum-wheat,bread-wheat,barley,rye | Hollowed stems that break below the ear and white heads. | -
zabrus-tenebrioides | pest | Cereal ground beetle | Zabre des céréales | Zabrus tenebrioides | durum-wheat,bread-wheat,barley | Shredded leaves and young plants pulled down into burrows. | -
haplothrips-tritici | pest | Wheat thrips | Thrips du blé | Haplothrips tritici | durum-wheat,bread-wheat,barley | Small black thrips in the ear; shrivelled and white grains. | -
meriones-shawi | pest | Shaw's jird | Mérione de Shaw | Meriones shawi | durum-wheat,bread-wheat,barley,oat,faba-bean,chickpea,lentil | Burrow holes and cut plants in patches; stored grain eaten. | -
theba-pisana | pest | White garden snail | Escargot des dunes | Theba pisana | durum-wheat,bread-wheat,barley,citrus,faba-bean,lentil,chickpea,alfalfa | Gnawed leaves and slime trails; snails clustered on stems and fences. | -
sitophilus-granarius | pest | Granary weevil | Charançon du grain | Sitophilus granarius | durum-wheat,bread-wheat,barley,maize,rice,oat,rye | Small round holes in stored grains and a flour-like dust. | -
rhyzopertha-dominica | pest | Lesser grain borer | Grand capucin des grains | Rhyzopertha dominica | durum-wheat,bread-wheat,barley,maize,rice | Hollowed stored grains and fine powdery dust. | -
tribolium-castaneum | pest | Red flour beetle | Tribolium rouge de la farine | Tribolium castaneum | durum-wheat,bread-wheat,barley,maize,rice,groundnut | Reddish-brown beetles in flour and a tainted smell. | -
ephestia-kuehniella | pest | Mediterranean flour moth | Pyrale de la farine | Ephestia kuehniella | durum-wheat,bread-wheat,barley,maize,rice | Silken webbing and clumped flour with small caterpillars. | -
spodoptera-littoralis | pest | Cotton leafworm | Noctuelle égyptienne | Spodoptera littoralis | cotton,tomato,potato,pepper,maize,alfalfa,berseem,groundnut,green-bean,sugar-beet | Large ragged holes in leaves, caterpillars at night, and damaged fruit. | -
spodoptera-exigua | pest | Beet armyworm | Noctuelle du chou | Spodoptera exigua | sugar-beet,tomato,pepper,onion,cotton,table-beet,lettuce,spinach | Skeletonised leaves and caterpillars in clusters or boring into fruit. | -
spodoptera-frugiperda | pest | Fall armyworm | Légionnaire d'automne | Spodoptera frugiperda | maize,sorghum,rice,pearl-millet,sweet-corn | Ragged leaf windows and frass in the whorl. | -
agrotis-ipsilon | pest | Black cutworm | Ver gris noir | Agrotis ipsilon | maize,potato,tomato,pepper,lettuce,cabbage,sugar-beet,cotton,sunflower | Young plants cut at ground level. | -
sesamia-nonagrioides | pest | Mediterranean corn borer | Sésamie du maïs | Sesamia nonagrioides | maize,sorghum,rice,sugarcane,sweet-corn | Bored stalks with frass, dead hearts and broken stems. | -
rhopalosiphum-maidis | pest | Corn leaf aphid | Puceron du maïs | Rhopalosiphum maidis | maize,sorghum,barley,sweet-corn | Bluish-green aphids in the whorl and tassel with honeydew. | -
puccinia-sorghi | disease | Common rust of maize | Rouille commune du maïs | Puccinia sorghi | maize,sweet-corn | Brown powdery pustules on both leaf surfaces. | -
bipolaris-maydis | disease | Southern leaf blight | Hélminthosporiose du maïs | Bipolaris maydis | maize,sweet-corn | Tan elongated lesions with brown margins on the leaves. | 2
ustilago-maydis | disease | Common smut of maize | Charbon commun du maïs | Ustilago maydis | maize,sweet-corn | Silvery-white swollen galls that turn black and powdery on ears and stalks. | 2
fusarium-verticillioides | disease | Fusarium ear rot | Fusariose de l'épi du maïs | Fusarium verticillioides | maize,sweet-corn,sorghum | Pink or white mould on kernels and a streaked "starburst" pattern. | 2
sphacelotheca-reiliana | disease | Head smut of maize and sorghum | Charbon des inflorescences | Sporisorium reilianum | maize,sorghum | Ears or panicles replaced by black spore masses with fibres. | 2
rhizoctonia-solani | disease | Rhizoctonia root and stem rot | Rhizoctone | Rhizoctonia solani | potato,sugar-beet,table-beet,bean,green-bean,dry-bean,lettuce,rice,tomato,pepper,carrot,cabbage,cotton | Brown sunken lesions on stems and roots; damping-off and black scurf on tubers. | 3
sclerotinia-sclerotiorum | disease | White mould (Sclerotinia) | Sclérotiniose | Sclerotinia sclerotiorum | sunflower,rapeseed,lettuce,tomato,pepper,eggplant,bean,green-bean,pea,carrot,cabbage,faba-bean,chickpea,lentil,cucumber,courgette,melon | White cottony mould with hard black sclerotia in stems, heads and fruit. | 4
sclerotinia-minor | disease | Lettuce drop (Sclerotinia minor) | Sclérotiniose du laitue | Sclerotinia minor | lettuce,carrot,celery,groundnut,endive | Wilting plants with white mould and small black sclerotia at the crown. | 4
sclerotium-rolfsii | disease | Southern blight | Pourriture à sclérotes | Sclerotium rolfsii | tomato,pepper,groundnut,bean,potato,carrot,beet,melon,watermelon | White fan-like mould and round brown seed-like sclerotia at the stem base. | 4
verticillium-dahliae | disease | Verticillium wilt | Verticilliose | Verticillium dahliae | olive,tomato,potato,eggplant,pepper,cotton,sunflower,strawberry,almond,apricot,watermelon,mint | Yellowing wilting leaves on one side, vascular browning in the stem, dieback. | 4
pythium-damping-off | disease | Pythium damping-off | Fonte des semis (Pythium) | Pythium spp. | tomato,pepper,cucumber,courgette,melon,watermelon,beet,sugar-beet,lettuce,spinach,bean,green-bean,pea | Seedlings rot at ground level and collapse; water-soaked brown roots. | 3
ralstonia-solanacearum | disease | Bacterial wilt | Flétrissement bactérien | Ralstonia solanacearum | potato,tomato,eggplant,pepper | Sudden wilting of green plants and brown vascular ring with bacterial ooze. | 4
clavibacter-michiganensis | disease | Bacterial canker of tomato | Chancre bactérien de la tomate | Clavibacter michiganensis subsp. michiganensis | tomato | Marginal leaf scorch, one-sided wilting and white-ringed fruit spots. | 3
xanthomonas-vesicatoria | disease | Bacterial spot of tomato and pepper | Tache bactérienne | Xanthomonas vesicatoria | tomato,pepper | Small water-soaked spots turning dark with scabby raised fruit lesions. | 2
pseudomonas-syringae-tomato | disease | Bacterial speck of tomato | Moucheture bactérienne | Pseudomonas syringae pv. tomato | tomato | Tiny black specks with a yellow halo on leaves and fruit. | 2
fusarium-oxysporum-lycopersici | disease | Fusarium wilt of tomato | Fusariose vasculaire de la tomate | Fusarium oxysporum f. sp. lycopersici | tomato | Yellowing and wilting of lower leaves on one side and browned vessels. | 4
pyrenochaeta-lycopersici | disease | Corky root of tomato | Racine liégeuse | Pyrenochaeta lycopersici | tomato,eggplant,pepper,melon | Rough corky brown roots and stunted yellowing plants. | 4
tomato-yellow-leaf-curl-virus | disease | Tomato yellow leaf curl virus | Virus des feuilles en cuillère (TYLCV) | Tomato yellow leaf curl virus | tomato,pepper,green-bean | Upward-curled yellowing small leaves, stunting and flower drop. | -
tomato-spotted-wilt-virus | disease | Tomato spotted wilt virus | Virus de la maladie bronzée | Tomato spotted wilt virus | tomato,pepper,lettuce,potato,eggplant | Bronzed ring-spotted leaves and mottled ring-marked fruit. | -
tomato-brown-rugose-fruit-virus | disease | Tomato brown rugose fruit virus | Virus du fruit rugueux brun | Tomato brown rugose fruit virus | tomato,pepper | Mosaic leaves and brown rugose spots or yellow patches on fruit. | -
cucumber-mosaic-virus | disease | Cucumber mosaic virus | Virus de la mosaïque du concombre | Cucumber mosaic virus | cucumber,melon,courgette,pepper,tomato,lettuce,spinach,bean,celery,gherkin | Mosaic, leaf distortion and narrowing (shoestring), stunting. | -
potato-virus-y | disease | Potato virus Y | Virus Y de la pomme de terre | Potato virus Y | potato,tomato,pepper,tobacco | Mosaic, leaf crinkling and necrotic spots; tuber ring necrosis in some strains. | -
potato-leafroll-virus | disease | Potato leafroll virus | Virus de l'enroulement | Potato leafroll virus | potato | Upward rolling of the leaves, leathery stiffness and net necrosis of tubers. | -
streptomyces-scabies | disease | Common scab of potato | Gale commune | Streptomyces scabies | potato,carrot,table-beet,radish | Rough corky scabby patches on tubers. | 3
spongospora-subterranea | disease | Powdery scab of potato | Gale poudreuse | Spongospora subterranea | potato,tomato | Raised pustules that burst to a powdery brown mass on tubers; root galls. | 4
globodera-rostochiensis | pest | Potato cyst nematode | Nématode doré | Globodera rostochiensis | potato,tomato,eggplant | Patchy stunted yellowing plants with golden-yellow cysts on roots. | 5
phthorimaea-operculella | pest | Potato tuber moth | Teigne de la pomme de terre | Phthorimaea operculella | potato,tomato,eggplant,tobacco,pepper | Mined leaves and winding tunnels in tubers with frass. | -
macrosiphum-euphorbiae | pest | Potato aphid | Puceron de la pomme de terre | Macrosiphum euphorbiae | potato,tomato,pepper,lettuce,bean | Large pink or green aphids on shoots with honeydew. | -
thrips-tabaci | pest | Onion thrips | Thrips de l'oignon | Thrips tabaci | onion,garlic,leek,shallot,spring-onion,cabbage,cucumber,cotton,tobacco | Silvery streaks on leaves, twisted tips and scarred bulbs. | -
tetranychus-urticae | pest | Two-spotted spider mite | Tétranyque tisserand | Tetranychus urticae | tomato,pepper,eggplant,cucumber,melon,watermelon,courgette,green-bean,strawberry,cotton,apple,pear,almond,peach,grapevine,citrus | Fine yellow stippling, bronzing and silk webbing under the leaves. | -
polyphagotarsonemus-latus | pest | Broad mite | Acarien jaune | Polyphagotarsonemus latus | pepper,chilli,eggplant,cucumber,tomato,potato | Curled hardened leaves with bronzing and distorted fruit. | -
aculops-lycopersici | pest | Tomato russet mite | Acarien de la rouille de la tomate | Aculops lycopersici | tomato,potato,eggplant,pepper | Bronzed stems and leaves, leaf drop from the base up. | -
trialeurodes-vaporariorum | pest | Greenhouse whitefly | Aleurode des serres | Trialeurodes vaporariorum | tomato,cucumber,green-bean,eggplant,pepper,melon,lettuce,strawberry | White flies under the leaves, honeydew and sooty mould. | -
aleyrodes-proletella | pest | Cabbage whitefly | Aleurode du chou | Aleyrodes proletella | cabbage,kale,broccoli,cauliflower,brussels-sprout,lettuce | White powdery flies and sooty mould under the leaves. | -
podosphaera-xanthii | disease | Powdery mildew of cucurbits | Oïdium des cucurbitacées | Podosphaera xanthii | cucumber,melon,watermelon,courgette,pumpkin,gherkin,bottle-gourd | White powdery patches on both leaf surfaces and early leaf death. | -
pseudoperonospora-cubensis | disease | Downy mildew of cucurbits | Mildiou des cucurbitacées | Pseudoperonospora cubensis | cucumber,melon,watermelon,courgette,pumpkin,gherkin | Angular yellow patches on leaves with grey-purple fuzz beneath. | 2
fusarium-oxysporum-melonis | disease | Fusarium wilt of melon | Fusariose du melon | Fusarium oxysporum f. sp. melonis | melon | One-sided yellowing and wilting of runners with brown vessels. | 5
fusarium-oxysporum-niveum | disease | Fusarium wilt of watermelon | Fusariose de la pastèque | Fusarium oxysporum f. sp. niveum | watermelon | Wilting of runners from the base, brown vessels, dead vines. | 5
monosporascus-cannonballus | disease | Melon vine decline | Collapse du melon | Monosporascus cannonballus | melon,watermelon | Sudden collapse near harvest with rotted brown roots and tiny black spore balls. | 4
didymella-bryoniae | disease | Gummy stem blight | Chancre gommeux | Didymella bryoniae | cucumber,melon,watermelon,courgette,pumpkin | Brown stem cankers oozing gum and dark spots on leaves and fruit. | 2
zucchini-yellow-mosaic-virus | disease | Zucchini yellow mosaic virus | Virus de la mosaïque jaune de la courgette | Zucchini yellow mosaic virus | courgette,melon,cucumber,pumpkin,watermelon | Yellow mosaic, leaf distortion and knobby deformed fruit. | -
uromyces-fabae | disease | Rust of faba bean | Rouille de la fève | Uromyces viciae-fabae | faba-bean,lentil,pea,common-vetch | Small brown powdery pustules on leaves and stems. | 3
orobanche-crenata | parasitic_plant | Broomrape of legumes | Orobanche de la fève | Orobanche crenata | faba-bean,lentil,pea,carrot,common-vetch,chickpea,grass-pea | Pale-yellow flowering spikes emerging from the soil beside the crop; stunted plants. | 5
orobanche-foetida | parasitic_plant | Broomrape (foetid) of legumes | Orobanche fétide | Orobanche foetida | faba-bean,chickpea,lentil | Purple-brown flowering spikes with a foul smell near the crop base. | 5
bruchus-rufimanus | pest | Broad bean weevil | Bruche de la fève | Bruchus rufimanus | faba-bean | Round exit holes in stored seeds. | -
bruchus-pisorum | pest | Pea weevil | Bruche du pois | Bruchus pisorum | pea | Round exit holes in dry seeds and hollowed seeds. | -
sitona-lineatus | pest | Pea leaf weevil | Sitone du pois | Sitona lineatus | pea,faba-bean,lentil,alfalfa,white-lupin,common-vetch | U-shaped notches along the leaf edges and gnawed seedlings. | -
etiella-zinckenella | pest | Pod borer (Etiella) | Pyrale des gousses | Etiella zinckenella | lentil,chickpea,pea,lima-bean,soybean,faba-bean | Webbed pods with frass and bored seeds. | -
aphanomyces-euteiches | disease | Pea root rot | Pourriture racinaire du pois | Aphanomyces euteiches | pea,lentil,faba-bean | Yellowing stunted plants with honey-brown soft rotted roots. | 6
peronospora-viciae | disease | Downy mildew of pea | Mildiou du pois | Peronospora viciae | pea,faba-bean,lentil | Yellow patches on leaves with grey-violet fuzz beneath. | 3
bean-yellow-mosaic-virus | disease | Bean yellow mosaic virus | Virus de la mosaïque jaune du haricot | Bean yellow mosaic virus | faba-bean,pea,lentil,green-bean,dry-bean,white-lupin | Yellow mosaic and leaf curling, stunting and distorted pods. | -
fusarium-oxysporum-lentis | disease | Fusarium wilt of lentil | Fusariose de la lentille | Fusarium oxysporum f. sp. lentis | lentil | Yellowing and drooping of leaflets and dead patches of plants. | 5
stemphylium-botryosum | disease | Stemphylium blight of lentil | Stemphyliose | Stemphylium botryosum | lentil,pea,faba-bean | Small tan spots on leaves that spread to leaf drop. | 3
xanthomonas-axonopodis-phaseoli | disease | Common bacterial blight of bean | Graisse commune du haricot | Xanthomonas axonopodis pv. phaseoli | green-bean,dry-bean,runner-bean,lima-bean | Large irregular water-soaked spots turning brown with yellow borders. | 2
pseudomonas-syringae-phaseolicola | disease | Halo blight of bean | Graisse à halo | Pseudomonas syringae pv. phaseolicola | green-bean,dry-bean,runner-bean,lima-bean | Small water-soaked spots surrounded by a pale yellow halo. | 2
uromyces-appendiculatus | disease | Rust of bean | Rouille du haricot | Uromyces appendiculatus | green-bean,dry-bean,runner-bean | Reddish-brown powdery pustules on the lower leaf surface. | 2
alternaria-brassicicola | disease | Dark leaf spot of brassicas | Alternariose des crucifères | Alternaria brassicicola | cabbage,cauliflower,broccoli,kale,radish,turnip,mustard,brussels-sprout | Dark spots with concentric rings and sooty spore masses. | 2
xanthomonas-campestris-campestris | disease | Black rot of brassicas | Nervation noire | Xanthomonas campestris pv. campestris | cabbage,cauliflower,broccoli,kale,radish,turnip,kohlrabi,brussels-sprout,chinese-cabbage | V-shaped yellow wedges on leaf margins and blackened veins. | 3
mycosphaerella-brassicicola | disease | Ring spot of brassicas | Cercosporiose des crucifères | Mycosphaerella brassicicola | cabbage,cauliflower,broccoli,kale,brussels-sprout | Round spots with concentric rings and black dots on older leaves. | 2
pieris-rapae | pest | Small white butterfly | Piéride de la rave | Pieris rapae | cabbage,cauliflower,broccoli,kale,radish,turnip,mustard | Green caterpillars eating holes in leaves and fouling the heart. | -
mamestra-brassicae | pest | Cabbage moth | Noctuelle du chou | Mamestra brassicae | cabbage,cauliflower,broccoli,kale,lettuce,tomato,pea | Caterpillars boring into heads and ragged leaves with frass. | -
lipaphis-erysimi | pest | Turnip aphid | Puceron de la moutarde | Lipaphis erysimi | radish,turnip,mustard,cabbage,rapeseed | Greyish aphids on leaf undersides and curled leaves. | -
meligethes-aeneus | pest | Pollen beetle | Méligèthe du colza | Brassicogethes aeneus | rapeseed,mustard,camelina | Small shiny beetles in flower buds that drop or fail to open. | -
phyllotreta-flea-beetles | pest | Crucifer flea beetles | Altises des crucifères | Phyllotreta cruciferae | rapeseed,radish,turnip,cabbage,mustard,arugula,kale,chinese-cabbage | Small round holes in cotyledons and young leaves. | -
botrytis-allii | disease | Neck rot of onion | Pourriture du collet | Botrytis allii | onion,garlic,shallot,leek | Soft grey rot beginning at the neck with grey mould in storage. | 3
botrytis-squamosa | disease | Botrytis leaf blight of onion | Brûlure des feuilles de l'oignon | Botrytis squamosa | onion,shallot,spring-onion | White oval spots with a pale halo on the leaves. | 3
sclerotium-cepivorum | disease | White rot of onion and garlic | Pourriture blanche | Stromatinia cepivora | onion,garlic,leek,shallot,spring-onion,chives | Yellowing leaves, white fluffy mould and tiny black sclerotia at the bulb base. | 8
fusarium-oxysporum-cepae | disease | Fusarium basal rot | Fusariose de l'oignon | Fusarium oxysporum f. sp. cepae | onion,garlic,shallot,leek | Yellowing leaf tips, brown rotted basal plate and soft bulbs. | 4
puccinia-allii | disease | Rust of garlic and leek | Rouille de l'ail et du poireau | Puccinia allii | garlic,leek,onion,chives,shallot | Orange raised pustules on leaves. | 3
alternaria-porri | disease | Purple blotch of onion | Alternariose de l'oignon | Alternaria porri | onion,garlic,leek,shallot | Purple-centred spots with yellow edges on the leaves. | 2
urocystis-cepulae | disease | Onion smut | Charbon de l'oignon | Urocystis cepulae | onion,shallot,leek,spring-onion | Black streaks and blisters on leaves and bulb scales of seedlings. | 5
delia-antiqua | pest | Onion fly | Mouche de l'oignon | Delia antiqua | onion,garlic,leek,shallot,spring-onion | Maggots rotting seedling and bulb bases; wilting plants. | 3
onion-yellow-dwarf-virus | disease | Onion yellow dwarf virus | Virus de la jaunisse nanisante de l'oignon | Onion yellow dwarf virus | onion,garlic,shallot,leek | Yellow streaks, flattened wavy leaves and stunting. | -
cercospora-carotae | disease | Cercospora leaf spot of carrot | Cercosporiose de la carotte | Cercospora carotae | carrot,parsley,celery,parsnip | Small tan spots with yellow halo and twisted leaf stalks. | 2
septoria-apiicola | disease | Late blight of celery | Septoriose du céleri | Septoria apiicola | celery,celeriac,parsley | Small yellow spots turning brown with tiny black dots on the leaves. | 2
cercospora-apii | disease | Early blight of celery | Cercosporiose du céleri | Cercospora apii | celery,celeriac | Pale yellow-green spots turning grey-brown on the leaves. | 2
septoria-lactucae | disease | Septoria leaf spot of lettuce | Septoriose de la laitue | Septoria lactucae | lettuce,endive,radicchio | Small angular brown spots with yellow edges on older leaves. | 2
xanthomonas-campestris-vitians | disease | Bacterial leaf spot of lettuce | Tache bactérienne de la laitue | Xanthomonas campestris pv. vitians | lettuce,endive,radicchio | Small angular water-soaked spots turning black with yellow borders. | 2
pemphigus-bursarius | pest | Lettuce root aphid | Puceron lanigère de la laitue | Pemphigus bursarius | lettuce,endive,radicchio | Wilting plants with waxy white aphids on roots. | 2
ramularia-beticola | disease | Ramularia leaf spot of beet | Ramulariose de la betterave | Ramularia beticola | sugar-beet,table-beet,chard,fodder-beet | Pale spots with a white-grey fringe and brown centre on leaves. | 2
uromyces-betae | disease | Rust of beet | Rouille de la betterave | Uromyces betae | sugar-beet,table-beet,chard,fodder-beet | Small orange-brown powdery pustules on the leaves. | 2
aphanomyces-cochlioides | disease | Black root of beet | Aphanomycose de la betterave | Aphanomyces cochlioides | sugar-beet,table-beet,spinach,fodder-beet | Damping-off of seedlings and blackened thread-like roots. | 4
beet-necrotic-yellow-vein-virus | disease | Rhizomania | Rhizomanie | Beet necrotic yellow vein virus | sugar-beet,table-beet,chard,spinach,fodder-beet | Yellow veins, proliferation of fine roots, a beard-like root and wilting. | 6
beet-mild-yellowing-virus | disease | Beet mild yellowing virus | Virus de la jaunisse modérée de la betterave | Beet mild yellowing virus | sugar-beet,table-beet,spinach,chard,lettuce,fodder-beet | Yellowing of older leaves that become thick and brittle. | -
scrobipalpa-ocellatella | pest | Beet moth | Teigne de la betterave | Scrobipalpa ocellatella | sugar-beet,table-beet,chard,fodder-beet | Mined leaves and heart damage with webbed brown tunnels. | -
heterodera-schachtii | pest | Beet cyst nematode | Nématode à kyste de la betterave | Heterodera schachtii | sugar-beet,table-beet,spinach,cabbage,radish,turnip,fodder-beet | Patches of stunted wilting plants, bearded roots and lemon-shaped cysts. | 5
atomaria-linearis | pest | Pygmy mangold beetle | Atomaire de la betterave | Atomaria linearis | sugar-beet,table-beet,fodder-beet | Seedlings with blackened holes and damaged growing points. | 2
sclerotinia-head-rot-sunflower | disease | Sunflower head rot | Pourriture du capitule | Sclerotinia sclerotiorum (head rot) | sunflower | Soft brown head rot with white mould and black sclerotia between seeds. | 4
puccinia-helianthi | disease | Sunflower rust | Rouille du tournesol | Puccinia helianthi | sunflower | Brown powdery pustules on the lower surfaces of leaves. | 2
alternaria-helianthi | disease | Alternaria leaf spot of sunflower | Alternariose du tournesol | Alternaria helianthi | sunflower | Dark brown spots with yellow halo on the leaves that join up. | 2
rhizoctonia-oryzae-sheath-blight | disease | Sheath blight of rice | Pourriture des gaines du riz | Rhizoctonia solani AG1-IA | rice | Oval grey-green sheath lesions with brown margins that spread up the plant. | 2
fusarium-fujikuroi | disease | Bakanae of rice | Bakanae | Fusarium fujikuroi | rice | Tall pale spindly seedlings that die or lodge. | 2
chilo-suppressalis | pest | Rice stripe stem borer | Foreur du riz | Chilo suppressalis | rice | Dead hearts in tillers and white empty panicles. | -
lissorhoptrus-oryzophilus | pest | Rice water weevil | Charançon aquatique du riz | Lissorhoptrus oryzophilus | rice | Elongated white scars on leaves and pruned roots. | -
cyperus-difformis | weed | Smallflower umbrella sedge | Souchet à fleurs variables | Cyperus difformis | rice | Dense clumps of small sedges in flooded fields. | -
oryza-sativa-weedy | weed | Weedy red rice | Riz rouge adventice | Oryza sativa f. spontanea | rice | Tall red-grained off-types shattering grain ahead of the crop. | -
fusarium-oxysporum-vasinfectum | disease | Fusarium wilt of cotton | Fusariose du cotonnier | Fusarium oxysporum f. sp. vasinfectum | cotton | Yellowing and wilting with brown vascular streaks. | 5
pectinophora-gossypiella | pest | Pink bollworm | Ver rose du cotonnier | Pectinophora gossypiella | cotton | Pink caterpillars inside bolls, rosetted flowers and stained lint. | -
earias-insulana | pest | Spiny bollworm | Ver épineux du cotonnier | Earias insulana | cotton,okra,roselle | Bored shoots and shed squares and bolls. | -
puccinia-arachidis | disease | Groundnut rust | Rouille de l'arachide | Puccinia arachidis | groundnut | Orange-brown pustules on the lower leaf surface. | 2
aspergillus-flavus | disease | Aspergillus ear and pod mould | Moisissure à Aspergillus | Aspergillus flavus | groundnut,maize,cotton,date-palm,almond,pistachio,fig | Greenish-yellow powdery mould on kernels and pods; storage rot. | -
spilocaea-oleaginea | disease | Olive peacock spot | Oeil de paon | Venturia oleaginea | olive | Dark circular spots with a yellow halo on the upper leaf surface and leaf drop. | -
pseudomonas-savastanoi | disease | Olive knot | Tuberculose de l'olivier | Pseudomonas savastanoi pv. savastanoi | olive,oleaster | Rough woody galls on twigs and branches. | -
colletotrichum-acutatum-olive | disease | Olive anthracnose | Anthracnose de l'olive | Colletotrichum acutatum (olive) | olive | Sunken brown fruit lesions with orange spore masses and mummified fruit. | -
prays-oleae | pest | Olive moth | Teigne de l'olivier | Prays oleae | olive | Mined leaves, bored buds and dropped fruit. | -
saissetia-oleae | pest | Black scale | Cochenille noire de l'olivier | Saissetia oleae | olive,citrus,almond,fig,pomegranate | Black hemispherical scales on twigs with honeydew and sooty mould. | -
phloeotribus-scarabaeoides | pest | Olive bark beetle | Hylésine de l'olivier | Phloeotribus scarabaeoides | olive | Small holes and galleries under the bark of pruned and weak branches. | -
rosellinia-necatrix | disease | White root rot | Pourridié blanc | Rosellinia necatrix | olive,almond,apple,pear,avocado,grapevine,fig | White fan mycelium on roots, wilting and sudden collapse of trees. | 8
alternaria-alternata-citrus | disease | Alternaria brown spot of mandarins | Alternariose des agrumes | Alternaria alternata | citrus,mandarin,sweet-orange | Dark brown spots with yellow halos on leaves and fruit and early drop. | -
penicillium-digitatum | disease | Green mould of citrus | Moisissure verte | Penicillium digitatum | citrus,mandarin,sweet-orange,lemon,grapefruit | Soft rot of stored fruit with an olive-green spore mass and white margin. | -
penicillium-italicum | disease | Blue mould of citrus | Moisissure bleue | Penicillium italicum | citrus,mandarin,sweet-orange,lemon,grapefruit | Soft rot of stored fruit with a blue-green spore mass. | -
elsinoe-fawcettii | disease | Citrus scab | Gale des agrumes | Elsinoe fawcettii | citrus,mandarin,lemon,grapefruit | Warty raised corky scabs on leaves and fruit. | -
chrysomphalus-dictyospermi | pest | Dictyospermum scale | Pou rouge de Floride | Chrysomphalus dictyospermi | citrus,mandarin,sweet-orange,lemon | Round brown scales on leaves and fruit with yellow spots. | -
lepidosaphes-beckii | pest | Purple scale | Cochenille virgule | Lepidosaphes beckii | citrus,mandarin,sweet-orange,lemon | Mussel-shaped brown scales on leaves and fruit. | -
aleurothrixus-floccosus | pest | Woolly whitefly | Aleurode floconneux | Aleurothrixus floccosus | citrus,mandarin,sweet-orange,lemon,guava | White waxy wool under the leaves and sooty mould. | -
aphis-spiraecola | pest | Green citrus aphid | Puceron vert des agrumes | Aphis spiraecola | citrus,mandarin,sweet-orange,apple,pear,loquat,lemon | Green aphids on shoots with curled leaves and honeydew. | -
panonychus-citri | pest | Citrus red mite | Tétranyque rouge des agrumes | Panonychus citri | citrus,mandarin,sweet-orange,lemon | Silvery stippling and bronzing of leaves. | -
taphrina-deformans | disease | Peach leaf curl | Cloque du pêcher | Taphrina deformans | peach,almond,apricot | Thickened red-pink blistered and curled young leaves. | -
wilsonomyces-carpophilus | disease | Shot hole disease | Criblure | Wilsonomyces carpophilus | almond,peach,apricot,plum,cherry | Small purple-red spots on leaves that drop out leaving holes. | -
podosphaera-pannosa | disease | Powdery mildew of peach | Oïdium du pêcher | Podosphaera pannosa | peach,almond,apricot,damask-rose | White powdery coating on young shoots, leaves and fruit. | -
polystigma-amygdalinum | disease | Red leaf blotch of almond | Tache rouge de l'amandier | Polystigma amygdalinum | almond | Orange-red thick blotches on the leaves. | -
xanthomonas-arboricola-pruni | disease | Bacterial spot of stone fruit | Tache bactérienne des Prunus | Xanthomonas arboricola pv. pruni | peach,plum,apricot,almond,cherry | Angular dark leaf spots that drop out and sunken dark fruit spots. | -
agrobacterium-tumefaciens | disease | Crown gall | Galle du collet | Agrobacterium tumefaciens | almond,peach,apricot,plum,cherry,apple,pear,grapevine,walnut,damask-rose | Rough tumour-like galls on roots and the crown. | 3
armillaria-mellea | disease | Armillaria root rot | Pourridié à armillaire | Armillaria mellea | apple,pear,almond,peach,cherry,walnut,citrus,grapevine,olive,fig | White fan mycelium under bark and honey-coloured mushrooms at the base. | 8
cydia-molesta | pest | Oriental fruit moth | Tordeuse orientale du pêcher | Grapholita molesta | peach,apricot,plum,almond,pear,apple,quince | Wilted shoot tips and caterpillars in fruit near the stone. | -
cydia-funebrana | pest | Plum fruit moth | Carpocapse des prunes | Grapholita funebrana | plum,apricot,peach,cherry | Premature fruit drop with a caterpillar inside near the stone. | -
monosteira-unicostata | pest | Almond lace bug | Tigre de l'amandier | Monosteira unicostata | almond,peach,apricot | Pale stippled leaves with black excrement spots underneath. | -
pseudaulacaspis-pentagona | pest | White peach scale | Cochenille blanche du pêcher | Pseudaulacaspis pentagona | peach,mulberry,kiwi,persimmon,apricot,plum | White encrustations on trunks and branches. | -
zeuzera-pyrina | pest | Leopard moth | Zeuzère | Zeuzera pyrina | apple,pear,olive,walnut,pomegranate,almond,fig,citrus | Wilting shoots and holes with sawdust-like frass in branches. | -
venturia-inaequalis | disease | Apple scab | Tavelure du pommier | Venturia inaequalis | apple | Olive-green velvety spots on leaves and dark scabby cracks on fruit. | -
venturia-pirina | disease | Pear scab | Tavelure du poirier | Venturia pirina | pear | Dark olive spots and scabby cracked fruit. | -
podosphaera-leucotricha | disease | Apple powdery mildew | Oïdium du pommier | Podosphaera leucotricha | apple,quince | White powdery shoots and curled leaves. | -
dysaphis-plantaginea | pest | Rosy apple aphid | Puceron cendré du pommier | Dysaphis plantaginea | apple | Curled leaves and distorted fruitlets with rosy-grey aphids. | -
panonychus-ulmi | pest | European red mite | Tétranyque rouge du pommier | Panonychus ulmi | apple,pear,plum,peach,cherry,almond,grapevine | Bronzed stippled leaves with small red mites. | -
stemphylium-vesicarium | disease | Brown spot of pear | Maladie des taches brunes | Stemphylium vesicarium | pear | Small brown leaf spots and black sunken fruit lesions. | -
neonectria-ditissima | disease | European canker | Chancre européen | Neonectria ditissima | apple,pear | Sunken cankers with concentric ridges on branches. | -
eutypa-lata | disease | Eutypa dieback | Eutypiose | Eutypa lata | grapevine,apricot,almond | Stunted shoots in spring and wedge-shaped dead wood in the arm. | -
phaeomoniella-chlamydospora | disease | Esca | Esca | Phaeomoniella chlamydospora | grapevine | Tiger-striped leaves, apoplexy of vines and black spotted wood. | -
phomopsis-viticola | disease | Phomopsis (excoriose) | Excoriose | Phomopsis viticola | grapevine | Black spots on shoots and bleached bark. | -
grapevine-fanleaf-virus | disease | Grapevine fanleaf virus | Court-noué | Grapevine fanleaf virus | grapevine | Fan-shaped distorted leaves, yellow mosaic and poor fruit set. | -
daktulosphaira-vitifoliae | pest | Grape phylloxera | Phylloxéra | Daktulosphaira vitifoliae | grapevine | Leaf galls and swollen knotted roots with weakened vines. | -
eupoecilia-ambiguella | pest | European grape berry moth | Cochylis | Eupoecilia ambiguella | grapevine | Webbed flower clusters and berries with caterpillars. | -
planococcus-ficus | pest | Vine mealybug | Cochenille de la vigne | Planococcus ficus | grapevine,fig | White waxy insects on bunches with honeydew and sooty mould. | -
empoasca-vitis | pest | Green leafhopper | Cicadelle verte | Empoasca vitis | grapevine,potato,green-bean,peach | Leaf edges yellow and curl, with small green hoppers beneath. | -
cryptoblabes-gnidiella | pest | Honeydew moth | Pyrale du miellat | Cryptoblabes gnidiella | grapevine,pomegranate,citrus,date-palm,avocado | Webbed bunches and fruit with caterpillars feeding on honeydew. | -
fusarium-oxysporum-albedinis | disease | Bayoud of date palm | Bayoud | Fusarium oxysporum f. sp. albedinis | date-palm | One-sided whitening and drying of fronds from the base up and rapid palm death. | -
mauginiella-scaettae | disease | Inflorescence rot of date palm | Pourriture des inflorescences (Khamedj) | Mauginiella scaettae | date-palm | Brown rot of the unopened spathe and rotted flower strands. | -
graphiola-phoenicis | disease | False smut of date palm | Faux charbon | Graphiola phoenicis | date-palm | Small black raised pustules on the fronds. | -
rhynchophorus-ferrugineus | pest | Red palm weevil | Charançon rouge du palmier | Rhynchophorus ferrugineus | date-palm,dwarf-palm | Chewed fibres from holes in the trunk, drooping central fronds and fermenting smell. | -
apate-monachus | pest | Black borer | Capucin noir | Apate monachus | date-palm,fig,olive,grapevine | Bored holes in branches with sawdust. | -
batrachedra-amydraula | pest | Lesser date moth | Ver de la datte | Batrachedra amydraula | date-palm | Webbed flower strands and fruitlets that wither and drop. | -
virachola-livia | pest | Pomegranate butterfly | Papillon du grenadier | Virachola livia | pomegranate,date-palm,carob | Caterpillars boring into fruit and rotted fruit. | -
phoenicococcus-marlatti | pest | Red date scale | Cochenille rouge du palmier | Phoenicococcus marlatti | date-palm | Reddish scale clusters under the frond bases. | -
heliothrips-haemorrhoidalis | pest | Greenhouse thrips | Thrips des serres | Heliothrips haemorrhoidalis | avocado,citrus,grapevine,mango | Silvery leaf spots with black excrement and scarred fruit. | -
mycosphaerella-musae | disease | Black leaf streak of banana | Cercosporiose noire | Pseudocercospora fijiensis | banana | Dark streaks and spots on leaves, leaf death. | -
fusarium-oxysporum-cubense | disease | Panama disease | Maladie de Panama | Fusarium oxysporum f. sp. cubense | banana | Yellowing of old leaves, split pseudostem and brown vessels. | -
aulacaspis-tubercularis | pest | Mango scale | Cochenille du manguier | Aulacaspis tubercularis | mango,avocado,papaya,guava | White crusts on leaves and fruit, with yellowing leaves. | -
podosphaera-aphanis | disease | Powdery mildew of strawberry | Oïdium du fraisier | Podosphaera aphanis | strawberry,raspberry,blackberry | White powdery growth under curled leaves and on fruit. | -
mycosphaerella-fragariae | disease | Strawberry leaf spot | Tache pourpre du fraisier | Mycosphaerella fragariae | strawberry | Small purple spots with grey-white centres on the leaves. | 2
fusarium-oxysporum-fragariae | disease | Fusarium wilt of strawberry | Flétrissement fusarien du fraisier | Fusarium oxysporum f. sp. fragariae | strawberry | Wilted stunted plants with brown crown and roots. | 4
phytonemus-pallidus | pest | Cyclamen mite | Tarsonème du fraisier | Phytonemus pallidus | strawberry,raspberry | Crinkled small stunted leaves and bronzed dwarfed plants. | -
otiorhynchus-sulcatus | pest | Black vine weevil | Otiorhynque de la vigne | Otiorhynchus sulcatus | strawberry,raspberry,grapevine,blueberry,blackberry | Notched leaf edges and wilting plants from root-feeding grubs. | -
peronospora-trifoliorum | disease | Downy mildew of clover and alfalfa | Mildiou de la luzerne | Peronospora trifoliorum | alfalfa,berseem,red-clover,white-clover,persian-clover,subterranean-clover,crimson-clover,sulla | Yellowing and curled leaves with grey fuzz underneath. | -
verticillium-albo-atrum | disease | Verticillium wilt of alfalfa | Verticilliose de la luzerne | Verticillium albo-atrum | alfalfa,mint | Yellow V-shaped leaflets, wilting shoots and browned vessels. | 4
phytophthora-medicaginis | disease | Phytophthora root rot of alfalfa | Pourriture racinaire de la luzerne | Phytophthora medicaginis | alfalfa,sainfoin | Yellowing stunted plants and rotted tap roots in wet soil. | 4
uromyces-striatus | disease | Rust of alfalfa | Rouille de la luzerne | Uromyces striatus | alfalfa,berseem | Reddish-brown powdery pustules on the leaves. | -
acyrthosiphon-kondoi | pest | Blue alfalfa aphid | Puceron bleu de la luzerne | Acyrthosiphon kondoi | alfalfa,berseem,annual-medic | Bluish-green aphids on shoots with stunting and honeydew. | -
therioaphis-trifolii | pest | Spotted alfalfa aphid | Puceron tacheté de la luzerne | Therioaphis trifolii | alfalfa,annual-medic | Yellow aphids with spots, yellowing and honeydew on leaves. | -
puccinia-menthae | disease | Rust of mint | Rouille de la menthe | Puccinia menthae | mint,marjoram,oregano | Orange-brown pustules on the undersides of leaves. | 2
fusarium-oxysporum-basilici | disease | Fusarium wilt of basil | Fusariose du basilic | Fusarium oxysporum f. sp. basilici | basil | Wilting plants with brown streaks in the stem. | 4
helicobasidium-purpureum | disease | Violet root rot | Rhizoctone violet | Helicobasidium purpureum | saffron,asparagus,carrot,sugar-beet,potato,alfalfa | Violet felt-like mycelium on roots and corms and wilting plants. | 5
penicillium-corm-rot | disease | Corm rot of saffron | Pourriture des bulbes du safran | Penicillium corymbiferum | saffron | Blue-green mould and soft dry rot on corms. | 4
rhizoglyphus-robini | pest | Bulb mite | Acarien des bulbes | Rhizoglyphus robini | saffron,onion,garlic,shallot | Soft scarred bulbs full of white mites. | -
protomyces-macrosporus | disease | Stem gall of coriander | Galle de la tige | Protomyces macrosporus | coriander,fennel,dill,cumin,anise | Swollen distorted stems, leaf stalks and fruits with galls. | 2
plasmopara-umbelliferarum | disease | Downy mildew of umbellifers | Mildiou des ombellifères | Plasmopara umbelliferarum | fennel,coriander,dill,parsley,anise,carrot | Yellow patches on leaves with white fuzz beneath. | 2
peronospora-sparsa | disease | Downy mildew of rose | Mildiou du rosier | Peronospora sparsa | damask-rose,blackberry,raspberry | Purple-red angular leaf spots with grey fuzz beneath. | -
macrophomina-charcoal-rot | disease | Charcoal rot | Pourriture charbonneuse | Macrophomina phaseolina (charcoal rot) | sunflower,sesame,soybean,sorghum,maize,cowpea | Grey-silver stem base with tiny black sclerotia in the tissue. | 4
cuscuta-campestris | parasitic_plant | Field dodder | Cuscute des champs | Cuscuta campestris | alfalfa,berseem,carrot,tomato,onion,lentil,chickpea,flax,sugar-beet,potato,pepper,pea | Tangled orange-yellow leafless threads strangling the crop in patches. | -
cuscuta-epithymum | parasitic_plant | Clover dodder | Cuscute du trèfle | Cuscuta epithymum | alfalfa,berseem,red-clover,sulla,lentil | Reddish thread-like twining plants forming patches on legumes. | -
avena-fatua | weed | Wild oat | Folle avoine | Avena fatua | durum-wheat,bread-wheat,barley,chickpea,lentil,faba-bean,rapeseed,sunflower | Tall wild grass with loose panicles and twisted bent awns that shatter early. | -
lolium-rigidum | weed | Annual ryegrass | Ray-grass raide | Lolium rigidum | durum-wheat,bread-wheat,barley,chickpea,faba-bean,lentil,rapeseed | Slender tufted grass with flat spikes among the crop. | -
phalaris-brachystachys | weed | Canary grass | Alpiste | Phalaris brachystachys | durum-wheat,bread-wheat,barley | Short dense compact oval panicles in the crop. | -
sinapis-arvensis | weed | Wild mustard | Moutarde des champs | Sinapis arvensis | durum-wheat,bread-wheat,barley,chickpea,lentil,faba-bean,sunflower,sugar-beet | Bristly plant with bright yellow four-petal flowers and beaked pods. | -
raphanus-raphanistrum | weed | Wild radish | Ravenelle | Raphanus raphanistrum | durum-wheat,bread-wheat,barley,chickpea,lentil,faba-bean | White to pale yellow veined flowers and jointed constricted pods. | -
papaver-rhoeas | weed | Common poppy | Coquelicot | Papaver rhoeas | durum-wheat,bread-wheat,barley | Bright red four-petal flowers and round capsules. | -
convolvulus-arvensis | weed | Field bindweed | Liseron des champs | Convolvulus arvensis | cotton,sunflower,maize,potato,tomato,sugar-beet,olive,grapevine,citrus,almond,durum-wheat,bread-wheat | Twining vine with white-pink trumpet flowers smothering the crop. | -
cyperus-rotundus | weed | Purple nutsedge | Souchet rond | Cyperus rotundus | maize,cotton,tomato,potato,onion,pepper,groundnut,citrus,sugarcane,melon,watermelon,sweet-potato | Triangular stems with glossy leaves forming dense stands from tubers. | -
cynodon-dactylon | weed | Bermuda grass | Chiendent pied-de-poule | Cynodon dactylon | olive,citrus,grapevine,almond,alfalfa,cotton,maize,potato,tomato,sugarcane | Creeping grass with stolons and rhizomes forming mats. | -
sorghum-halepense | weed | Johnson grass | Sorgho d'Alep | Sorghum halepense | maize,cotton,sunflower,sugar-beet,alfalfa,citrus,olive,sorghum | Tall rhizomatous grass resembling sorghum with a large open panicle. | -
amaranthus-retroflexus | weed | Redroot pigweed | Amarante réfléchie | Amaranthus retroflexus | maize,tomato,potato,cotton,sugar-beet,pepper,onion,groundnut,sunflower,carrot | Upright plant with reddish roots and dense green terminal spikes. | -
chenopodium-album | weed | Fat hen | Chénopode blanc | Chenopodium album | sugar-beet,maize,potato,tomato,onion,carrot,cotton,sunflower,pepper | Mealy white-grey leaves and dense clusters of small green flowers. | -
portulaca-oleracea-weed | weed | Purslane (weed) | Pourpier (adventice) | Portulaca oleracea | tomato,pepper,cotton,maize,potato,onion,carrot,groundnut | Prostrate fleshy red stems and small thick leaves. | -
solanum-nigrum | weed | Black nightshade | Morelle noire | Solanum nigrum | tomato,potato,pepper,eggplant,sugar-beet,cotton,groundnut,maize,onion | Branching plant with white flowers and clusters of black berries. | -
datura-stramonium | weed | Jimsonweed | Datura | Datura stramonium | maize,cotton,sunflower,soybean,tomato,pepper,potato | Large plant with trumpet flowers and spiny round capsules. | -
xanthium-strumarium | weed | Cocklebur | Lampourde | Xanthium strumarium | maize,cotton,sunflower,soybean,groundnut | Coarse plant bearing spiny burs that stick to coats and fibres. | -
galium-aparine | weed | Cleavers | Gaillet gratteron | Galium aparine | durum-wheat,bread-wheat,barley,rapeseed,faba-bean,lentil,chickpea | Sprawling plant with whorled leaves and clinging hooked bristles. | -
bromus-sterilis | weed | Barren brome | Brome stérile | Bromus sterilis | durum-wheat,bread-wheat,barley | Drooping panicles with long awns early in the season. | -
malva-parviflora | weed | Small-flowered mallow | Petite mauve | Malva parviflora | cotton,sugar-beet,tomato,lentil,chickpea,faba-bean,potato | Rounded lobed leaves with small pale flowers in the leaf axils. | -
oxalis-pes-caprae | weed | Bermuda buttercup | Oxalide pied-de-chèvre | Oxalis pes-caprae | citrus,olive,almond,potato,strawberry,artichoke,faba-bean | Clover-like leaves and yellow nodding flowers forming winter carpets. | -
cirsium-arvense | weed | Creeping thistle | Chardon des champs | Cirsium arvense | durum-wheat,bread-wheat,barley,alfalfa,sunflower,sugar-beet | Prickly leaves, creeping roots and purple flower heads. | -
sonchus-oleraceus | weed | Common sowthistle | Laiteron maraîcher | Sonchus oleraceus | lettuce,tomato,pepper,carrot,onion,faba-bean,chickpea,lentil,sugar-beet | Milky sap and thin lobed toothed leaves with yellow flower heads. | -
echinochloa-colona | weed | Awnless barnyard grass | Echinochloa pied-de-coq | Echinochloa colona | rice,maize,cotton,tomato,sorghum,sugar-beet | Spreading grass with purple-banded leaves and short dense racemes. | -
schistocerca-gregaria | pest | Desert locust | Criquet pèlerin | Schistocerca gregaria | durum-wheat,bread-wheat,barley,maize,sorghum,alfalfa,date-palm,citrus,olive,tomato,potato,pearl-millet,cotton,groundnut,sugarcane | Swarms of large yellow-pink locusts stripping leaves and crops. | -
dociostaurus-maroccanus | pest | Moroccan locust | Criquet marocain | Dociostaurus maroccanus | durum-wheat,bread-wheat,barley,oat,alfalfa,maize,sorghum | Dense bands of brown-spotted nymphs eating leaves and grain heads. | -
deroceras-reticulatum | pest | Grey field slug | Limace grise | Deroceras reticulatum | lettuce,cabbage,strawberry,sugar-beet,potato,faba-bean,rapeseed,durum-wheat,bread-wheat | Ragged holes in leaves and silvery slime trails. | -
meloidogyne-incognita | pest | Southern root-knot nematode | Nématode à galles du Sud | Meloidogyne incognita | tomato,pepper,cucumber,melon,eggplant,courgette,carrot,lettuce,green-bean,watermelon,potato,sweet-potato,strawberry | Galls on roots, stunted yellowing plants and wilting in patches. | 3
`;
