# Analysis data format (JSON, schema v2.1)

The analysis is written as JSON first. This is a **working file**: the scripts check it
and turn it into the HTML report, which embeds a copy of it. The user receives only the
HTML file. See `examples/` for three complete files.

```json
{
  "schema_version": "2.1",
  "rubric_version": "2.1",
  "analysed_on": "2026-11-18",
  "protocol": {
    "name": "Web Bot Auth",
    "full_name": "HTTP Message Signatures for automated traffic",
    "spec_version": "draft-ietf-webbotauth-httpsig-protocol-00",
    "spec_date": "2026-09-01",
    "maintainer": "IETF webbotauth working group (editors from Cloudflare and Google)",
    "newer_version_note": "A -01 revision exists and was not analysed."
  },
  "profile": {
    "id": "web-bot-auth",
    "category": "web-bot-identity",
    "secondary_categories": [],
    "mechanisms": ["http-message-signature"],
    "venue": "ietf-wg",
    "maturity": "draft",
    "openness": "open-standard",
    "layers": ["http-header"],
    "building_blocks": ["RFC 9421", "RFC 7517", "RFC 7638", "RFC 8615"],
    "website": "https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/",
    "first_published": ""
  },
  "review": {"status": "draft", "reviewed_by": "", "reviewed_on": ""},
  "summary": [
    "Paragraph 1: what problem the protocol solves, who it is for, who maintains it and how mature it is.",
    "Paragraph 2: how it works at a high level and its main features, and what it leaves out."
  ],
  "how_it_works": [
    "Step 1, naming who does what.",
    "Step 2 ..."
  ],
  "sources": [
    {
      "id": "spec",
      "title": "HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00",
      "url": "https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/",
      "fetch_url": "https://raw.githubusercontent.com/.../draft-ietf-webbotauth-httpsig-protocol.md",
      "version": "-00",
      "date": "2026-09-01",
      "kind": "primary"
    }
  ],
  "rows": [
    {
      "id": "credential_lifetime",
      "group": "Credential and validity",
      "property": "Credential lifetime",
      "short": "24 hours, recommended",
      "answer": "Recommended, not enforced. Each signature carries created and expires times, ...",
      "rating": "yellow",
      "coverage": "optional",
      "requirement": "SHOULD",
      "rating_reason": "Yellow: a long limit recommended for the signer with no rule for verifiers (same as MCP Authorization).",
      "claims": [
        {
          "text": "What this claim establishes, in plain words.",
          "type": "fact",
          "source": "spec",
          "section": "Generating HTTP Message Signature",
          "quote": "It is RECOMMENDED that expiry be no more than 24 hours."
        }
      ]
    }
  ],
  "goals_reading": {
    "access_control": "One or two sentences on what the service can allow or refuse.",
    "incident_response": "One or two sentences on what the service can do when something goes wrong, and at what granularity.",
    "accountability": "One or two sentences on whom an action can be traced to."
  },
  "notes": ["Gated specification, lowercase requirement words, instructions aimed at AI tools on a page, sources that could not be checked automatically."],
  "open_questions": ["Things the sources did not settle."]
}
```

## Field rules
- `profile`: required. Every value must come from the vocabularies in `profile.md`.
- `review`: required. The skill always sets `status` to `draft`.
- `summary`: a list of exactly two paragraphs, each about 60 to 130 words, in plain
  language. Paragraph 1: the problem, who it is for, who maintains it, maturity.
  Paragraph 2: how it works and its main features, and its main limits.
- `how_it_works`: 3 to 7 steps for one typical request, from setup to the service's
  decision.
- `rows`: every property `id` from `properties.md`, in that order. `group` and
  `property` use the names in `properties.md`.
- `rating`: `green`, `yellow`, `red`, or `n/a` (only for summary, use_cases, actors,
  building_blocks).
- `coverage`: `required`, `default`, `optional`, `extension`, `outside`, `none`,
  `out_of_scope`; `n/a` for descriptive rows and for status_adoption.
- `requirement`: `MUST`, `SHOULD`, `MAY`, `MUST NOT`, `SHOULD NOT`, `MUST*`, `SHOULD*`,
  `MAY*`, or `none`.
- `short`: at most 8 words. `answer`: 2 to 4 sentences, about 40 to 110 words (the
  summary row can be one sentence).
- `rating_reason`: required for rated rows.
- `claims[].type`: `fact`, `inference`, `silent`, `out_of_scope`. `quote` is required
  for `fact` and `out_of_scope` (at most 40 words) and must be `""` for `silent`.
- `claims[].check` and `claims[].check_fp` are written by `scripts/check_quotes.py`.
  Do not type them by hand.
- Every `claims[].source` must match a `sources[].id`. `fetch_url` is optional.
- `goals_reading`: required, one entry per goal.
