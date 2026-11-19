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

Uploading only works through `scripts/serve.py`. On a plain web host the site is
read-only, and new reports are added with the script below.

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
| MCP Authorization | Agent authorization | Draft analysis |
| Web Bot Auth | Web bot identity | Draft analysis |
| Visa Trusted Agent Protocol | Agentic commerce | Draft analysis |
| AAuth | Agent authorization | Draft analysis |

"Draft analysis" means the report was produced by the skill and has not yet been
reviewed by a person.

## Project layout
See `CLAUDE.md` for the full brief, data model and roadmap.
