# Project brief: Protocol Explorer

A website that presents analyses of AI agent identity and authorization protocols,
produced by the `protocol-analyzer` skill. Visitors can look at each protocol, compare
protocols side by side, rank them by their own priorities, group and filter them, and
add new analyses. Target: about 50 protocols, eventually public.

Owner: Manav (SASH AgentID team). Keep this file up to date when decisions change.

## Repository layout
- `skill/protocol-analyzer/`: the skill that produces the analyses (source of truth for
  the rubric, profile vocabularies, linter and report renderer). Changes here must be
  re-zipped and re-uploaded to Claude to take effect for skill users.
- `reports/`: one HTML report per protocol, exactly as the skill outputs it. Each report
  embeds its analysis data in `<script type="application/json" id="protocol-analysis-data">`.
  File name `<profile.id>.html`, or `<id>--<version>.html` when several versions are kept.
- `data/protocols.json`: the dataset the website reads. Generated; never edit by hand.
- `scripts/datalib.py`: shared logic (extract, validate with the skill's linter,
  duplicates, build). The website's upload feature must reuse it.
- `scripts/build_data.py`: rebuild the dataset from `reports/`.
- `scripts/add_report.py`: add one report, with the duplicate check.
- `site/`: the website. Plain HTML, CSS and JavaScript modules, no build step:
  `site/index.html`, `site/assets/app.css` (design tokens, light and dark),
  `site/assets/core.js` (state, data access, shared UI), `site/assets/app.js` (router),
  `site/assets/views/*.js` (overview, explore, protocol, compare, rank, properties,
  landscape, search, add, about).
- `scripts/serve.py`: local server (project root, port 8000) with the upload API used
  by the "Add a report" page.

## Commands
```
python scripts/build_data.py                    # rebuild data/protocols.json
python scripts/add_report.py path/to/x.html     # add a report (asks if it exists)
python scripts/add_report.py x.html --replace   # or --keep-both
python scripts/serve.py                         # run the site at http://localhost:8000
```
Python 3.10+ only, standard library only (no pip installs needed for the data layer).

## Data model (per protocol, see skill/protocol-analyzer/references/output-schema.md)
- `protocol`: name, version, date, maintainer
- `profile`: id, category, mechanisms, venue, maturity, openness, layers,
  building_blocks, website, first_published (fixed vocabularies in
  `skill/protocol-analyzer/references/profile.md`)
- `review`: status `draft` or `reviewed`
- `summary` (2 paragraphs), `how_it_works` (steps)
- `rows`: 19 properties in 7 groups, each with short answer, full answer, rating
  (green / yellow / red / n/a), coverage, requirement level, rating reason and claims
  (source, section, verbatim quote, check status)
- `goals_reading`: access control, incident response, accountability
- `sources`, `notes`, `open_questions`
- added by the build: `_meta` (file, current version or not, number of versions)

The dataset also carries `properties` (rubric with questions and the goals each
property serves), `goals` and `vocab` (allowed profile values with labels), so the site
needs no hard-coded rubric.

## Scoring (site only, not part of the skill)
- Coverage: share of the 14 scored properties addressed (status and adoption excluded),
  green 1, yellow 0.5, red 0.
- Goal map: `GOAL_MAP` in `scripts/datalib.py` links each scored property to the goals it
  mainly serves. It is the explorer's own reading; the About page says so.
- Ranking score: property weight = average weight of its goals (Ignore 0, Low 1,
  Normal 2, High 3) times its own setting (Ignore 0, Normal 1, Double 2); score = earned
  weighted points / total weighted points x 100. Partly addressed earns half by default
  (Nothing / Half / Full). Settings are saved in localStorage (`pe-weights`) and in the
  URL (`w=ac.ir.acc`, `x=prop:0|2`, `partly=`), so a ranking can be shared.
- Goal score: share of the properties serving that goal that are addressed.

## Decisions made
1. Show all analyses, reviewed or not, in the first draft. Unreviewed ones are labelled
   clearly. **Before going public, remind Manav to decide how unreviewed analyses are
   shown** (hide from rankings, or label only).
2. Ranking is per user: each visitor sets weights for the three goals. No single
   official ranking.
3. Category taxonomy: as in `profile.md`. Claude may refine it.
4. Hosting: not decided; build a static site that can be hosted anywhere. Local
   development uses a small local server so uploads can be saved into `reports/`.
5. Upload: the site accepts a skill HTML report. If the protocol id already exists it
   asks: Replace, Keep both versions, or Cancel. Same rules as `add_report.py`.
6. Start with 4 protocols: MCP Authorization, Web Bot Auth, Visa TAP (the skill's
   calibration examples) and AAuth.
7. Look: lively and professional, like a mature product (not a document). Light and
   dark mode, works on mobile.
8. Public-facing text is neutral: no references to SASH or internal work.

## Phases
1. Data layer (done): profile and review fields in the skill, 4 reports, dataset build,
   add-report script.
2. Site MVP (done, first version): overview matrix and least-covered chart, explorer
   with search, filters, sort and group; protocol pages with evidence; side-by-side
   compare with a difference view; add-a-report upload with duplicate handling.
3. Analysis features (done, first version): Rank page with goal weights, presets,
   per-property fine-tuning and a score breakdown; Properties index and one page per
   property across all protocols; Landscape page with a coverage strip plot (rows by
   maturity, category, venue or mechanism) and a goal map scatter, plus a table view;
   Search page over summaries, steps, answers and quotes, with phrase search. Explore
   search also covers quotes. "/" opens search from any page.
4. Extras: building-block graph, timeline, version history and diffs, export,
   methodology page, feedback.

## Design notes
- One bold element: the coverage matrix and the per-protocol "fingerprint" strip of
  rating cells. Everything else stays quiet.
- IBM Plex Sans (IBM Plex Mono only for literal identifiers), cool grey paper, navy
  ink, cobalt accent; green / amber / red are reserved for ratings.
- Rows and tables rather than identical cards. Left aligned.
- Motion: the matrix fills in on the first visit; rows glide to their new place when
  ranking weights change. Respect prefers-reduced-motion.
- Charts: single accent colour for dots (no categorical colours, which would clash
  with the rating colours); identity comes from direct labels and tooltips; every
  chart has a table view.
- Class names are shared across views; check for collisions (e.g. `.prop` is the
  protocol-page property row, the matrix header uses `.mprop`).

## Skill download link
The public download link for the skill is `SKILL_URL` in `site/assets/core.js` (also in
the footer of `site/index.html`). It is shown on the overview, Add a report and About pages.

## Conventions
- Never invent analysis content in the site; everything shown comes from the dataset.
- Ratings are drafts until reviewed; always show the review status.
- Keep the site dependency-light and static. Pin exact versions of any library.
- Writing style for UI text: plain, short, neutral, no em dashes.
