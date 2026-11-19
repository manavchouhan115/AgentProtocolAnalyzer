# Web Bot Auth: protocol analysis

**Specification:** draft-ietf-webbotauth-httpsig-protocol-00 (2026-09-01) · **Maintainer:** IETF Web Bot Auth (webbotauth) working group; editors T. Meunier (Cloudflare) and S. Major (Google) · **Analysed:** 2026-11-18

## Summary

Web Bot Auth is a way for bots and AI agents to prove, on every web request, which operator's key signed it. It is aimed at automated traffic on the open web (e.g. AI assistants, search indexing, content aggregation and automated testing), where websites today rely on IP address lists and User-Agent strings that are hard to manage or easy to fake. It is an Internet-Draft of the IETF Web Bot Auth working group, at revision -00 (September 2026). It has public implementations but is not yet an RFC.

The agent's operator publishes its public keys in a key directory at an HTTPS URL. The agent names that URL in a Signature-Agent header and signs each request with HTTP Message Signatures (RFC 9421), covering at least the target host and a validity window. A website, or a CDN in front of it, fetches the key and checks the signature without any prior relationship with the agent, and can then allow, rate-limit or block that operator. The draft deliberately leaves out who the user is, what the agent may do, whether the operator should be trusted, and how to revoke keys.

## How it works

1. The agent's operator creates a signing key and publishes the public key in a JSON key directory (JWKS), by default at a well-known URL on its own domain.
2. For each request, the agent adds a Signature-Agent header naming that directory and signs the request with an HTTP Message Signature covering the target host, with created and expires times, a keyid and the tag web-bot-auth.
3. The website, or a proxy or CDN in front of it, reads the signature headers and, if it does not already have the key, fetches it from the Signature-Agent URL.
4. It verifies the signature and checks that the current time is inside the signature's validity window.
5. It applies its own policy to the identified operator, e.g. allow, rate-limit or block.

## At a glance

| Property | Rating | Answer |
|---|---|---|
| **What is it?** | | |
| Summary |   | Bots and agents sign every HTTP request with a published key |
| Use cases |   | Bots and agents on the open web |
| Parties involved |   | Agent, origin, user (plus key directory) |
| Status and adoption | 🟡 Partly addressed | Draft |
| Building blocks |   | RFC 9421, JWKS, JWK thumbprint, well-known URIs |
| **Who is being identified?** | | |
| Identifier | 🟡 Partly addressed | Operator's key directory URL and key |
| Agent instance identifier | 🔴 Not addressed | No |
| Acting for (authority) | 🔴 Not addressed | No |
| **Credential and validity** | | |
| Credential type | 🟢 Addressed | HTTP Signature |
| Credential lifetime | 🟡 Partly addressed | 24 hours, recommended |
| Validity (credential validation) | 🟢 Addressed | Yes |
| **Authentication and authorization** | | |
| Authentication of the agent or user | 🔴 Not addressed | No, only verifies the operator's key |
| Scoped authorization | 🔴 Not addressed | No, out of scope |
| Human approval | 🔴 Not addressed | No, out of scope |
| **Trust** | | |
| Trust (who vouches for the agent) | 🔴 Not addressed | No one, out of scope |
| **Response and accountability** | | |
| Revocation | 🔴 Not addressed | None |
| Contact and escalation | 🔴 Not addressed | No |
| **Monitoring and provenance** | | |
| Cross-party signalling | 🔴 Not addressed | No, out of scope |
| Model identity | 🔴 Not addressed | No |

## Against the three goals

- **Access control:** The website learns only which operator's key signed the request. It can allow, rate-limit or block that operator, but receives no permissions or scopes.
- **Incident response:** Each website can block an operator's URL or key on its own. There is no revocation, and nothing reaches a specific agent instance.
- **Accountability:** An action can be traced to the holder of the operator's key, not to a user or an agent instance.

## Full analysis

### Summary

An IETF draft where bots and agents sign every HTTP request with a key published at their own URL, so websites can tell who they are without any prior relationship.

- Every request is signed with the provider's key. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Introduction)
  > "It proposes that every request from bots be signed by a private key owned by its provider."
- No prior relationship is needed. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Objectives and Constraints)
  > "Require no pre-established relationship between the two."

### Use cases

General web traffic from bots and agents (e.g. AI assistants, search indexing, content aggregation and automated testing) to ordinary websites. It works only at the HTTP layer, as signed HTTP headers, so websites need no special client setup. Verification can be done by the website itself or by a proxy or CDN in front of it, which can share cached keys across many websites.

- Target traffic. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Introduction)
  > "Agents are increasingly used in business and user workflows, including AI assistants, search indexing, content aggregation, and automated testing."
- HTTP layer only. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), HTTP Layer Choice)
  > "This protocol operates solely at the HTTP layer."
- Verification by the origin or a fronting proxy. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Deployment Models)
  > "Signature verification can be performed either directly by origins or delegated to a fronting proxy."
- Proxies can share cached keys. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Deployment Models)
  > "Proxy verification offloads processing and enables shared caching across multiple origins."

### Parties involved

Agent: the bot or AI agent that signs each request with its operator's key. Origin: the website that receives signed requests and verifies them, directly or through a fronting proxy or CDN. User: whoever starts the action, a person or another system; the protocol does not identify them. The agent's public keys are served from a key directory at an HTTPS URL.

- User definition. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Conventions and Definitions)
  > "An entity initiating requests through an agent. May be a human operator or another system."
- Origin definition. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Conventions and Definitions)
  > "An HTTP server receiving signed requests that implements the HTTP protocol and verifies"

### Status and adoption (🟡 Partly addressed)

Draft. An Internet-Draft adopted by the IETF Web Bot Auth working group (revision -00, September 2026); it is not yet an RFC, and revision -01 followed in October 2026. The draft lists public implementations of both signing and verifying.

*Why this rating:* Yellow: still a draft, even though it has public implementations.

- Working group draft. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Front matter)
  > "docname: draft-ietf-webbotauth-httpsig-protocol-latest"
- Public implementations are listed. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Implementations)
  > "This draft has a couple of public implementations."

### Building blocks

HTTP Message Signatures (RFC 9421) for signing requests; JSON Web Key Sets (RFC 7517) for the key directory; JWK thumbprints (RFC 7638) as key IDs; and a well-known URI (RFC 8615) for the default directory location. Client ID Metadata Documents can be used as another way to discover keys.

- The keyid is a JWK thumbprint. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "MUST be a base64url JWK SHA-256 Thumbprint"
- CIMD is one discovery type. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Key Distribution and Discovery)
  > "Resolve the member value as a Client ID Metadata Document"

### Identifier (🟡 Partly addressed)

Partly. The agent identifies itself with the HTTPS URL where its operator publishes its keys, sent in the Signature-Agent header. After verification, the website knows a pair: that URL and a key from it. This names the operator's key directory, which all of the operator's agents share, not an individual agent.

*Why this rating:* Yellow: the identifier names the provider's key URL, shared by all its agents (same as TAP).

- The URL is the identifier. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), The Signature-Agent URL is the identifier)
  > "An Agent identifies itself with the HTTPS URL it publishes its keys at, carried in Signature-Agent"
- What the verifier ends up with. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), The Signature-Agent URL is the identifier)
  > "What the verifier ends up with is a pair: that URL, and a key the URL provides."

### Agent instance identifier (🔴 Not addressed)

No. The draft suggests keys that represent a role, company or automation identity (e.g. a named crawler) rather than a person, to avoid linking traffic to individual users. Nothing in the protocol identifies a specific agent instance.

*Why this rating:* Red: no per-instance identifier (same as MCP Authorization and TAP).

- Keys are expected to represent a role or company. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), No Human Correlation)
  > "A key that represents a role, company, or automation identity (e.g., "news-aggregator-bot", "example-crawler-v1") avoids this."

### Acting for (authority) (🔴 Not addressed)

No. The draft does not authenticate human users and does not define authorization or delegation, and how a user directs an agent is outside its scope. The website learns nothing about whom the agent is acting for.

*Why this rating:* Red: explicitly out of scope.

- Out of scope. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Out of Scope)
  > "This protocol does not authenticate human users, does not provide anonymous authentication, and does not define authorization or delegation."
- How the user directs the agent is outside the draft. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Protocol Overview)
  > "How a User directs an Agent is outside the scope of this document."

### Credential type (🟢 Addressed)

An HTTP Message Signature (RFC 9421) on every request. It must cover the target host (@authority or @target-uri) and include created and expires times, a keyid (a thumbprint of the public key) and the tag web-bot-auth. Covering the method and path is only recommended and no nonce is required, so a signature over the host alone can be reused by anyone who sees it, against the same website, until it expires.

*Why this rating:* Green: a signature on every request that the site can verify (same as TAP).

- Host must be covered. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "Agents MUST include at least one of the following components:"
- Required parameters include created and expires. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "Agents MUST include the following @signature-params"
- Method and path are optional. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "Agents that want to narrow the scope of their signature SHOULD also cover the following components. A signer that omits them remains conformant."
- No extra nonce requirement. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Replay Protection)
  > "This document defines no additional nonce requirements."
- A host-only signature can be replayed until it expires. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "anyone who observes one request can reuse it against the same origin until then."

### Credential lifetime (🟡 Partly addressed)

Recommended, not enforced. Every signature must carry created and expires times, and the draft recommends that expiry be no more than 24 hours, but it sets no rule for verifiers. Because a signature over the host alone can be reused until it expires, a long expiry also widens the window for replay.

*Why this rating:* Yellow: a long limit that is only recommended for the signer (same as MCP Authorization).

- 24-hour recommendation. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "It is RECOMMENDED that expiry be no more than 24 hours."
- Created and expires are required. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "Agents MUST include the following @signature-params"
- A host-only signature can be replayed until it expires. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Generating HTTP Message Signature)
  > "anyone who observes one request can reuse it against the same origin until then."

### Validity (credential validation) (🟢 Addressed)

Yes. The website (or its proxy) reads the Signature-Agent header, fetches the operator's keys from that URL if it does not already have them, and verifies the signature and its time window. No prior relationship with the agent is needed. Verifiers should cache the key directory and refresh it when it expires, so key changes reach them only after that.

*Why this rating:* Green: verifiable against published keys with no prior relationship (same as MCP Authorization and TAP).

- Verification algorithm. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Validating Message Signature)
  > "Upon receiving an HTTP request, the origin has to verify the signature."
- Keys are fetched from the Signature-Agent URL. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Validating Message Signature)
  > "if the keyid is not known for that URL, the Origin MAY fetch key material as indicated by the Signature-Agent header"
- Verifiers cache the directory. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Key Rotation)
  > "Verifiers SHOULD cache the directory contents and refresh upon expiration"

### Authentication of the agent or user (🔴 Not addressed)

No. The signature proves that the request was signed with a key from the operator's directory, which all of the operator's agents share. The draft states that this says nothing about who operates the agent, whether it is benign, or whether the request is authorized. Human users are not authenticated.

*Why this rating:* Red: the site verifies a provider-level key, not the agent or user (same as TAP).

- A valid signature says only that a key holder signed. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), The Signature-Agent URL is the identifier)
  > "It says nothing about who operates the Agent, whether the Agent is benign, or whether the request is authorized."
- Human users are not authenticated. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Out of Scope)
  > "This protocol does not authenticate human users"

### Scoped authorization (🔴 Not addressed)

No (out of scope). The draft does not define authorization or delegation, so the website learns nothing about what the agent is allowed to do. What it gets is a reliable operator identity to which it can apply its own policy, e.g. allowlisting, denylisting or rate limits per operator.

*Why this rating:* Red: explicitly out of scope.

- Out of scope. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Out of Scope)
  > "does not define authorization or delegation"
- The motivation is operator-level allowlisting and rate limiting. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Motivation)
  > "support allowlisting/denylisting the traffic in a granular manor, and enable sites to monitor and rate limit per agent operator"

### Human approval (🔴 Not addressed)

No (out of scope). The protocol has no step where a person approves the agent's access, and how a user directs an agent is outside the draft's scope.

*Why this rating:* Red: authorization and user direction are out of scope.

- Out of scope. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Protocol Overview)
  > "How a User directs an Agent is outside the scope of this document."

### Trust (who vouches for the agent) (🔴 Not addressed)

No one, by design. A valid signature shows that the key came from the URL in the Signature-Agent header, not that the operator of that URL is honest or is who it appears to be. The draft does not define how trust is built, held or shared between websites, so each website decides for itself.

*Why this rating:* Red: trust is explicitly out of scope; registries are outside the protocol.

- Trust is out of scope. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Out of Scope)
  > "It does not define how trust is accrued, held, or exchanged, and it defines no mechanism for one origin to convey an opinion about an Agent to another."
- The URL does not vouch for honesty. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), What the URL Endorses)
  > "It does not say that the operator of that URL is honest, or that it is the same party everyone knows about."

### Revocation (🔴 Not addressed)

None. The draft states that it does not define a revocation mechanism. If a key is compromised, the only remedy is to remove it from the directory, and each verifier stops accepting it when its cached copy expires. Websites can still block an operator's URL or key on their own.

*Why this rating:* Red: the draft states it defines no revocation.

- No revocation defined. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Key Rotation)
  > "It is not a revocation mechanism, and this document does not define any."
- Key removal is the only remedy and waits for caches. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Key Compromise Response)
  > "Removing a compromised key from the directory is the only remedy, and it takes effect at each verifier on its next refresh"

### Contact and escalation (🔴 Not addressed)

No by default. The draft defines no contact or escalation channel. A separate individual draft (draft-meunier-webbotauth-registry-03) defines a Signature Agent Card whose optional contacts field lists ways to reach the operator, typically email addresses.

*Why this rating:* Red: the protocol draft defines no contact; the contacts field is optional and in a separate individual draft.

- Searched the protocol draft for contact, abuse or support fields. None is defined. (silent: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Whole document)
- Optional contacts in the Signature Agent Card (separate draft). (fact: [Registry and Signature Agent card for Web bot auth, draft-meunier-webbotauth-registry-03](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-registry/03/), Signature Agent Card)
  > "An array of URIs providing reliable communication channels, typically email addresses"
- All card parameters are optional. (fact: [Registry and Signature Agent card for Web bot auth, draft-meunier-webbotauth-registry-03](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-registry/03/), Signature Agent Card)
  > "Unless otherwise specified, all parameters in this document are OPTIONAL"

### Cross-party signalling (🔴 Not addressed)

No (out of scope). The draft explicitly defines no way for one website to pass its opinion of an agent to another.

*Why this rating:* Red: explicitly out of scope.

- Out of scope. (out_of_scope: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Out of Scope)
  > "it defines no mechanism for one origin to convey an opinion about an Agent to another"

### Model identity (🔴 Not addressed)

No. The signature identifies the key holder only. An agent may sign extra headers (e.g. one stating its intent), but no field for the AI model is defined.

*Why this rating:* Red: nothing identifies the model.

- Optional extra signed headers exist, but none for the model. (fact: [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/), Additional Headers)
  > "For example, an agent might include an HTTP header expressing its intent and sign it."

## Sources

- [HTTP Message Signatures for automated traffic, draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/)
- [Registry and Signature Agent card for Web bot auth, draft-meunier-webbotauth-registry-03](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-registry/03/)
