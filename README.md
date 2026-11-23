# Protocol Explorer

Explore, compare and rank analyses of AI agent identity and authorization protocols.

Each protocol is analysed with the `protocol-analyzer` skill (in `skill/`), which
produces a single HTML report with a plain-language summary, how the protocol works,
and 19 rated properties backed by verbatim quotes from the specification. This project
collects those reports into one dataset and presents them as a website.

## Quick start
Requires Python 3.10 or newer. No packages to install, so a virtual environment is
optional (`.venv/` is ignored by git).

```
python scripts/build_data.py
```
This reads every report in `reports/`, checks it, and writes `data/protocols.json`.

## Running the website
```
python scripts/serve.py
```
Then open http://localhost:8000 in your browser. The site has:
- **Overview:** a matrix of every protocol against every property, and the least covered properties.
- **Explore:** search, filter, sort and group protocols, and add them to compare.
- **Protocol pages:** the full analysis with evidence for every rating.
- **Compare:** up to four protocols side by side, with a "where ratings differ" view.
- **Rank:** order protocols by how much you care about access control, incident
  response and accountability. Settings are saved in your browser and can be shared as a link.
- **Landscape:** coverage by maturity, category or venue, and a map of two goals against each other.
- **Properties:** one page per property, showing every protocol's answer side by side.
- **Search:** every summary, answer and specification quote (press `/` on any page).
- **Add a report:** upload a report from the skill. If the protocol exists you choose
  replace, keep both versions, or cancel.

Uploading works in two places: locally through `scripts/serve.py`, and on Netlify
through the upload function (see "Uploads on Netlify" below). On any other static host
the site is read-only, and new reports are added with the script below.

## Uploads on Netlify
On Netlify, `netlify/functions/reports.mjs` handles uploads. It checks the report,
asks for an upload password, and commits the file to `reports/` in GitHub. The commit
starts a normal deploy, which runs the skill's full linter and publishes the new
dataset in a minute or two. A report that fails the full check is left out of the site
(the build log and the Add a report page say why), so a bad upload cannot break it.

One-time setup:
1. On GitHub, create a fine-grained personal access token with access to this
   repository only and the permission **Contents: Read and write**.
2. In Netlify, open Site configuration, then Environment variables, and add:
   - `UPLOAD_PASSWORD`: the password people type on the Add a report page
   - `GITHUB_TOKEN`: the token from step 1 (mark it as a secret)
   - `GITHUB_REPO`: `owner/name` of this repository
   - `GITHUB_BRANCH`: the branch Netlify deploys (optional, default `main`)
3. Redeploy the site. The Add a report page then shows a password field.

Every upload is a normal commit in the repository, so it can be reviewed or reverted
like any other change. Pull before you push from your own computer.

## Adding a protocol
1. Run the skill on the protocol (e.g. "Analyse AAuth using the protocol analyzer
   skill") and save the HTML report it produces.
2. Add it:
   ```
   python scripts/add_report.py path/to/report.html
   ```
   If the protocol is already in the dataset, you are asked whether to replace it,
   keep both versions, or cancel.

## Protocols included
| Protocol | Category | Status |
|---|---|---|
| A2A | Agent communication | Draft analysis |
| AAuth | Agent authorization | Draft analysis |
| ACP | Agentic commerce | Draft analysis |
| ANS | Discovery registry | Draft analysis |
| AP2 | Agentic commerce | Draft analysis |
| ERC-8004 | Discovery registry | Draft analysis |
| ID-JAG (Cross App Access) | Agent authorization | Draft analysis |
| KYA-OS | Agent authorization | Draft analysis |
| MCP Authorization | Agent authorization | Draft analysis |
| Verifiable Intent | Agentic commerce | Draft analysis |
| Visa TAP | Agentic commerce | Draft analysis |
| Web Bot Auth | Web bot identity | Draft analysis |
| WIMSE WIT + WPT | Workload identity | Draft analysis |
| x402 | Agentic commerce | Draft analysis |

## Project layout
See `CLAUDE.md` for the full brief, data model and roadmap.
