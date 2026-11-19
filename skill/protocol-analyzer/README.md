# Protocol analyzer

A Claude skill that explains and assesses any AI agent identity, authentication or
authorization protocol. Give it a protocol name, a specification or a website, and it
returns a single HTML report with:

- a two-paragraph summary in plain language
- a step-by-step "How it works"
- an at-a-glance table and a full table of 19 properties, each rated green (addressed),
  yellow (partly addressed) or red (not addressed) and explained
- a reading against three goals: access control, incident response and accountability
- evidence for every statement: the source, the section and a verbatim quote, checked
  automatically against the source where possible

Protocols are assessed from the side of the service that receives an AI agent's request
(a website, an API, a merchant). Ratings count only what the protocol's own
specification defines.

## Setup

### Claude apps (web, desktop)
1. Settings > Capabilities: turn on **Code execution** and **Web search**.
2. Customize > Skills > **Upload skill**, and choose `protocol-analyzer.zip`. If an
   older version is installed, remove it first.
3. In a new chat, ask for example:
   `Analyse AAuth (https://www.aauth.dev/) using the protocol analyzer skill`
4. You receive one file: `<protocol>.html`.

### Claude Code
1. Unzip so the folder is at `~/.claude/skills/protocol-analyzer/`.
2. In a project folder, run `claude` and ask:
   `Analyse AAuth using the protocol analyzer skill`.

To compare protocols you have already analysed, ask Claude to compare the HTML reports.
Each report carries its own data, so no other files are needed.

## How it works
1. Finds the specification and pins the exact version.
2. Collects evidence (verbatim quotes) for each property before rating anything.
3. Rates each property with fixed rules, calibrated against three worked examples:
   MCP Authorization, Web Bot Auth and Visa Trusted Agent Protocol.
4. Checks every quote against its source and lints the analysis for consistency and
   style.
5. Reviews the result against a list of common mistakes.
6. Renders the HTML report.

## Files
- `SKILL.md`: the workflow
- `references/properties.md`: the framework, the 19 properties and the rating rules
- `references/conventions.md`: evidence, requirement levels, coverage, writing style
- `references/pitfalls.md`: common mistakes checked in the review step
- `references/output-schema.md`: the analysis data format
- `references/examples/`: the three calibration examples, plus a Markdown report used
  when code cannot run
- `scripts/check_quotes.py`: checks every quote word for word against its source
- `scripts/lint.py`: format, consistency and style checks, plus calibration view
- `scripts/render.py`: builds the HTML report (and comparison tables on request)

## Notes
- The report is a well-sourced draft. Ratings in particular should be reviewed by a
  person before they are relied on.
- The calibration examples reflect MCP specification revision 2026-07-28, Web Bot Auth
  draft -00 and the Visa TAP specification page as accessed on 18 November 2026.
- Some sites block scripted downloads. Claude then re-checks those quotes with its web
  tool, and the report says how many quotes were verified.
- A full analysis uses a fair amount of usage, since it reads the specification in depth.
