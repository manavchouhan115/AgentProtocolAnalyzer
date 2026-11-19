# Protocol profile (fixed vocabularies)

Every analysis has a `profile` block that classifies the protocol, so that many analyses
can be filtered, grouped and compared consistently. Use only the values listed here
(`scripts/lint.py` checks them). If nothing fits, use `other` and explain it in `notes`.

Choose values from the evidence, the same way as the property ratings: describe the
protocol as its specification defines it, not as it might be used.

## id
A stable, lowercase slug for the protocol, e.g. `web-bot-auth`, `mcp-authorization`.
It must stay the same across versions of the analysis, because it is used to detect
duplicates. Use the protocol's common name, not a version number.

## category
The main problem the protocol solves (one value). Use `secondary_categories` (a list,
may be empty) for other problems it clearly also addresses.
- `agent-authorization`: delegated access and authorization for agents calling APIs,
  tools or services on behalf of users or organisations
- `web-bot-identity`: identifying bots and agents to websites they visit
- `agentic-commerce`: agents browsing, buying and paying for users
- `agent-communication`: messaging and collaboration between agents, including its
  identity layer
- `discovery-registry`: finding agents and their metadata (registries, directories,
  name services, agent cards)
- `workload-identity`: identity for software workloads and services, including agents
- `credentials-trust`: verifiable credentials, decentralised identifiers and trust
  frameworks applied to agents
- `attestation-provenance`: evidence of what runs behind an agent (model, code,
  environment)
- `other`

## mechanisms
How the agent side proves anything on each request (a list, at least one value).
- `bearer-token`: a token that works for whoever holds it
- `pop-token`: a token bound to a key the presenter must prove it holds (e.g. DPoP,
  tokens with a `cnf` key)
- `http-message-signature`: requests signed with HTTP Message Signatures (RFC 9421) or
  a similar request-signing scheme
- `mtls`: mutual TLS client certificates
- `x509-certificate`: X.509 certificates used outside TLS
- `verifiable-credential`: W3C Verifiable Credentials or similar signed claims
- `did`: decentralised identifiers
- `signed-metadata`: signed documents describing the agent (e.g. signed cards or
  manifests)
- `api-key`: shared secret keys
- `other`

## venue
Where the specification is developed and who controls changes to it (one value).
- `ietf-wg`: adopted by an IETF working group
- `ietf-individual`: an individual Internet-Draft, not adopted by a working group
- `w3c`: a W3C working group or community group
- `oidf`: an OpenID Foundation working group
- `other-sdo`: another standards body (e.g. ISO, ITU, ETSI)
- `foundation`: an open-source or industry foundation (e.g. under the Linux Foundation)
- `vendor`: a single company
- `community`: an independent open-source project or individual authors
- `government`: a government body or agency
- `other`

## maturity
- `standard`: a published standard (e.g. an RFC or a final W3C Recommendation)
- `stable`: a released version its maintainers say is ready for use, but not a formal
  standard (e.g. a dated protocol revision, a launched vendor specification)
- `draft`: a working-group draft or a published draft still expected to change
- `proposal`: an individual draft, exploration or early proposal
- `deprecated`: replaced or withdrawn

## openness
- `open-standard`: developed under a standards body's open process and IPR rules
- `open-specification`: published openly by a project or foundation for anyone to
  implement
- `vendor-terms`: available, but use is under a vendor's licence or terms
- `closed`: not publicly available

## layers
Where the identity or authorization information travels (a list).
- `http-header`: in HTTP request headers
- `http-body`: in the HTTP request body
- `token`: inside an access token or other token
- `transport`: at the connection level (e.g. TLS)
- `metadata-document`: in a published document about the agent or client
- `application-message`: inside application-level messages (e.g. agent-to-agent messages)
- `other`

## building_blocks
A list of the main standards it builds on, written as short names, e.g. `OAuth 2.1`,
`RFC 9421`, `RFC 7517`, `JWT`, `DID`, `PKCE`. Use RFC numbers where they exist. These
are free text but should be consistent across analyses.

## website
The main public page for the protocol (specification or home page).

## first_published
Year and month the protocol was first published (`YYYY-MM`), if known from a source.
Leave empty if not known.

# Review status

The `review` block records whether a person has checked the analysis.
- `status`: `draft` (produced by the skill, not yet reviewed) or `reviewed`
- `reviewed_by`, `reviewed_on`: fill in only when a person has reviewed it

The skill always writes `status: "draft"`. Only a person changes it to `reviewed`.
