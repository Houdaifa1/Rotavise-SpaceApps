// Additions for catalog release 0.11.0, recalled by the AI model (unverified).
// One row per crop:
//   id | regions | kc | ph | ece | drainage | water | nfix | root | om | erosion | forage
// regions   space-separated codes (see REGIONS), "-" for none beyond national
// kc        "ini,mid,end,L1,L2,L3,L4" (FAO-56 pattern: Kc values, stage days) or "-"
// ph        "lo-hi" or "-"
// ece       ECe threshold in dS/m at which yield loss begins, or "-"
// drainage  W well drained, A avoid waterlogging, or "-"
// water     L low, M moderate, H high relative seasonal water demand, or "-"
// nfix      1 symbiotic nitrogen fixation, 0 none
// root      S shallow (0.2-0.5 m), M medium (0.5-1.0 m), D deep (1.0-2.0 m),
//           X very deep (2.0-5.0 m)
// om, erosion, forage   ordinal classes 1 low, 2 medium, 3 high (forage 0 none)
// Every value is general agronomy recall; none was checked against a source.
export const REGIONS = {
  TAD: "beni-mellal-tadla",
  BMK: "ma-beni-mellal-khenifra",
  RSK: "ma-rabat-sale-kenitra",
  TTH: "ma-tangier-tetouan-al-hoceima",
  ORI: "ma-oriental",
  FMK: "ma-fez-meknes",
  CAS: "ma-casablanca-settat",
  MRS: "ma-marrakech-safi",
  SMA: "ma-souss-massa",
  DRA: "ma-draa-tafilalet",
  GON: "ma-guelmim-oued-noun",
  LAY: "ma-laayoune-sakia-el-hamra",
  DAK: "ma-dakhla-oued-ed-dahab",
};

export const ROOT_RANGES = {
  S: [0.2, 0.5],
  M: [0.5, 1.0],
  D: [1.0, 2.0],
  X: [2.0, 5.0],
};

export const ROWS = `
acacia-saligna | SMA CAS MRS LAY | - | 6.0-8.5 | 8 | W | L | 1 | X | 2 | 3 | 2
alfalfa | TAD BMK RSK FMK CAS MRS DRA SMA ORI | - | 6.5-8.0 | 2.0 | A | H | 1 | X | 3 | 3 | 3
almond | FMK MRS ORI DRA SMA TTH BMK | - | 6.0-8.0 | 1.5 | A | M | 0 | D | 2 | 2 | 0
aloe-vera | SMA MRS GON | - | 6.0-8.5 | 4 | W | L | 0 | S | 1 | 2 | 0
amaranth | MRS SMA TAD | 0.30,1.15,0.40,15,25,40,20 | 6.0-7.5 | 3 | W | L | 0 | M | 2 | 2 | 2
ammi-visnaga | FMK ORI CAS | - | - | - | - | - | 0 | M | 1 | 2 | 0
anise | MRS CAS TAD | 0.35,1.05,0.60,20,30,40,20 | 6.0-7.5 | 2 | W | L | 0 | M | 1 | 1 | 0
annual-medic | CAS MRS ORI RSK | 0.40,0.90,0.85,15,25,30,20 | 6.0-8.5 | 2.0 | A | L | 1 | M | 3 | 3 | 3
apple | FMK BMK TTH ORI | - | 6.0-7.5 | 1.0 | A | H | 0 | D | 2 | 2 | 0
apricot | FMK DRA MRS ORI BMK | - | 6.0-8.0 | 1.6 | A | M | 0 | D | 2 | 2 | 0
argan | SMA GON MRS | - | - | - | - | - | 0 | X | 2 | 3 | 2
arugula | SMA RSK MRS TTH | 0.70,1.00,0.95,15,20,20,10 | 6.0-7.5 | 2.0 | W | M | 0 | S | 1 | 1 | 0
artemisia | ORI DRA | - | - | - | - | - | 0 | M | 1 | 2 | 0
artichoke | RSK TTH CAS SMA BMK | - | 6.5-7.5 | 3.0 | W | M | 0 | M | 2 | 2 | 1
asparagus | MRS SMA TTH | - | 6.5-7.5 | 4.1 | W | M | 0 | D | 2 | 2 | 0
atriplex | DRA ORI MRS GON LAY | - | 7.0-9.0 | 15 | W | L | 0 | D | 2 | 3 | 3
avocado | SMA RSK TTH | - | 5.5-7.0 | 1.3 | W | H | 0 | M | 2 | 2 | 0
azarole | FMK TTH | - | 6.0-7.5 | 1.5 | W | M | 0 | M | 2 | 2 | 0
banana | SMA RSK | - | 5.5-7.0 | 1.0 | W | H | 0 | S | 2 | 2 | 0
barley | TAD BMK RSK FMK CAS MRS ORI DRA | 0.30,1.15,0.25,20,25,60,30 | 6.0-8.0 | 8.0 | W | L | 0 | D | 2 | 3 | 2
basil | SMA MRS TTH | 0.60,1.10,0.80,15,25,25,10 | 6.0-7.5 | 2.0 | W | M | 0 | S | 1 | 1 | 0
bay-laurel | TTH FMK | - | - | - | - | - | 0 | M | 2 | 3 | 0
berseem | TAD BMK RSK CAS MRS DRA | 0.40,0.90,0.85,20,30,60,30 | 6.5-8.0 | 1.5 | A | H | 1 | M | 3 | 3 | 3
bitter-orange | FMK RSK MRS | - | 6.0-7.5 | 1.7 | W | H | 0 | M | 2 | 2 | 0
bitter-vetch | CAS MRS ORI | 0.40,1.00,0.35,15,25,40,20 | 6.0-8.0 | 2.0 | W | L | 1 | M | 2 | 2 | 3
blackberry | TTH | - | 5.5-7.0 | 1.5 | W | M | 0 | M | 2 | 2 | 0
blueberry | TTH RSK | - | 4.5-5.5 | 1.5 | A | H | 0 | S | 2 | 2 | 0
bread-wheat | TAD BMK RSK FMK CAS MRS ORI TTH | 0.40,1.15,0.25,20,60,70,30 | 6.0-8.0 | 6.0 | W | L | 0 | D | 2 | 3 | 2
broccoli | SMA RSK CAS TTH | 0.70,1.05,0.95,35,45,40,15 | 6.0-7.5 | 2.8 | W | M | 0 | S | 1 | 1 | 0
brussels-sprout | TTH RSK FMK | 0.70,1.05,0.95,30,40,50,20 | 6.0-7.5 | 1.8 | W | M | 0 | M | 1 | 1 | 0
buckwheat | FMK BMK | 0.35,1.00,0.35,15,25,30,15 | 5.5-7.0 | 2.0 | W | L | 0 | S | 2 | 2 | 1
cabbage | RSK SMA TTH FMK CAS BMK | 0.70,1.05,0.95,40,60,50,15 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 1
camelina | FMK CAS | 0.35,1.10,0.35,20,30,40,20 | 6.0-7.5 | 2.0 | W | L | 0 | M | 1 | 2 | 0
cannabis | TTH | 0.35,1.10,0.30,15,30,40,20 | 6.0-7.0 | 2.0 | W | M | 0 | M | 1 | 2 | 0
caper | FMK ORI DRA TTH | - | 6.5-8.0 | 4 | W | L | 0 | D | 2 | 3 | 0
caraway | FMK | 0.35,1.05,0.60,20,30,40,20 | 6.0-7.5 | 2.0 | W | L | 0 | M | 1 | 1 | 0
cardoon | TTH RSK CAS | - | 6.5-7.5 | 3.0 | W | M | 0 | D | 2 | 2 | 1
carob | TTH FMK ORI MRS | - | 6.5-8.0 | 4 | W | L | 0 | X | 2 | 3 | 2
carrot | RSK SMA TTH CAS TAD | 0.70,1.05,0.95,20,30,50,20 | 6.0-7.0 | 1.0 | W | M | 0 | M | 1 | 1 | 0
cassava | - | 0.30,0.80,0.30,20,40,90,60 | 5.5-7.0 | 2.0 | W | L | 0 | M | 1 | 2 | 0
castor | ORI SMA | 0.35,1.15,0.55,25,40,65,50 | 6.0-7.5 | 3.0 | W | M | 0 | D | 1 | 2 | 0
cauliflower | SMA RSK CAS TTH | 0.70,1.05,0.95,35,50,40,15 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
celeriac | FMK TTH | 0.70,1.05,1.00,25,40,95,20 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
celery | RSK SMA | 0.70,1.05,1.00,25,40,95,20 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
chamomile | FMK ORI | 0.40,1.00,0.60,20,30,40,20 | 6.0-7.5 | 2.0 | W | L | 0 | S | 1 | 1 | 0
chard | RSK CAS BMK TTH FMK | 0.70,1.00,0.95,20,30,30,10 | 6.0-7.5 | 4.0 | W | M | 0 | M | 1 | 1 | 1
cherimoya | TTH | - | 6.0-7.0 | 1.5 | W | M | 0 | M | 2 | 2 | 0
cherry | FMK BMK | - | 6.0-7.5 | 1.5 | A | M | 0 | M | 2 | 2 | 0
chestnut | TTH FMK | - | 5.0-6.5 | 1.5 | W | M | 0 | X | 2 | 3 | 0
chia | - | 0.35,1.05,0.35,20,30,40,20 | 6.0-7.5 | 2.0 | W | L | 0 | M | 1 | 1 | 0
chickpea | TAD BMK CAS RSK FMK ORI TTH MRS | 0.40,1.00,0.35,20,40,40,20 | 6.0-8.0 | 1.5 | W | L | 1 | D | 2 | 2 | 1
chilli | SMA RSK ORI TTH | 0.60,1.05,0.90,25,35,40,20 | 6.0-7.0 | 1.5 | W | M | 0 | M | 1 | 1 | 0
chinese-cabbage | RSK TTH SMA | 0.70,1.05,0.95,25,35,40,15 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
chives | TTH FMK RSK | - | 6.0-7.0 | 1.2 | W | M | 0 | S | 1 | 1 | 0
cistus | FMK TTH ORI | - | - | - | - | - | 0 | M | 2 | 3 | 0
citrus | SMA RSK ORI TAD MRS | - | 6.0-7.5 | 1.7 | A | H | 0 | M | 2 | 2 | 0
cladanthus | MRS CAS | - | - | - | - | - | 0 | S | 1 | 1 | 0
common-vetch | CAS MRS FMK ORI RSK | 0.40,1.00,0.35,15,25,40,20 | 6.0-8.0 | 3.0 | W | L | 1 | M | 3 | 3 | 3
coriander | FMK CAS MRS RSK | 0.35,1.10,0.60,20,30,35,15 | 6.0-7.5 | 1.7 | W | L | 0 | S | 1 | 1 | 0
cotton | RSK TTH | 0.35,1.15,0.70,30,50,60,55 | 6.0-8.0 | 7.7 | W | H | 0 | D | 1 | 1 | 0
courgette | SMA RSK CAS TTH | 0.50,0.95,0.75,20,30,25,15 | 6.0-7.5 | 3.2 | W | M | 0 | M | 1 | 1 | 0
cowpea | TAD SMA | 0.40,1.05,0.55,20,30,40,20 | 6.0-7.5 | 4.9 | W | L | 1 | D | 2 | 2 | 3
crimson-clover | TTH RSK | 0.40,0.90,0.85,15,25,40,25 | 5.5-7.5 | 1.5 | A | M | 1 | M | 3 | 3 | 3
cucumber | SMA RSK TTH | 0.60,1.00,0.75,20,30,40,15 | 6.0-7.0 | 2.5 | W | H | 0 | S | 1 | 1 | 0
cumin | MRS | 0.35,1.05,0.60,20,30,35,20 | 6.5-8.0 | 2.0 | W | L | 0 | S | 1 | 1 | 0
damask-rose | DRA | - | 6.0-7.5 | 2.0 | W | M | 0 | M | 2 | 2 | 0
date-palm | DRA GON | - | 7.0-8.5 | 4.0 | W | H | 0 | X | 2 | 2 | 0
desert-truffle | ORI DRA | - | - | - | - | - | 0 | S | 1 | 2 | 0
dill | FMK RSK | 0.70,1.00,0.80,15,25,30,10 | 6.0-7.5 | 2.0 | W | L | 0 | S | 1 | 1 | 0
dry-bean | RSK FMK TTH SMA | 0.40,1.15,0.35,20,30,40,20 | 6.0-7.5 | 1.0 | W | M | 1 | M | 2 | 2 | 2
durum-wheat | TAD BMK RSK FMK CAS MRS ORI TTH | 0.40,1.15,0.25,20,60,70,30 | 6.0-8.0 | 5.9 | W | L | 0 | D | 2 | 3 | 2
eggplant | SMA RSK TTH | 0.60,1.05,0.90,30,40,40,20 | 6.0-7.0 | 1.1 | W | M | 0 | M | 1 | 1 | 0
endive | RSK TTH | 0.70,1.00,0.95,20,30,40,10 | 6.0-7.0 | 1.5 | W | M | 0 | S | 1 | 1 | 0
esparto | ORI DRA | - | - | - | - | - | 0 | M | 2 | 3 | 1
faba-bean | TAD BMK RSK FMK TTH CAS MRS ORI | 0.50,1.15,0.30,20,30,50,20 | 6.0-8.0 | 1.6 | A | M | 1 | D | 3 | 2 | 3
fennel | RSK TTH | 0.70,1.00,0.80,25,40,40,10 | 6.0-7.5 | 3.0 | W | M | 0 | M | 1 | 1 | 0
fenugreek | CAS MRS FMK | 0.40,1.10,0.35,15,25,30,15 | 6.0-8.0 | 2.0 | W | L | 1 | M | 2 | 2 | 2
fig | FMK TTH ORI MRS DRA | - | 6.0-8.0 | 4.2 | W | L | 0 | D | 2 | 2 | 0
finger-millet | - | 0.30,1.00,0.30,15,25,40,20 | 5.5-7.5 | 4.0 | W | L | 0 | M | 2 | 2 | 3
flax | FMK CAS TAD | 0.35,1.10,0.25,25,35,50,40 | 6.0-7.5 | 1.7 | W | L | 0 | M | 1 | 1 | 0
fodder-beet | TAD TTH RSK FMK | 0.35,1.20,0.70,30,45,80,30 | 6.5-7.5 | 7.0 | W | M | 0 | D | 2 | 2 | 3
forage-rape | TTH FMK | 0.35,1.05,0.90,15,25,45,20 | 6.0-7.5 | 1.0 | W | M | 0 | M | 2 | 2 | 3
foxtail-millet | - | 0.30,1.00,0.30,15,25,35,20 | 5.5-7.5 | 3.0 | W | L | 0 | M | 2 | 2 | 3
garden-cress | RSK | 0.70,1.00,0.95,10,15,15,5 | 6.0-7.5 | 2.0 | W | M | 0 | S | 1 | 1 | 0
garlic | FMK RSK TAD CAS DRA | 0.70,1.00,0.70,20,35,70,40 | 6.0-7.5 | 1.7 | W | M | 0 | S | 1 | 1 | 0
gherkin | RSK TTH | 0.60,1.00,0.75,20,30,40,15 | 6.0-7.0 | 2.5 | W | H | 0 | S | 1 | 1 | 0
grapevine | FMK CAS ORI MRS SMA | - | 6.0-8.0 | 1.5 | W | L | 0 | D | 2 | 2 | 0
grass-pea | CAS MRS | 0.40,1.10,0.35,20,30,40,20 | 6.0-8.0 | 3.0 | W | L | 1 | D | 2 | 2 | 3
green-bean | RSK SMA TTH CAS TAD | 0.50,1.05,0.90,20,30,30,10 | 6.0-7.0 | 1.0 | W | M | 1 | M | 2 | 1 | 1
groundnut | RSK TTH MRS | 0.40,1.15,0.60,25,35,45,25 | 6.0-7.0 | 3.2 | W | M | 1 | D | 2 | 2 | 2
guava | SMA | - | 5.5-7.5 | 1.5 | W | M | 0 | M | 2 | 2 | 0
hazelnut | TTH FMK | - | 5.5-7.0 | 1.5 | W | M | 0 | M | 2 | 2 | 0
hemp | TTH | 0.35,1.10,0.30,15,30,40,15 | 6.0-7.5 | 2.0 | W | M | 0 | M | 2 | 2 | 1
henna | DRA GON | - | 6.0-8.0 | 4.0 | W | L | 0 | M | 2 | 2 | 0
horseradish | FMK | - | 6.0-7.5 | 2.0 | W | M | 0 | M | 1 | 1 | 0
italian-ryegrass | TTH RSK FMK CAS | 0.40,0.90,0.85,20,30,60,30 | 6.0-7.5 | 5.6 | A | M | 0 | M | 3 | 3 | 3
jerusalem-artichoke | FMK TTH | 0.50,1.10,0.95,25,35,60,30 | 6.0-7.5 | 3.0 | W | M | 0 | D | 2 | 2 | 2
jojoba | SMA | - | 6.0-8.5 | 5.0 | W | L | 0 | X | 2 | 3 | 0
jujube | SMA MRS DRA | - | 6.0-8.5 | 5.0 | W | L | 0 | D | 2 | 2 | 0
juniper-cade | TTH FMK | - | - | - | - | - | 0 | D | 2 | 3 | 0
kale | TTH RSK FMK | 0.70,1.05,0.95,30,40,50,20 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 1
kiwi | RSK TTH | - | 5.5-7.0 | 1.0 | A | H | 0 | S | 2 | 2 | 0
kohlrabi | TTH FMK | 0.70,1.00,0.95,20,30,30,10 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
lambs-lettuce | TTH FMK | 0.70,1.00,0.95,15,25,30,10 | 6.0-7.5 | 1.3 | W | M | 0 | S | 1 | 1 | 0
lavender | FMK BMK | - | 6.5-8.0 | 3.0 | W | L | 0 | M | 1 | 2 | 0
leek | RSK TTH FMK | 0.70,1.05,0.95,20,45,80,20 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
lemon-balm | FMK | - | 6.0-7.5 | 1.5 | W | M | 0 | S | 1 | 2 | 0
lemon-verbena | FMK MRS | - | 6.0-7.5 | 1.5 | W | M | 0 | M | 1 | 2 | 0
lentil | CAS TAD BMK FMK RSK MRS ORI | 0.40,1.10,0.30,20,30,40,20 | 6.0-8.0 | 1.5 | W | L | 1 | M | 2 | 2 | 2
lentisk | TTH FMK ORI | - | - | - | - | - | 0 | M | 2 | 3 | 0
lettuce | RSK SMA TTH CAS TAD | 0.70,1.00,0.95,20,30,15,10 | 6.0-7.0 | 1.3 | W | M | 0 | S | 1 | 1 | 0
loquat | TTH RSK SMA | - | 6.0-7.5 | 1.5 | W | M | 0 | M | 2 | 2 | 0
lychee | - | - | 5.0-6.5 | 1.0 | W | H | 0 | M | 2 | 2 | 0
maize | RSK TAD TTH FMK CAS | 0.30,1.20,0.60,20,35,40,30 | 5.8-7.5 | 1.7 | W | H | 0 | D | 3 | 1 | 3
mallow | FMK RSK TTH CAS | - | - | - | - | - | 0 | M | 1 | 2 | 1
mango | SMA | - | 5.5-7.5 | 1.5 | W | M | 0 | X | 2 | 2 | 0
marjoram | FMK | - | 6.0-7.5 | 2.0 | W | L | 0 | S | 1 | 2 | 0
marrubium | FMK MRS | - | - | - | - | - | 0 | M | 1 | 2 | 0
medlar | TTH FMK | - | 6.0-7.5 | 1.5 | W | M | 0 | M | 2 | 2 | 0
melon | RSK TAD CAS SMA ORI | 0.50,1.05,0.75,25,35,40,20 | 6.0-7.5 | 2.2 | W | M | 0 | M | 1 | 1 | 0
mint | FMK RSK MRS SMA | - | 6.0-7.5 | 2.0 | W | H | 0 | S | 2 | 2 | 0
mulberry | FMK DRA | - | 6.0-7.5 | 2.0 | W | M | 0 | D | 2 | 2 | 1
mulberry-black | FMK DRA | - | 6.0-7.5 | 2.0 | W | M | 0 | D | 2 | 2 | 1
mung-bean | TAD | 0.40,1.05,0.60,15,25,30,15 | 6.0-7.5 | 1.8 | W | L | 1 | M | 2 | 2 | 1
mustard | FMK CAS | 0.35,1.15,0.35,20,30,40,20 | 6.0-7.5 | 2.5 | W | L | 0 | M | 1 | 2 | 0
myrtle | TTH FMK | - | - | - | - | - | 0 | M | 2 | 3 | 0
narrow-leaf-lupin | TTH RSK | 0.40,1.10,0.30,20,30,50,20 | 5.0-7.0 | 1.5 | W | L | 1 | D | 2 | 2 | 3
nigella | CAS MRS FMK | 0.35,1.05,0.60,20,30,40,20 | 6.0-8.0 | 2.0 | W | L | 0 | S | 1 | 1 | 0
oat | TTH FMK RSK CAS BMK | 0.30,1.15,0.25,20,50,60,30 | 5.5-7.5 | 5.6 | W | L | 0 | D | 2 | 3 | 3
okra | SMA | 0.50,1.00,0.70,20,30,40,20 | 6.0-7.0 | 1.2 | W | M | 0 | M | 1 | 1 | 0
olive | FMK MRS ORI TAD SMA TTH BMK DRA | - | 6.5-8.5 | 4.0 | W | L | 0 | D | 2 | 3 | 1
onion | TAD RSK CAS SMA | 0.50,1.05,0.75,15,25,70,40 | 6.0-7.0 | 1.2 | W | M | 0 | S | 1 | 1 | 0
oregano | FMK | - | 6.0-8.0 | 2.0 | W | L | 0 | S | 1 | 2 | 0
pak-choi | TTH | 0.70,1.05,0.95,15,25,30,10 | 6.0-7.5 | 1.8 | W | M | 0 | S | 1 | 1 | 0
papaya | SMA | - | 6.0-7.0 | 1.5 | A | H | 0 | S | 2 | 2 | 0
parsley | RSK SMA TTH | 0.50,0.95,0.80,15,25,35,15 | 6.0-7.5 | 1.7 | W | M | 0 | S | 1 | 1 | 0
parsnip | FMK | 0.50,1.05,0.95,15,25,60,30 | 6.0-7.5 | 1.5 | W | M | 0 | M | 1 | 1 | 0
passion-fruit | SMA TTH | - | 6.0-7.0 | 1.5 | W | H | 0 | M | 2 | 2 | 0
pea | RSK TAD FMK TTH CAS | 0.50,1.15,0.30,20,30,35,15 | 6.0-7.5 | 1.5 | W | M | 1 | M | 2 | 2 | 2
peach | FMK BMK MRS ORI | - | 6.0-7.5 | 1.7 | A | M | 0 | D | 2 | 2 | 0
pear | FMK BMK TTH | - | 6.0-7.5 | 1.7 | A | M | 0 | D | 2 | 2 | 0
pearl-millet | DRA MRS CAS SMA | 0.30,1.00,0.30,20,30,55,35 | 5.5-7.5 | 3.0 | W | L | 0 | D | 2 | 2 | 3
pecan | - | - | 6.0-7.5 | 1.5 | W | H | 0 | X | 2 | 2 | 0
pennyroyal | FMK | - | - | - | - | - | 0 | S | 1 | 1 | 0
pepper | RSK SMA TTH ORI | 0.60,1.05,0.90,25,35,40,20 | 6.0-7.0 | 1.5 | W | M | 0 | M | 1 | 1 | 0
persimmon | TTH FMK | - | 6.0-7.5 | 1.5 | W | M | 0 | D | 2 | 2 | 0
pineapple | - | - | 4.5-6.5 | 1.5 | W | H | 0 | S | 2 | 2 | 0
pistachio | MRS | - | 7.0-8.5 | 5.0 | W | L | 0 | X | 2 | 2 | 0
pitahaya | SMA | - | 6.0-7.5 | 3.0 | W | L | 0 | S | 1 | 2 | 0
plum | FMK BMK TTH ORI | - | 6.0-7.5 | 1.5 | A | M | 0 | M | 2 | 2 | 0
pomegranate | DRA MRS TAD ORI FMK | - | 6.0-8.0 | 2.5 | W | L | 0 | D | 2 | 2 | 0
potato | RSK CAS TTH BMK FMK | 0.50,1.15,0.75,25,30,30,30 | 5.5-6.5 | 1.7 | W | M | 0 | M | 1 | 1 | 0
prickly-pear | MRS SMA GON CAS | - | 6.5-8.5 | 4.0 | W | L | 0 | S | 2 | 3 | 2
pumpkin | RSK CAS SMA TAD | 0.50,1.00,0.80,20,30,30,20 | 6.0-7.5 | 3.2 | W | M | 0 | M | 1 | 2 | 1
purslane | RSK | 0.50,1.00,0.80,10,20,20,10 | 5.5-7.5 | 2.0 | W | L | 0 | S | 1 | 1 | 0
quince | FMK TTH | - | 6.0-7.5 | 1.5 | A | M | 0 | M | 2 | 2 | 0
quinoa | DRA MRS CAS | 0.30,1.00,0.35,20,35,40,20 | 6.0-8.0 | 6.0 | W | L | 0 | M | 1 | 2 | 1
radish | RSK SMA TTH | 0.70,0.90,0.85,5,10,15,5 | 6.0-7.0 | 1.2 | W | M | 0 | S | 1 | 1 | 0
rapeseed | CAS RSK FMK TTH TAD | 0.35,1.15,0.35,25,35,55,30 | 6.0-7.5 | 9.7 | W | M | 0 | D | 1 | 2 | 0
raspberry | TTH | - | 5.5-6.5 | 1.0 | A | H | 0 | S | 2 | 2 | 0
rice | RSK | 1.05,1.20,0.90,30,30,60,30 | 5.5-7.5 | 3.0 | - | H | 0 | S | 2 | 1 | 2
rose-geranium | TTH RSK | - | 6.0-7.5 | 1.5 | W | M | 0 | S | 1 | 2 | 0
rosemary | FMK ORI MRS | - | 6.0-8.0 | 2.0 | W | L | 0 | M | 1 | 2 | 0
rue | FMK ORI | - | - | - | - | - | 0 | M | 1 | 2 | 0
rye | TTH FMK CAS | 0.30,1.15,0.25,20,50,60,30 | 5.5-7.5 | 11.4 | W | L | 0 | D | 2 | 3 | 3
safflower | DRA TAD FMK MRS | 0.35,1.15,0.25,20,35,45,25 | 6.0-8.0 | 7.0 | W | L | 0 | D | 1 | 2 | 0
saffron | SMA DRA | - | 6.0-8.0 | 2.0 | W | L | 0 | S | 1 | 1 | 0
sage | FMK | - | 6.0-8.0 | 2.0 | W | L | 0 | M | 1 | 2 | 0
salsify | FMK | 0.50,1.00,0.80,20,30,40,20 | 6.0-7.5 | 1.5 | W | M | 0 | D | 1 | 1 | 0
savory | FMK ORI | 0.40,1.00,0.60,15,25,30,15 | 6.0-7.5 | 1.5 | W | L | 0 | S | 1 | 1 | 0
scorzonera | FMK | 0.50,1.00,0.80,20,30,40,20 | 6.0-7.5 | 1.5 | W | M | 0 | D | 1 | 1 | 0
sesame | TAD BMK MRS | 0.35,1.10,0.25,20,30,40,20 | 5.5-8.0 | 2.3 | W | L | 0 | D | 1 | 1 | 0
shallot | FMK RSK | 0.50,1.05,0.75,15,25,70,40 | 6.0-7.0 | 1.2 | W | M | 0 | S | 1 | 1 | 0
sorghum | TAD DRA MRS | 0.30,1.00,0.55,20,35,45,30 | 5.5-8.0 | 6.8 | W | L | 0 | D | 2 | 2 | 3
soybean | RSK TTH | 0.40,1.15,0.50,15,15,40,15 | 6.0-7.0 | 5.0 | W | M | 1 | M | 2 | 2 | 3
spinach | RSK SMA CAS TTH | 0.70,1.00,0.95,20,20,15,5 | 6.5-7.5 | 2.0 | W | M | 0 | S | 1 | 1 | 0
sorrel | FMK RSK | - | 5.5-6.5 | 2.0 | W | M | 0 | M | 1 | 1 | 1
spring-onion | RSK SMA | 0.70,1.00,1.00,25,30,10,5 | 6.0-7.0 | 1.2 | W | M | 0 | S | 1 | 1 | 0
stevia | - | - | 6.0-7.5 | 2.0 | W | M | 0 | S | 1 | 1 | 0
stone-pine | RSK TTH | - | - | - | - | - | 0 | X | 2 | 3 | 0
strawberry | RSK TTH | 0.40,0.85,0.75,20,30,40,30 | 5.5-6.5 | 1.0 | W | H | 0 | S | 2 | 1 | 0
subterranean-clover | TTH RSK | 0.40,0.90,0.85,20,30,60,30 | 5.5-7.5 | 1.5 | A | L | 1 | M | 3 | 3 | 3
sudan-grass | DRA TAD SMA | 0.50,0.90,0.85,15,25,40,15 | 6.0-8.0 | 2.8 | W | M | 0 | D | 3 | 3 | 3
sugar-beet | TAD RSK CAS MRS ORI | 0.35,1.20,0.70,30,45,90,15 | 6.5-8.0 | 7.0 | W | M | 0 | D | 2 | 1 | 3
sugarcane | RSK TAD | - | 6.0-8.0 | 1.7 | W | H | 0 | D | 3 | 2 | 2
sulla | TTH FMK ORI RSK | - | 6.5-8.5 | 4.0 | W | L | 1 | D | 3 | 3 | 3
sumac | FMK ORI | - | - | - | - | - | 0 | M | 1 | 2 | 0
sunflower | TAD CAS RSK FMK ORI MRS | 0.35,1.10,0.35,25,35,45,25 | 6.0-7.5 | 4.8 | W | M | 0 | D | 1 | 1 | 1
sweet-corn | RSK TAD TTH | 0.30,1.15,1.05,20,25,25,10 | 6.0-7.0 | 1.7 | W | H | 0 | D | 2 | 1 | 2
sweet-potato | RSK TTH SMA | 0.50,1.15,0.65,20,30,60,40 | 5.5-6.5 | 1.5 | W | M | 0 | M | 2 | 2 | 0
table-beet | RSK TAD CAS FMK | 0.50,1.05,0.95,25,30,25,10 | 6.0-7.5 | 4.0 | W | M | 0 | M | 1 | 1 | 1
taro | - | - | 5.5-7.0 | 2.0 | - | H | 0 | S | 1 | 1 | 0
tarragon | - | - | 6.0-7.5 | 2.0 | W | L | 0 | S | 1 | 1 | 0
teff | - | 0.30,1.00,0.30,15,25,40,20 | 5.5-7.5 | 3.0 | W | L | 0 | S | 2 | 2 | 3
thuya | MRS SMA | - | - | - | - | - | 0 | D | 2 | 3 | 0
thyme | FMK ORI | - | 6.0-8.0 | 2.0 | W | L | 0 | S | 1 | 2 | 0
tobacco | FMK TTH | 0.35,1.10,0.90,25,35,40,25 | 5.5-7.5 | 2.0 | W | M | 0 | M | 1 | 1 | 0
tomato | SMA RSK TTH CAS ORI MRS | 0.60,1.15,0.80,30,40,40,25 | 5.5-7.5 | 2.5 | W | H | 0 | M | 1 | 1 | 0
triticale | TTH FMK CAS | 0.40,1.15,0.25,20,60,70,30 | 6.0-7.5 | 6.1 | W | L | 0 | D | 2 | 3 | 3
turnip | TTH RSK | 0.50,1.10,0.95,15,30,40,15 | 6.0-7.5 | 0.9 | W | M | 0 | M | 1 | 1 | 1
walnut | FMK BMK TTH | - | 6.0-7.5 | 1.5 | W | H | 0 | X | 2 | 2 | 0
watercress | FMK TTH | 0.90,1.05,0.95,10,15,20,10 | 6.0-7.5 | 2.0 | - | H | 0 | S | 1 | 1 | 0
watermelon | SMA CAS RSK MRS DAK | 0.40,1.00,0.75,20,30,30,30 | 6.0-7.0 | 2.0 | W | M | 0 | M | 1 | 1 | 0
white-lupin | TTH RSK | 0.40,1.10,0.30,20,30,50,20 | 5.5-7.5 | 1.5 | W | M | 1 | D | 2 | 2 | 3
wild-thyme | FMK ORI | - | - | - | - | - | 0 | S | 1 | 2 | 0
wormwood | FMK | - | 6.0-7.5 | 2.0 | W | L | 0 | M | 1 | 2 | 0
yellow-lupin | TTH | 0.40,1.10,0.30,20,30,50,20 | 5.0-7.0 | 1.5 | W | L | 1 | D | 2 | 2 | 3
`;
