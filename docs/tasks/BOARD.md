# Task board

How to take a task: `docs/tasks/WORKFLOW.md`. Status values: `todo`,
`in progress`, `review` (pull request open), `done`. "Who" is the person
whose machine does the work. "Needs" must all be `done` before starting.
Houdaifa assigns tasks; take only the one you were given.

Cut order if time runs out: F11, then F10, then F08.

## Frontend

| ID              | Task                                                           | Status | Who      | Needs    | Area it owns                                  |
| --------------- | -------------------------------------------------------------- | ------ | -------- | -------- | --------------------------------------------- |
| [F05](F05.md)   | Finish the plan builder and progress (fix the 4 failing tests) | todo   | Houdaifa | —        | `features/plans/` builder and progress files  |
| [F06](F06.md)   | Results and strategy detail (S11, S12)                         | todo   |          | —        | `features/results/` (new)                     |
| [F07](F07.md)   | Evidence tabs with the NASA data (S13)                         | todo   |          | F06      | `features/evidence/` (new)                    |
| [F08](F08.md)   | What-if, photo check screen, plans list (S14, S17, S18)        | todo   |          | F06      | `features/whatif/`, `features/plans-list/`    |
| [F09](F09.md)   | Settings and About (S19, S20)                                  | todo   |          | —        | `features/settings/`, `features/about/` (new) |
| [F10](F10.md)   | Performance and accessibility pass                             | todo   |          | F06–F09  | whole `apps/web` (run alone)                  |
| [F11](F11.md)   | Hardening: the 20 end-to-end flows                             | todo   |          | F10      | `tests/e2e` (run alone)                       |
| [F03P](F03P.md) | Smooth field drawing and selection on phone and desktop        | todo   | Houdaifa | B03      | `features/map/`, `features/fields/` drawing   |
| [F12](F12.md)   | Field greenness chart from Sentinel-2                          | todo   |          | B04, F07 | inside `features/evidence/`                   |
| [F13](F13.md)   | "Not cropland" warning when a field is drawn                   | todo   |          | B05      | `features/fields/` creation step              |

## Backend

| ID            | Task                                                         | Status | Who      | Needs | Area it owns                           |
| ------------- | ------------------------------------------------------------ | ------ | -------- | ----- | -------------------------------------- |
| [B01](B01.md) | After the hackathon: restore the GitHub check, engine speed  | todo   | Houdaifa | —     | `packages/domain/src/rotation`         |
| [B02](B02.md) | Merge B7 (ranking outside Tadla) and B8 (crop names, 0.16.0) | done   | Houdaifa | —     | server modules, catalog 0.16.0         |
| [B03](B03.md) | Sharp Google satellite map, NASA/EOX as fallback             | todo   | Houdaifa | —     | `features/map/` basemap, server config |
| [B04](B04.md) | Sentinel-2 10 m field greenness (Planetary Computer)         | todo   |          | B02   | new server module `sentinel`           |
| [B05](B05.md) | ESA WorldCover cropland check for fields                     | todo   |          | B02   | new server module `landcover`          |
| [B06](B06.md) | Suggest mode proposes only crops with strong evidence        | todo   | Houdaifa | B02   | `packages/domain/src/rotation`         |

## Shared files

`apps/web/src/app/routes.tsx`, `apps/web/src/i18n/en.json`,
`apps/web/src/i18n/fr.json` and `apps/web/src/app/styles.css` are shared. Add
only your own lines there (new routes, new message keys), keep your other
code inside your feature folder, and rebase on `main` before opening the pull
request.
