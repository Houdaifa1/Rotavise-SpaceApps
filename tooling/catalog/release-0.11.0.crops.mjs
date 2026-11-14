// Further crops recalled by the AI model (unverified). Fields:
//   id | name | fr | ar | scientific | family | product | type |
//   window (MM-DD..MM-DD) | cycle days (min-max) | cold damage degC |
//   heat damage degC | minimum return years | note
// "-" means not recalled. Quality rows (regions, Kc, soil, classes) follow in
// EXTRA_ROWS in the format of release-0.11.0.data.mjs.
export const NEW_CROPS = `
bottle-gourd | Bottle gourd | Calebasse | - | Lagenaria siceraria | Cucurbitaceae | vegetable | annual | 04-01..06-15 | 90-150 | 1 | 40 | 3 | Candidate only: minor garden crop.
luffa | Sponge gourd | Courge éponge (luffa) | - | Luffa aegyptiaca | Cucurbitaceae | vegetable | annual | 04-01..06-01 | 120-180 | 2 | 40 | 3 | Candidate only: minor crop.
cape-gooseberry | Cape gooseberry | Physalis | - | Physalis peruviana | Solanaceae | fruit | annual | 03-01..05-15 | 150-240 | 2 | 36 | 3 | Candidate only: small export niche.
radicchio | Radicchio | Chicorée rouge (radicchio) | - | Cichorium intybus | Asteraceae | vegetable | annual | 08-15..10-30 | 90-130 | -5 | 33 | 3 | Candidate only: minor leaf vegetable.
runner-bean | Runner bean | Haricot d'Espagne | - | Phaseolus coccineus | Fabaceae | green_pods | annual | 04-01..05-31 | 90-140 | 1 | 32 | 3 | Candidate only: cooler highland gardens.
lima-bean | Lima bean | Haricot de Lima | - | Phaseolus lunatus | Fabaceae | dry_grain | annual | 04-01..06-01 | 100-150 | 2 | 38 | 3 | Candidate only: minor pulse.
spelt | Spelt | Épeautre | - | Triticum spelta | Poaceae | dry_grain | annual | 11-01..01-15 | 180-240 | -15 | 36 | 2 | Candidate only: minor cereal.
sainfoin | Sainfoin | Sainfoin | - | Onobrychis viciifolia | Fabaceae | forage | multi_year_stand | 10-15..02-15 | 1460-2555 | -25 | 38 | 3 | Candidate only: mountain forage legume.
red-clover | Red clover | Trèfle violet | - | Trifolium pratense | Fabaceae | forage | multi_year_stand | 10-01..12-15 | 730-1460 | -20 | 36 | 3 | Candidate only: irrigated or humid forage.
white-clover | White clover | Trèfle blanc | - | Trifolium repens | Fabaceae | forage | multi_year_stand | 10-01..12-15 | 1095-2190 | -25 | 36 | 3 | Candidate only: pasture legume.
persian-clover | Persian clover | Trèfle de Perse | - | Trifolium resupinatum | Fabaceae | forage | annual | 10-01..12-15 | 120-180 | -8 | 36 | 3 | Candidate only: winter forage legume.
phalaris | Phalaris (harding grass) | Phalaris | - | Phalaris aquatica | Poaceae | forage | multi_year_stand | 10-01..12-15 | 1460-3650 | -15 | 42 | 3 | Candidate only: dry-pasture grass.
tall-fescue | Tall fescue | Fétuque élevée | - | Festuca arundinacea | Poaceae | forage | multi_year_stand | 10-01..12-15 | 1460-3650 | -20 | 36 | 3 | Candidate only: pasture grass.
cocksfoot | Cocksfoot (orchard grass) | Dactyle | - | Dactylis glomerata | Poaceae | forage | multi_year_stand | 10-01..12-15 | 1460-2920 | -20 | 36 | 3 | Candidate only: pasture grass.
perennial-ryegrass | Perennial ryegrass | Ray-grass anglais | - | Lolium perenne | Poaceae | forage | multi_year_stand | 10-01..12-15 | 1095-2190 | -20 | 33 | 3 | Candidate only: irrigated pasture.
hairy-vetch | Hairy vetch | Vesce velue | - | Vicia villosa | Fabaceae | forage | annual | 10-15..12-15 | 150-210 | -20 | 36 | 3 | Candidate only: forage and cover crop.
phacelia | Phacelia | Phacélie | - | Phacelia tanacetifolia | Boraginaceae | other | annual | 09-15..11-30 | 60-120 | -8 | 35 | 3 | Candidate only: cover and bee crop.
oilseed-radish | Oilseed radish | Radis fourrager | - | Raphanus sativus | Brassicaceae | forage | annual | 09-01..11-30 | 60-100 | -6 | 33 | 3 | Candidate only: cover crop.
black-oat | Black oat (bristle oat) | Avoine rude | - | Avena strigosa | Poaceae | forage | annual | 10-01..12-15 | 90-150 | -8 | 35 | 2 | Candidate only: cover and forage crop.
oleaster | Wild olive (oleaster) | Olivier sauvage (oléastre) | - | Olea europaea var. sylvestris | Oleaceae | fruit | wild_harvested | - | - | -10 | - | - | Wild and rootstock use; not planned.
aleppo-pine | Aleppo pine | Pin d'Alep | الصنوبر الحلبي | Pinus halepensis | Pinaceae | other | wild_harvested | - | - | -15 | - | - | Forest species; not planned.
atlas-cedar | Atlas cedar | Cèdre de l'Atlas | أرز الأطلس | Cedrus atlantica | Pinaceae | other | wild_harvested | - | - | -25 | - | - | Forest species; not planned.
cork-oak | Cork oak | Chêne-liège | البلوط الفلين | Quercus suber | Fagaceae | other | wild_harvested | - | - | -12 | - | - | Forest species; cork harvest; not planned.
holm-oak | Holm oak | Chêne vert | البلوط الأخضر | Quercus ilex | Fagaceae | fruit | wild_harvested | - | - | -20 | - | - | Forest species; acorns and fodder; not planned.
eucalyptus | Eucalyptus | Eucalyptus | الكاليبتوس | Eucalyptus camaldulensis | Myrtaceae | other | orchard | - | - | -7 | - | - | Planted forestry; listed, not planned.
ziziphus-lotus | Wild jujube (sedra) | Jujubier sauvage | - | Ziziphus lotus | Rhamnaceae | fruit | wild_harvested | - | - | -5 | - | - | Wild shrub of the south; not planned.
strawberry-tree | Strawberry tree | Arbousier | - | Arbutus unedo | Ericaceae | fruit | wild_harvested | - | - | -10 | - | - | Wild shrub; not planned.
dwarf-palm | Dwarf fan palm (doum) | Palmier nain (doum) | - | Chamaerops humilis | Arecaceae | fiber | wild_harvested | - | - | -8 | - | - | Wild palm; leaves for crafts; not planned.
moringa | Moringa | Moringa | المورينغا | Moringa oleifera | Moringaceae | other | orchard | - | - | 2 | - | - | Candidate only: recent trials.
acacia-raddiana | Umbrella thorn (talha) | Acacia de Raddi | - | Acacia tortilis subsp. raddiana | Fabaceae | other | wild_harvested | - | - | 0 | - | - | Wild tree of the far south; not planned.
roselle | Roselle (karkadé) | Roselle (bissap) | الكركديه | Hibiscus sabdariffa | Malvaceae | other | annual | 04-15..06-01 | 150-210 | 5 | 40 | 3 | Candidate only: minor crop.
calendula | Calendula | Souci | - | Calendula officinalis | Asteraceae | other | annual | 09-15..11-30 | 90-150 | -5 | 34 | 3 | Candidate only: aromatic and medicinal.
milk-thistle | Milk thistle | Chardon-Marie | - | Silybum marianum | Asteraceae | other | annual | 10-01..12-15 | 200-260 | -8 | 38 | 3 | Candidate only: medicinal, also wild.
borage | Borage | Bourrache | - | Borago officinalis | Boraginaceae | other | annual | 09-15..11-30 | 90-150 | -5 | 33 | 3 | Candidate only: aromatic and medicinal.
hyssop | Hyssop | Hysope | - | Hyssopus officinalis | Lamiaceae | other | multi_year_stand | 03-01..04-30 | 1095-2190 | -20 | 36 | 3 | Candidate only: aromatic and medicinal.
sweet-orange | Sweet orange | Oranger | البرتقال | Citrus sinensis | Rutaceae | fruit | orchard | - | - | -3 | - | - | Species view of the citrus group; listed, not planned.
mandarin | Mandarin and clementine | Mandarinier et clémentinier | اليوسفي | Citrus reticulata | Rutaceae | fruit | orchard | - | - | -4 | - | - | Species view of the citrus group; listed, not planned.
lemon | Lemon | Citronnier | الليمون | Citrus limon | Rutaceae | fruit | orchard | - | - | -2 | - | - | Species view of the citrus group; listed, not planned.
grapefruit | Grapefruit | Pomelo (pamplemoussier) | - | Citrus paradisi | Rutaceae | fruit | orchard | - | - | -2 | - | - | Species view of the citrus group; listed, not planned.
`;

export const EXTRA_ROWS = `
bottle-gourd | SMA RSK | 0.50,1.00,0.80,20,30,40,20 | 6.0-7.5 | 2.5 | W | M | 0 | M | 1 | 1 | 0
luffa | SMA | 0.50,1.00,0.75,20,30,40,20 | 6.0-7.0 | 2.5 | W | H | 0 | S | 1 | 1 | 0
cape-gooseberry | SMA | - | 5.5-7.0 | 2.0 | W | M | 0 | M | 1 | 1 | 0
radicchio | TTH RSK | 0.70,1.00,0.95,20,30,40,10 | 6.0-7.0 | 1.5 | W | M | 0 | S | 1 | 1 | 0
runner-bean | TTH FMK | 0.40,1.15,0.35,20,30,40,20 | 6.0-7.0 | 1.0 | W | M | 1 | M | 2 | 1 | 1
lima-bean | - | 0.40,1.15,0.35,20,30,40,20 | 6.0-7.0 | 1.5 | W | M | 1 | M | 2 | 2 | 2
spelt | FMK BMK | 0.40,1.15,0.25,20,60,70,30 | 5.5-7.5 | 6.0 | W | L | 0 | D | 2 | 3 | 2
sainfoin | FMK BMK | - | 6.5-8.5 | 2.0 | A | L | 1 | X | 3 | 3 | 3
red-clover | TTH FMK | - | 6.0-7.0 | 1.5 | A | M | 1 | D | 3 | 3 | 3
white-clover | TTH | - | 5.5-7.0 | 1.5 | A | M | 1 | S | 3 | 3 | 3
persian-clover | TTH RSK CAS | 0.40,0.90,0.85,15,25,50,25 | 6.0-8.0 | 2.0 | A | M | 1 | M | 3 | 3 | 3
phalaris | CAS FMK | - | 5.5-8.0 | 4.0 | A | L | 0 | D | 3 | 3 | 3
tall-fescue | TTH FMK | - | 5.5-7.5 | 3.9 | A | M | 0 | D | 3 | 3 | 3
cocksfoot | TTH FMK | - | 5.5-7.5 | 1.5 | W | M | 0 | D | 3 | 3 | 3
perennial-ryegrass | TTH RSK | - | 5.5-7.5 | 5.6 | A | H | 0 | S | 3 | 3 | 3
hairy-vetch | TTH RSK FMK | 0.40,1.00,0.35,15,25,45,25 | 5.5-8.0 | 2.0 | W | L | 1 | M | 3 | 3 | 3
phacelia | FMK TTH | 0.35,1.00,0.50,15,25,40,15 | 6.0-8.0 | 2.0 | W | L | 0 | S | 2 | 2 | 1
oilseed-radish | FMK TTH | 0.35,1.00,0.80,10,20,30,10 | 6.0-7.5 | 1.5 | W | L | 0 | D | 2 | 2 | 2
black-oat | CAS RSK TTH | 0.30,1.00,0.35,20,30,50,20 | 5.0-7.5 | 3.0 | W | L | 0 | D | 3 | 3 | 3
oleaster | TTH FMK ORI MRS | - | - | - | - | - | 0 | D | 2 | 3 | 1
aleppo-pine | ORI FMK MRS | - | - | - | - | - | 0 | X | 2 | 3 | 0
atlas-cedar | FMK BMK | - | - | - | - | - | 0 | D | 2 | 3 | 0
cork-oak | RSK TTH | - | - | - | - | - | 0 | X | 3 | 3 | 1
holm-oak | FMK BMK TTH | - | - | - | - | - | 0 | X | 3 | 3 | 2
eucalyptus | RSK TTH CAS | - | 5.5-8.0 | 3.0 | W | H | 0 | X | 2 | 2 | 0
ziziphus-lotus | MRS SMA DRA | - | - | - | - | - | 0 | X | 2 | 3 | 1
strawberry-tree | TTH FMK | - | - | - | - | - | 0 | M | 2 | 3 | 0
dwarf-palm | TTH ORI MRS | - | - | - | - | - | 0 | M | 2 | 3 | 0
moringa | SMA | - | 6.0-7.5 | 2.0 | W | L | 0 | D | 2 | 2 | 2
acacia-raddiana | GON LAY SMA | - | - | - | - | - | 1 | X | 2 | 3 | 3
roselle | SMA DRA | 0.40,1.00,0.70,20,30,50,30 | 5.5-7.5 | 2.0 | W | M | 0 | M | 1 | 1 | 1
calendula | FMK ORI | 0.35,1.00,0.50,15,25,40,15 | 6.0-7.5 | 2.0 | W | L | 0 | S | 1 | 1 | 0
milk-thistle | FMK ORI | 0.35,1.05,0.40,20,30,50,25 | 6.0-8.0 | 3.0 | W | L | 0 | D | 1 | 2 | 0
borage | FMK | 0.35,1.00,0.50,15,25,40,15 | 6.0-7.5 | 2.0 | W | L | 0 | M | 1 | 1 | 0
hyssop | FMK | - | 6.5-8.0 | 2.0 | W | L | 0 | S | 1 | 2 | 0
sweet-orange | SMA RSK ORI TAD MRS | - | 6.0-7.5 | 1.7 | A | H | 0 | M | 2 | 2 | 0
mandarin | ORI RSK SMA TAD | - | 6.0-7.5 | 1.7 | A | H | 0 | M | 2 | 2 | 0
lemon | SMA RSK ORI | - | 6.0-7.5 | 1.7 | A | H | 0 | M | 2 | 2 | 0
grapefruit | SMA RSK | - | 6.0-7.5 | 1.7 | A | H | 0 | M | 2 | 2 | 0
`;
