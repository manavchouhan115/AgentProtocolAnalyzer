# Common mistakes (check every analysis against this list)

These mistakes come up often when analysing agent identity and authorization protocols.
Go through the list in the review step (SKILL.md, Step 6) and fix any that apply.

## Requirement levels
1. **"may" read as SHOULD.** Visa TAP says interactions "may contain" the consumer
   recognition object. That makes it optional; it is not a SHOULD and not "common
   practice". Quote the exact word.
2. **SHOULD read as MUST.** "It is RECOMMENDED that expiry be no more than 24 hours"
   (Web Bot Auth) is a recommendation for the signer, not a limit verifiers enforce.
3. **Optional field read as present.** "Can carry" or "MAY include" means many
   deployments will not send it. Rate it as `optional`.

## Who does what
4. **The resource server does not authenticate the user.** In MCP Authorization, the
   authorization server signs the user in and checks the PKCE code verifier. The MCP
   server only validates the token.
5. **A provider's key is not an agent identity.** Web Bot Auth and Visa TAP verify the
   agent provider's key. Every agent from that provider shares it. That is not
   authentication of the agent.
6. **Something another party learns is not something the service learns.** The
   authorization server knows the user; the payment network knows the transaction. Ask
   what the receiving service sees.
7. **"Instance" can mean an install, not a process.** Check how the spec defines it.

## Core or not core
8. **Deprecated features.** MCP 2026-07-28 deprecates Dynamic Client Registration in
   favour of Client ID Metadata Documents. Check deprecation notes and changelogs.
9. **Proposals are not the protocol.** An extension that is still a proposal (e.g. a
   DPoP proposal for MCP) is not part of the specification. Mark official extensions as
   `extension` and say their status.
10. **Separate products are outside.** Visa TAP's spending limits and passkey approval
    belong to Visa Intelligent Commerce, not TAP.
11. **"Could be added" is not "supported".** RFC 7662 introspection could expose the
    user to an MCP server, but MCP does not require it. Mention it; do not count it.
12. **"Aligned with X" needs a meaning.** Visa TAP is aligned with Web Bot Auth only in
    that both use RFC 9421 signatures in HTTP headers. Say in what sense.

## Revocation and lifetimes
13. **Key removal is not revocation.** Removing a key from a directory or key store
    takes effect only when each verifier's cached copy expires.
14. **Token type changes revocation speed.** With RFC 7009, an opaque token checked by
    introspection stops working at once; a self-contained JWT keeps working until it
    expires.
15. **Granularity matters.** Say whether access can be cut off for one agent, one user,
    or only a whole provider.

## Sources and versions
16. **Version drift.** Drafts change often. Pin the version and say if a newer one exists.
17. **Name collisions.** Different specifications can share a name (e.g. two unrelated
    IETF drafts called "AAuth"). Confirm the authors and the document name.
18. **Overview pages are not specifications.** Product pages describe goals; use the
    specification for technical claims.
19. **Invented section numbers.** Use the heading if you do not have a real number.
20. **Shortened or reworded quotes from web tools.** Re-check every quote against the
    source text.
21. **Adoption from listings.** "X supports Y" needs X's own documentation.

## Writing
22. **Calling a scope decision a failure.** Say "out of scope" and quote the line.
23. **Validity described as trust or authentication.** Keep the three apart.
24. **Overclaiming.** "The most secure" or "covers everything" are not claims the
    evidence can support. Say what the protocol does.
25. **Naming a building block without saying what it solves.** If you mention another
    standard as a possible addition, say which property it would address.
26. **A label instead of an explanation.** "Yes." alone does not tell the reader how the
    protocol does it. Every answer explains the mechanism.
