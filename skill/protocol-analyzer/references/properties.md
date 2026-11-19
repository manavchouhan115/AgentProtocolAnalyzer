# Property rubric (v2.1)

## The framework

Every analysis looks at a protocol **from the side of the service that receives an AI
agent's request** (a website, an API, an MCP server, a merchant), because that is where
an agent's access is allowed, refused, investigated and stopped. Each property is judged
by how well it helps that service with three goals:

- **Access control:** the agent can only reach the resources and perform the actions it
  is allowed to.
- **Incident response:** if an agent causes harm, its access can be limited or stopped,
  and future incidents can be reduced.
- **Accountability:** an action can be traced back to the parties responsible for it
  (the agent provider, the user, the model provider, or a combination).

These goals should hold across the open ecosystem, not only inside one organisation or
between parties that already trust each other.

A red rating means the protocol does not help with that property. This is not
necessarily a flaw: many protocols leave things out on purpose to stay simple. Always say
when something is out of scope by design.

## How to use this file

Every analysis covers the 19 properties below, in this order, grouped as shown. For each
property you get the question, where to look in a spec, the rating rules, how the three
calibration examples are rated, and what to watch out for. The calibration examples are in
`examples/`: MCP Authorization (token based), Web Bot Auth (signature based, open web) and
Visa Trusted Agent Protocol (vendor, payments).

## General rating rules (apply to every rated row)

1. **Perspective.** Ask what the *receiving service* gets or learns. Something only the
   authorization server, the payment network or the agent provider learns does not count.
2. **Native-only.** Count only what the protocol's own specification defines. If a
   property is possible only because another building block or party *could* add it
   (e.g. an authorization server *could* expose the user through RFC 7662
   introspection; a provider *could* publish security.txt), explain this in the answer,
   but rate as if the property is absent.
3. **Coverage first, then colour.** Decide `coverage` before the rating:
   - `required`: the core spec makes it mandatory (MUST, or plain "must"/"will").
   - `default`: part of the normal flow the core spec describes, even if not a MUST.
   - `optional`: the core spec defines it, but as SHOULD/MAY/"may", or only in some modes.
   - `extension`: defined only in an optional extension or companion specification.
   - `outside`: handled by another system or programme outside the protocol (e.g. a
     vendor's separate product, the authorization server's own policy).
   - `none`: the spec does not address it.
   - `out_of_scope`: the spec explicitly says it does not cover it.
4. **Default colour mapping** (the property rules below take precedence):
   - green: `required` or `default`, and it gives the service what the question asks.
   - yellow: `optional` or `extension`, or the protocol gives only part of it (e.g. it
     names the provider but not the instance, or only coarse categories).
   - red: `none`, `out_of_scope` or `outside`.
5. **Ties.** If two colours both seem right, choose the lower one and explain why in
   `rating_reason`. An understated rating is easier to correct than an inflated one.
6. **Calibration.** Before finalising a row, compare it with the three calibration
   ratings below. A protocol that does the same thing as an example gets the same
   colour. If you rate it differently, say what is different in `rating_reason`.

Rating key: green = largely addressed, yellow = partly addressed, red = not addressed
(may be out of scope by design), n/a = descriptive row.

## Writing the answers

The table must give a reader the full picture of the protocol, so each `answer` explains,
not just labels:
- Start with a short verdict ("Yes.", "No.", "No by default.", "Partly.").
- Then explain **how** the protocol does it (what is sent, who checks it, against what).
- Then give the main limits, options or conditions (what is optional, what happens
  outside the protocol, what a service could add).
- 2 to 4 plain sentences, about 40 to 110 words. Define any term a non-specialist might
  not know the first time it appears.
- `short` is the at-a-glance version, at most 8 words.

---

## Group 1: What is it?

### summary
- **Property:** Summary
- **Question:** In one sentence, what does the protocol do, for whom, and what does the receiving service get from it?
- **Look for:** abstract, introduction, "Purpose and Scope".
- **Rating:** n/a.
- **Calibration:** MCP Authorization: "An OAuth 2.1 profile that lets an AI client get a user-approved, server-specific access token to call a protected MCP server's tools and data." Web Bot Auth: "An IETF draft where bots and agents sign every HTTP request with a key published at their own URL, so websites can recognise them without any prior relationship." Visa TAP: "Visa's protocol where approved shopping agents sign their requests to merchants and can attach signed consumer and payment data, for browsing and checkout."
- **Watch out:** describe the mechanism, not the marketing claim.

### use_cases
- **Property:** Use cases
- **Question:** Where is it used and between whom? At which layer (HTTP header, token, message body)? Who can verify it (the service itself, a CDN, a gateway)?
- **Look for:** introduction, deployment models, roles, examples.
- **Rating:** n/a.
- **Calibration:** MCP Authorization: tool and data access, HTTP transport layer, the authorization server can be an existing identity provider. Web Bot Auth: general web (crawlers, agents fetching pages), signed HTTP headers verified by the site or its CDN. Visa TAP: commerce (browsing and payment), a header signature plus signed objects in the body, verified by the merchant or its CDN.

### actors
- **Property:** Parties involved
- **Question:** Which parties does the spec define, and what does each do? Use the spec's own names and its "Roles", "Participants" or "Terminology" section.
- **Look for:** Roles, Participants, Terminology, architecture diagrams.
- **Rating:** n/a.
- **Calibration:** Visa TAP lists eight participants (Agent Providers, Checkout Enablers, Consumers, Site Protection Providers, Identity Provider, Merchants, Payment Schemes, Key Store). List them all, as the spec does.
- **Watch out:** do not invent parties and do not drop any that the spec lists. If the spec lists a resource (e.g. a key store) as a participant, keep it, with the spec's wording.

### status_adoption
- **Property:** Status and adoption
- **Question:** What is the formal status (RFC, current dated revision, working-group draft, individual draft, vendor specification)? Latest version and date? Who maintains it? Which named products send or verify it?
- **Look for:** spec header, IETF Datatracker status, versioning page, changelog, "Implementations" section, announcements by the deployer.
- **Rating:**
  - green: a released, non-draft version its maintainers say is ready for use (RFC, "current" dated revision, launched vendor specification), AND at least one named public deployment from a primary source.
  - yellow: still a draft (including working-group drafts), OR released with no named deployments.
  - red: early proposal (individual draft, exploration) with no named deployments.
- **Calibration:** MCP Authorization: green (current revision 2026-07-28, used by Claude's connectors). Web Bot Auth: yellow (working-group draft, even though it has public implementations). Visa TAP: green (vendor specification launched October 2025, developed with Cloudflare, which verifies it for merchants).
- **Watch out:** check for a newer revision before you start; drafts change often. Note dependencies that are still drafts. Adoption needs a named product and a source from the deployer, not a third-party listing.

### building_blocks
- **Property:** Building blocks
- **Question:** Which standards does it build on (with RFC numbers)? Note non-standard dependencies (vendor programmes) and deprecated parts.
- **Look for:** "Standards Compliance", normative references, "based on".
- **Rating:** n/a.
- **Calibration:** MCP Authorization: OAuth 2.1, RFC 6750, RFC 8414, RFC 9728, PKCE, Client ID Metadata Documents, RFC 8707 (Dynamic Client Registration deprecated). Web Bot Auth: RFC 9421, JWK/JWKS (RFC 7517), JWK thumbprint (RFC 7638), well-known URIs (RFC 8615). Visa TAP: RFC 9421, JWK/JWKS, JWS/JWT, plus Visa Intelligent Commerce (outside TAP).

## Group 2: Who is being identified?

### identifier
- **Property:** Identifier
- **Question:** What does the agent identifier look like, and what does it actually name (client application, agent provider, the provider's key or URL, a domain, the individual agent)?
- **Look for:** identifier definitions, client_id, keyid, Signature-Agent, `sub`, trust model.
- **Rating:**
  - green: the identifier names the individual agent (each running agent has its own).
  - yellow: it names the client application, the agent provider, its key or its URL, shared by all instances.
  - red: no identifier for the agent side.
- **Calibration:** MCP Authorization: yellow (`client_id` of the client application, ideally an HTTPS URL to its metadata). Web Bot Auth: yellow (the Signature-Agent URL plus key, shared by all of the provider's agents). Visa TAP: yellow (`keyid` of the agent provider's key in Visa's key store).
- **Watch out:** a key ID is not an agent ID unless each agent has its own key. Say whether all instances share it.

### instance_identifier
- **Property:** Agent instance identifier
- **Question:** Can the service tell which specific agent instance sent the request, not just which application or provider?
- **Look for:** per-instance keys or IDs, sub-agent IDs, session IDs that the spec says identify an agent.
- **Rating:**
  - green: yes, each instance has its own identifier and the service sees it by default.
  - yellow: defined but optional, only in some modes, or hidden from the service in common modes.
  - red: no.
- **Calibration:** red for all three.
- **Watch out:** check what "instance" means in that spec (an install, a process, a session). A nonce or session identifier is not an agent instance ID.

### acting_for
- **Property:** Acting for (authority)
- **Question:** Does the service learn whom the agent is acting for (user, consumer, organisation)? Is this required, optional, or only possible through another party?
- **Look for:** user or consumer identity objects, `sub`, ID tokens, token claims, introspection.
- **Rating:**
  - green: the protocol defines it and sends it to the service by default or as a requirement.
  - yellow: the protocol defines it but it is optional (SHOULD, MAY, lowercase "may") or only in some modes.
  - red: the protocol does not define it, or says it is out of scope. If another building block could add it (e.g. RFC 7662 `username`, RFC 9068 `sub`), say so in the answer, but it stays red.
- **Calibration:** MCP Authorization: red (not by default; only if the authorization server exposes it through introspection or token claims). Web Bot Auth: red (out of scope). Visa TAP: yellow (the Agentic Consumer Recognition Object is defined, but the spec says interactions "may contain" it).
- **Watch out:** "may" is not SHOULD. Do not describe something as common practice without a source.

## Group 3: Credential and validity

### credential_type
- **Property:** Credential type
- **Question:** What credential does the service receive on each request (bearer token, HTTP Message Signature, mTLS certificate, verifiable credential)? What exactly is signed or bound (host, path, time, nonce, body)? Is it proof of possession?
- **Look for:** request format, covered components, token usage, "Bearer".
- **Rating:**
  - green: a defined credential is presented on every request and the service can verify it.
  - yellow: a credential is defined but only on some requests, or is optional.
  - red: no credential (e.g. only a User-Agent string or IP address list).
- **Calibration:** green for all three. MCP Authorization uses a bearer token, which is still green here; the answer must state that it is not proof of possession (a stolen token works for whoever holds it) and that DPoP or mTLS binding are not part of the specification.
- **Watch out:** describe what is signed, not just "asymmetric keys". Say which parts are required and which are optional.

### credential_lifetime
- **Property:** Credential lifetime
- **Question:** How long is the credential valid? Is the limit a MUST, a SHOULD or unspecified? Is the verifier told to reject longer ones?
- **Look for:** `expires`, lifetime, "short-lived", time window, freshness, replay.
- **Rating:**
  - green: a specific short maximum (minutes, up to about one hour) that verifiers are told to enforce (reject or block if exceeded), even if the spec uses lowercase "should".
  - yellow: only recommended for the issuer or signer with no verifier rule, or no specific number, or a long limit (many hours or more).
  - red: unspecified.
- **Calibration:** MCP Authorization: yellow (authorization servers "SHOULD issue short-lived access tokens", no number). Web Bot Auth: yellow (expiry "RECOMMENDED" to be no more than 24 hours). Visa TAP: green (created and expires "should not be more than 8 minutes apart", and merchants should block otherwise).
- **Watch out:** keep credential lifetime separate from key lifetime and refresh tokens. Use `SHOULD*` when the spec uses lowercase "should".

### validity
- **Property:** Validity (credential validation)
- **Question:** Can the service check that the credential is genuine, current and unaltered, without a prior relationship with the agent? What does it check, and against what?
- **Look for:** verification steps, key discovery, token validation, audience checks.
- **Rating:**
  - green: yes, using published keys or the service's own authorization server, with expiry checks.
  - yellow: only after prior setup with the agent, or only some of genuine, current and unaltered.
  - red: no.
- **Calibration:** green for all three.
- **Watch out:** validity is not trust. A valid signature shows who holds the key, not whether to rely on them. Do not call validation "authentication".

## Group 4: Authentication and authorization

### authentication
- **Property:** Authentication of the agent or user
- **Question:** Does the receiving service itself authenticate the party making the request (the individual agent or the user)? Who exactly is authenticated, and by whom?
- **Look for:** who verifies what; whether the key or token belongs to the instance, the provider or the user; where the user signs in.
- **Rating:**
  - green: the service verifies, on each request, proof that belongs to the individual agent (e.g. a per-agent key), or authenticates the user itself.
  - yellow: the same, but only optionally or in some modes.
  - red: the service only checks a token issued elsewhere, or a provider-level key. User sign-in at a separate server does not count.
- **Calibration:** red for all three. MCP Authorization: the server only validates a bearer token; the authorization server authenticates the user. Web Bot Auth and Visa TAP: the service verifies the agent provider's key, not the agent or the user.
- **Watch out:** this is the most common mistake. Ask "whose key or sign-in is this?" before answering.

### authorization
- **Property:** Scoped authorization
- **Question:** Does the protocol tell the service what the agent is allowed to do (scopes, per-action limits)? How fine-grained is it?
- **Look for:** scopes, permissions, tags, limits, "authorization is out of scope".
- **Rating:**
  - green: the protocol carries scoped permissions the service can enforce.
  - yellow: only coarse categories (e.g. browsing vs paying), or limits handled by a separate system.
  - red: none, or out of scope.
- **Calibration:** MCP Authorization: green (OAuth scopes approved at the authorization server, with step-up for more). Web Bot Auth: red (out of scope). Visa TAP: yellow (only browse vs pay; spending limits are in Visa Intelligent Commerce, outside TAP).

### human_approval
- **Property:** Human approval
- **Question:** Does the protocol include a step where a person approves the agent's access or action? Can the service ask for it?
- **Look for:** consent, user interaction, step-up, passkey, approval.
- **Rating:**
  - green: the protocol defines a user approval step before the agent gets access.
  - yellow: defined but optional, or only for some actions.
  - red: none, out of scope, or done entirely outside the protocol.
- **Calibration:** MCP Authorization: green (the user authorizes in the browser before a token is issued). Web Bot Auth: red (out of scope). Visa TAP: red (approval happens outside TAP, via passkey in Visa Intelligent Commerce).
- **Watch out:** if approval can be delegated to software (e.g. a policy server or another AI agent), say so. That is not the same as a person approving.

## Group 5: Trust

### trust
- **Property:** Trust (who vouches for the agent)
- **Question:** Once the credential is valid, why should the service rely on the party behind it? Who vouches for the agent (a central authority, the authorization server and the user's consent, a registry, nobody)?
- **Look for:** trust model, onboarding, registries, "what the URL endorses", key store.
- **Rating:**
  - green: the protocol names a party that vouches, e.g. only agents that party approved get keys or tokens the service accepts.
  - yellow: vouching is optional or in a companion spec (e.g. an optional registry).
  - red: the protocol leaves trust out, or nobody vouches.
- **Calibration:** MCP Authorization: green (the authorization server named by the MCP server, plus the user's consent). Web Bot Auth: red (the draft "does not define how trust is accrued, held, or exchanged"; registries are optional and outside). Visa TAP: green (Visa, whose key store holds only onboarded agent providers' keys).
- **Watch out:** keep this separate from validity.

## Group 6: Response and accountability

### revocation
- **Property:** Revocation
- **Question:** Does the protocol define a way to revoke an agent's access? Who can revoke what, how fast does it take effect at the service, and at what granularity (one instance, one user, a whole provider)?
- **Look for:** revocation, key compromise, key removal, cache lifetime, token revocation.
- **Rating:**
  - green: the protocol defines revocation that reaches the verifying service promptly.
  - yellow: the protocol defines revocation, but it is slow, coarse, or does not reach every verifier.
  - red: the protocol does not define revocation. Say what is possible anyway (removing a key, RFC 7009 at the authorization server) and how long it takes to take effect.
- **Calibration:** MCP Authorization: red (not defined; the authorization server can revoke under RFC 7009: opaque tokens stop at once, JWTs keep working until they expire). Web Bot Auth: red (the draft "does not define any" revocation; removing a key works once caches expire). Visa TAP: red (not defined; Visa can remove a provider's key from its key store, and payments still pass through Visa's network).
- **Watch out:** removing or rotating a key is not revocation. Say the granularity (whole provider or one agent).

### contact_escalation
- **Property:** Contact and escalation
- **Question:** Can the service contact whoever is responsible for the agent (agent provider, user, model provider) if something goes wrong? Is a contact field required, optional or absent?
- **Look for:** contacts, metadata documents, support, abuse, security.txt.
- **Rating:**
  - green: the protocol requires a contact or escalation channel the service can use.
  - yellow: the protocol defines an optional contact field.
  - red: the protocol defines none. Mention routes outside the protocol (e.g. an optional `contacts` field in client metadata, security.txt, a payment network as a de facto contact).
- **Calibration:** red for all three.

## Group 7: Monitoring and provenance

### cross_party_signalling
- **Property:** Cross-party signalling
- **Question:** Can one service warn others about a misbehaving agent (shared signals, reputation, abuse reports)?
- **Look for:** reputation, shared signals, events, "opinion about an Agent".
- **Rating:** green = defined in the core spec; yellow = optional or in a companion spec; red = none or out of scope.
- **Calibration:** red for all three. Web Bot Auth says it "defines no mechanism for one origin to convey an opinion about an Agent to another".
- **Watch out:** events sent to the agent itself are not signals between services.

### model_identity
- **Property:** Model identity
- **Question:** Does the service learn which AI model (and version) is behind the agent? Is it verifiable or self-asserted?
- **Look for:** model, attestation, provenance, software statement, client info.
- **Rating:** green = verifiable model identity; yellow = self-asserted or optional; red = none.
- **Calibration:** red for all three. MCP clients SHOULD send `clientInfo` (client name and version), which names the client software, not the model.
