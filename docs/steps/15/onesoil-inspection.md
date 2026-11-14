# OneSoil inspection (2026-11-10) and what Rotavise copies, changes and adds

Inspected live in the built-in browser with the user's own signed-in session
(demo field only). Nothing was created, saved or changed: every edit screen was
cancelled. We copy the system and the behaviour, never their code, assets, name
or logo.

## What the app is

Two web apps share one account: the field app `app.onesoil.ai` (fields, crop
rotation, scouting, files, stations) and the yield app `app.yield.onesoil.ai`
(status, prescription maps, soil sampling, yield analysis). Their phone app is
native (the web app is not responsive). Maps are Mapbox in the yield app and
Leaflet in the field-selection mode; imagery is commercial (Google/DigitalGlobe),
which we do not use. We use NASA GIBS and MapLibre.

## Layout, measured (1440 x 900)

- **Icon rail** at the far left, 7 top icons (season calendar, fields, crop
  rotation, scouting pin, data upload, prescription, sampling) and 6 bottom
  icons (help, apps, learning, mobile app, profile). Green logo tile on top.
  Icons are single-stroke outline, no labels until hover.
- **Panel 1 (about 290 px):** workspace and role ("My Fields, Owner"), season
  rows, a collapse button, "Create group" at the bottom.
- **Panel 2 (about 290 px):** season title with total area, search with a sort
  control, then a list: thumbnail of the outline (dark tile, white outline), field
  name, small green "Demo" badge, area, three tiny action icons and a checkbox.
  Empty state: a light-grey rounded card with an icon, a title, two lines of
  text and one green pill ("Add fields"); a second card with a green border
  asks "Have a question?" with one pill.
- **Panel 3 (field detail, about 440 px, white, closes with an X):** title,
  "34.90 ha, No crop", three icon actions (prescription map, soil sampling map,
  upload data) and a more menu; five text tabs with an underline on the active
  one (Status, Field report, Prescription maps, Data +13, Yield Analysis); a row
  of three outline buttons (Add crop, Add planting date) and a weather card
  (+2 degrees, rain, wind); a "Satellite data" section with a dark pill date
  stepper (previous, "Nov 7, 2026", next) and two map cards side by side
  (Vegetation NDVI with a vertical legend, and the satellite image with its
  date); a period selector (two pills); three stacked charts (NDVI, accumulated
  precipitation as a blue area with a big value, growing degree-days as an
  orange area) with a hover cursor and a dark rounded tooltip (value and date).
- **Map:** full height on the right. Top-left: dark rounded chip "Crop / Field
  name" with a chevron (what the colour shows). Top-right: search pill and a
  Filter button. Right edge: ruler, 3D, joined zoom in/out pill, locate arrow,
  all round or pill dark buttons. Bottom-left: "Show legend", weather chip
  (temperature, wind). Selected field: translucent white fill, thin white
  outline, name label centred.
- **Add fields:** a green pill opens a four-item menu: Select on map, Draw
  fields, Upload file, Import from John Deere. "Select on map" collapses the
  panels into one narrow panel with the empty state "There are no selected
  fields. Click field borders to select them." and Cancel / Save (Save
  disabled until something is selected) fixed at the bottom. Detected field
  borders appear as yellow outlines.
- **Field edit page:** a big bold title, a small map card with the outline and
  an area chip (34.9 ha), a side note "Field border editing" with a button,
  "Field details" (Irrigation select), then the **Crop rotation** table: one row
  per season with Crop (searchable alphabetical list, plain text), Variety or
  hybrid, Planting date, Harvest date, Average yield (t/ha), a plus button and
  "+ New season". A dark floating bar at the bottom: "Field editing, Test field
  #1", Cancel (grey) and Save (green). A "Remove field" link in red, top right.
- **Crop rotation page:** big bold title, a "Show crops" toggle, a table with
  field thumbnails, names and areas on the left and one column per season on
  the right (season name, dates, a thin progress bar "0 ha out of 34.9 ha"
  allocated, a button "Allocate crops automatically", a plus cell per field).
  Toasts are dark rounded cards at the bottom.
- **States:** skeleton rows (grey blocks) while loading, a dark card at the
  bottom listing what is still loading, spinners inside chart cards. Blue
  onboarding tooltip once.
- **Type and colour:** one geometric sans, large bold titles, small grey labels,
  white panels on a light-grey app background, one green for primary actions
  (a pill), dark grey for map tools and toasts, black/white elsewhere. Rounded
  corners everywhere (10 to 16 px, pills for buttons).

## What we copy

The three-panel desktop system (rail, list, detail), the full-height map, the
text tabs, pill buttons, skeleton loading, the dark floating action bar for
edit mode (Cancel, Save), the date stepper with two linked maps, stacked charts
with one dark tooltip, empty-state cards with one action, the season-by-field
crop rotation table.

## Where Rotavise is better (the point of the project)

1. **A recommendation, not only records.** Their crop field is a plain list and
   their rotation page is a blank grid to fill. We compare your rotation with
   alternatives, and explain why, with evidence and gaps.
2. **Crops people recognise.** Names in four languages (en, fr, ar, ary), search by
   any, a colour per crop, later a photo; their list is alphabetical text.
3. **Real uncertainty.** Ranges, five climate models and two scenarios, what-if
   sliders, and chips that say sourced, recalled or missing. They show single
   values.
4. **Climate adaptation.** Near-term and mid-century projections beside history;
   they show the past and current season.
5. **Open science.** NASA data with a visible source and date on every map and
   chart; commercial imagery is not used.
6. **Selection that fits the data.** Our fields snap to the 30 m NASA cells (grid
   painting) as well as draw and upload, and show which products cover them.
7. **Clearer for low technical skill.** Plain words, four icons maximum on the
   map, units beside values, French and English interface.

## Things to avoid (their weak spots)

Desktop-only web app (we are phone first), blank rotation grid with no guidance,
dense icon rail without labels, Intercom bubble covering content, nothing that
explains why a number is what it is.

## Second pass (2026-11-10): the other screens and the flaws seen

Seen after the first pass, all read-only: the Field report, Prescription maps,
Data and Yield Analysis tabs, the layer menu, the Filter panel, the legend, the
Scouting page and the field edit page.

**More screens**

- **Field report:** a rainbow "Productivity map" of the field, two dark stat
  cards ("64% Field stable area" with a green bar, "6/9 Seasons used"), a table of
  productivity zones (High, Medium, Low; area in ha and %; yield deviation as
  coloured chips +26%, 0, -13%), thumbnails of the NDVI images used with green
  ticks and an Edit button, and a "Rate zones" thumbs up/down on the map.
- **Prescription maps:** cards with a thumbnail map, a date, a title ("Fertilizer
  application, based on productivity map") and a one-line value ("Nitrogen
  application 140-220 kg/ha"); "Soil sampling, 6 zones".
- **Data:** "Operations" (harvest card with the yield range) and "Soil analysis
  results" as map cards.
- **Layer menu:** search, two tabs (Layer, Labels), choices No fill, Crop,
  Productivity map, VRA Potential, Satellite image, then a Vegetation group
  (NDVI, NDRE, MSAVI) each with its long name.
- **Filter panel:** a right-hand overlay with range sliders (field area,
  productivity zone stability), minimum number of NDVI images, check boxes for
  uploaded data, VRA maps and crop, and Reset filter.
- **Legend:** a small dark card listing the map objects with icons.
- **Scouting:** one narrow panel, "There are no notes yet" with a one-line
  instruction and a single full-width green pill, "Add a note"; notes are pins
  on the map.

**Flaws seen, and the rule Rotavise follows instead**

| #   | Flaw seen                                                                                                                                                                                          | Our rule (and how it is checked)                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Two separate apps (field app and yield app) with different hosts, panels and map libraries; "Add crop" on the Status tab jumps to the other app with a full reload and loses context.              | One app, one shell, one map, deep links inside it. A route test fails if navigation changes origin.                                                               |
| 2   | Slow cold loads: a black map and grey skeletons for several seconds, spinners inside chart cards, data tabs that appear one by one.                                                                | Performance budgets in CI; last result cached for instant paint; each block loads on its own with a placeholder of the right size.                                |
| 3   | The "Import complete" toast and the blue "you have your own workspace" tooltip came back on every page load, with confusing wording.                                                               | A toast only follows an action the user just took; onboarding appears once per user. A test fails if a toast shows on load.                                       |
| 4   | A placeholder leaked into the interface: "Jan 4 - Dec 4, yyyy".                                                                                                                                    | A DOM scan test fails on `yyyy`, `undefined`, `NaN`, `null`, `{{`, raw keys and UPPER_SNAKE codes.                                                                |
| 5   | Translucent menus and filter panels over the busy satellite map; text is hard to read.                                                                                                             | Panels over the map are opaque or heavily blurred and pass a contrast check.                                                                                      |
| 6   | Jargon without help: NDVI, NDRE, MSAVI, VRA, "productivity zone stability", "yield deviation".                                                                                                     | Plain label first, term second, tap for the glossary card (fr, en).                                                                                               |
| 7   | Red-yellow-green rainbow colour ramps (poor for colour-blind users, implies good and bad).                                                                                                         | Colour-blind-safe ramps, never red-green as the only signal, always a labelled legend.                                                                            |
| 8   | Tabs that are nearly empty (Yield Analysis shows one small card), and a "No crop" heading above prescriptions that do exist.                                                                       | A tab or section is shown only when it has content, otherwise one empty state with the next step.                                                                 |
| 9   | Not responsive: the detail panel is pushed off-screen at 800 px and the web app breaks at phone width.                                                                                             | Phone first. Panels collapse by rule; Playwright tests at 390, 768, 1024 and 1440 px.                                                                             |
| 10  | The support chat bubble covers controls at the bottom right; the floating Cancel/Save bar covers content.                                                                                          | No floating bubble over controls; edit actions are in a fixed footer with space reserved.                                                                         |
| 11  | A dark stripe across a satellite image with no explanation; chart axis labels overlap (-0.3 over "Jan").                                                                                           | Say why an image is partial (cloud, shadow, gap) next to it; chart axis tests.                                                                                    |
| 12  | The crop picker is a plain alphabetical list, no recent crops, no guidance; "Variety/hybrid" is a free box; the rotation page is a blank grid and "Allocate crops automatically" does not say how. | Our crop picker (four-language search, colour per crop, recent, varieties from the catalog), and every automatic suggestion states its reason, evidence and gaps. |
| 13  | A visual glitch where the crop dropdown draws over the headings behind it.                                                                                                                         | Menus use a portal with a solid surface; visual regression tests on menus.                                                                                        |
| 14  | Single values without uncertainty (productivity zones, yield deviation).                                                                                                                           | Ranges and source chips on every figure.                                                                                                                          |

## Third pass (2026-11-10): "Select fields" at Beni Mellal, tested live

- Field outlines for the whole visible area are drawn as thin white lines from
  zoom 12 through 15; tapping inside one selects it (yellow outline) and a
  narrow "Select fields" panel lists it with a thumbnail, name ("Field 16"),
  area (about 2.6 ha), a Crop select, a Variety box, an Irrigation select, a
  trash button, and Cancel and Save fixed at the bottom. The outlines hug real
  parcels in Morocco (irrigated Beni Mellal plots, olive and cereal fields).
- Zoom moves in whole levels (three wheel notches took zoom 15 to 12). At zoom
  16 the imagery turned blurry and a green banner said "Zoom in to select
  fields". Their map is Leaflet in this mode, imagery is Google/DigitalGlobe.
- What the user asked for beyond this, and the plan adds: continuous smooth zoom,
  and "outline it for me" for any field the detector missed (BG-13 in
  `FRONTEND_MASTER_PLAN.md`, Part 5.1, and screen S04 mode 1).
