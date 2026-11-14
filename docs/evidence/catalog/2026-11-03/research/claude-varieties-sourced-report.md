# Sourced varieties - second pass (2026-11-06)

Web-sourced variety/cultivar names for Morocco, each with a saved source (SHA-256 in `claude-varieties-sourced.json`) and a quote machine-checked against the saved text. Research only: nothing here is in the catalog (`catalogReady: false` throughout).

**86 records.** Sources used: UPOV/INRA wheat slides (tier 1), INRA barley sheets via ICARDA (tier 1), Cornu 1965 maize hybrids via AGRIS (tier 1), five peer-reviewed papers (fig, pomegranate, apricot, prickly pear, argan; tier 3), a sunflower abstract (tier 3), and press or student reports (tier 4: Aujourd'hui le Maroc 2023, EcoActu 2021, Finances News Hebdo 2010, a 2003 student report). Press and student sources are weaker evidence and are marked as such.

## What the sources newly establish
- Wheat: durum Karim, Marzak, Oum Rabia, Jawhar, Tarek, Amjad, Marjana and bread wheat Achtar, Kanz, Tilila, Massira, Mehdia, Arrehane, Rajae are printed in INRA's seed-sales legend. The registry then held 165 varieties (INRA is first breeder, 40 durum / 27 bread wheat).
- INRA's newer releases (press report of INRA's 2023 document, 34 varieties): durum Faraj, Louiza, Itri, Hammadi, Nachit, Jawahir; bread wheat Kharouba, Khadija, Malika, Snina, Lina, Ibtissam; barley Assiya, Chifaa, Khnata, Ksaiba; oats, triticale, lentil (Extra, Jemaat Shaim), chickpea (Taounate, Arifi, Bochra), faba (Hiba, Yasmine), field bean (Zina), rapeseed (Moufida, Alia, Lila).
- Dates: Najda is INRA's Bayoud-resistant clone; Majhoul and Boufakkos are Bayoud-susceptible; Bousthaoui is naturally resistant.
- Figs: local Nabout, Ghoudan, El-Quoti Lbied, Fassi, Noukali; Kadota is introduced (Italy). Pomegranate: local Sefri, Bzou, Chioukhi, Djeibi. Apricot: introduced Canino and Del Patriarca. Prickly pear: Aakria, Derbana, Mles (Rhamna).
- Argan: a sourced six-shape fruit typology replaces the training labels.

## Training entries checked (training item -> result)
| Training item | Result |
|---|---|
| V.apricot.canino | confirms_variety_exists |
| V.argan.fruit-shape-types-(round,-ovoid,-fusiform,-apiculate) | contradicts_labels_replace_with_sourced_six_shape_typology |
| V.barley.amalou | confirms_variety_exists |
| V.bread-wheat.achtar | confirmed_as_sold_variety |
| V.bread-wheat.arrehane | confirmed_as_sold_variety |
| V.bread-wheat.kanz | confirmed_as_sold_variety |
| V.bread-wheat.massira | confirms_variety_exists |
| V.bread-wheat.mehdia | confirmed_as_sold_variety |
| V.bread-wheat.nesma | spelling_differs_nesma_vs_nasma |
| V.bread-wheat.rajae | confirmed_as_sold_variety |
| V.bread-wheat.tilila | confirmed_as_sold_variety |
| V.date-palm.boufeggous | spelling_differs_boufakkos |
| V.date-palm.mejhoul-(medjool) | confirms_variety_exists_and_adds_bayoud_susceptibility |
| V.date-palm.najda | confirms_variety_exists |
| V.durum-wheat.amjad | confirmed_as_sold_variety |
| V.durum-wheat.jawhar | confirmed_as_sold_variety |
| V.durum-wheat.karim | confirmed_as_sold_variety |
| V.durum-wheat.marjana | confirmed_as_sold_variety |
| V.durum-wheat.marzak | confirmed_as_sold_variety |
| V.durum-wheat.oum-rabia | confirmed_as_sold_variety |
| V.durum-wheat.tarek | confirmed_as_sold_variety |
| V.fig.ghoudane | confirms_variety_exists |
| V.fig.kadota | confirms_variety_exists_as_introduced |
| V.peach.flordastar | group_confirmed_names_not_confirmed |
| V.peach.maycrest | confirms_variety_exists |
| V.peach.nectarine-types | detail_for_nectarine_types |
| V.peach.springcrest | confirms_variety_exists |
| V.pomegranate.sefri | confirms_variety_exists |
| V.pomegranate.zehri | not_confirmed_possibly_tunisian |
| V.prickly-pear.aakria | confirms_variety_exists |

Contradictions to act on: the argan labels (use the sourced typology) and pomegranate "Zehri" (the only match, "Zheri Precoce", is listed with Tunisia, so it is not shown to be Moroccan). Spelling differences: Nesma vs Nasma, Boufeggous vs Boufakkos, Ghoudane vs Ghoudan.

## New names not in the training list
apricot: Del Patriarca, barley: Assiya, barley: Chifaa, barley: Khnata, barley: Ksaiba, bread-wheat: Ibtissam, bread-wheat: Khadija, bread-wheat: Kharouba, bread-wheat: Lina, bread-wheat: Malika, bread-wheat: Snina, chickpea: Arifi, chickpea: Bochra, chickpea: Taounate, date-palm: Bousthaoui, durum-wheat: Faraj, durum-wheat: Hammadi, durum-wheat: Itri, durum-wheat: Jawahir, durum-wheat: Louiza, durum-wheat: Nachit, faba-bean-minor-field-bean: Zina, faba-bean: Hiba, faba-bean: Yasmine, fig: El-Quoti Lbied, fig: Fassi, fig: Nabout, fig: Noukali, lentil: Extra, lentil: Jemaat Shaim, maize: INRAM 383, maize: INRAM 590, maize: INRAM 935, oat: Al Fawze, oat: Hamdali, oat: Nezha, oat: Niema, oat: Seddik, pomegranate: Bzou, pomegranate: Chioukhi, pomegranate: Djeibi, prickly-pear: Derbana, prickly-pear: Mles, rapeseed: Alia, rapeseed: Lila, rapeseed: Moufida, triticale: Ain Nzagh, triticale: Marwa

## Training entries NOT confirmed by any saved source (neither confirmed nor contradicted)
48 entries for the checked crops, including: Saada, Bouregreg, Tabia (bread wheat); Tamellalt, Laanaceur, Massine, Oussama, Adrar, Taffa, Merzaga, Rabat 071 (barley); Aguadulce, Defes, Luz de Otono, Alfia 321 (faba); Bakria, Zaaria (lentil); Douyet, Farihane, Moubarak (chickpea); Bourjassot (fig); Mollar de Elche, Wonderful in a Moroccan context (pomegranate); Bulida, Tomcot, Orangered (apricot); Flordastar, Flordaprince (peach, only a Florida very-early group is confirmed); Bouskri, Boustammi, Jihel, Aziza, Deglet Nour (dates); Moussa, Aissa, Sefra, Dellahia (prickly pear); maize and sunflower hybrid types. Search snippets suggested Laanaceur, Massine, Adrar (barley), Douyet, Farihane, Moubarak (chickpea) and Moussa/Aissa/Dellahia (prickly pear) are real, but those pages were not saved, so they stay unconfirmed here.

## Not sourced (no saved evidence) - leads only
- Sunflower: only a type-level fact. A search snippet named Karima, Salima (INRA), Oukrania, Znatia, Peredovik and Ichraq (only autumn-registered variety, 2026), but the page text was not saved.
- Rapeseed: Moufida, Alia, Lila sourced; a snippet also named Narjisse, Adila and INRA-CZH3 (not saved).
- Rice: a snippet named INRA Gharb varieties Hayat, Dinar, Kanz, Samar, Magrab, Nachat, Dahja (CIHEAM PDF could not be saved).
- Sugar beet: a snippet named Miranda, Beatricia, Candida, Laeticia (Tadla rhizomania trials, undated article, not saved).
- Maroc Late orange: confirmed as the main late orange by press snippets only (page not saved).
- Sesame, cumin, saffron, cotton: no named cultivars found; sesame and saffron studies describe populations/accessions, not cultivars.

## Access limits
Medias24, OCL (rapeseed), the MEL/CGIAR legume page and the CIHEAM PDFs returned bot checks or empty pages. I did not work around them; a later pass could fetch them manually.
