import { state, esc, scoredProps, goals, SKILL_URL } from "../core.js";

export function renderAbout(el, _parts, params) {
  document.title = "About | Protocol Explorer";
  const groups = [];
  state.props.forEach((p) => {
    let g = groups.find((x) => x.name === p.group);
    if (!g) groups.push((g = { name: p.group, props: [] }));
    g.props.push(p);
  });
  el.innerHTML = `<div class="wrap page"><div class="prose">
    <h1>About the analyses</h1>
    <p style="font-size:18px;color:var(--ink-2);margin-top:14px">Each protocol is assessed from the side of the service that receives an AI agent's request, such as a website, an API or a merchant, because that is where an agent's access is allowed, refused, investigated and stopped.</p>

    <h2 style="margin-top:36px">Three goals</h2>
    <ul class="plain">${(state.data.goals || []).map((g) => `<li><b>${esc(g.label)}:</b> ${esc(g.definition)}</li>`).join("")}</ul>

    <h2 style="margin-top:36px">How ratings work</h2>
    <p>Every property is rated by what the protocol's own specification defines. Features that other standards or parties could add are described in the answer but do not count towards the rating.</p>
    <div class="legend" style="margin:14px 0">
      <span><i class="cell green"></i>Addressed: required or part of the normal flow</span>
      <span><i class="cell yellow"></i>Partly addressed: optional, an extension, or only part of it</span>
      <span><i class="cell red"></i>Not addressed, out of scope, or handled outside the protocol</span>
    </div>
    <p>“Not addressed” is not a judgement that the protocol is flawed. Many protocols leave things out on purpose to stay simple, and the analyses say so where the specification does.</p>
    <p>Coverage is the share of rated properties a protocol addresses, with partly addressed counting as half. Status and adoption is left out of coverage, because it describes maturity rather than what the protocol does.</p>

    <h2 style="margin-top:36px">Evidence and review</h2>
    <p>Every statement in an analysis is backed by a source, a section and a short verbatim quote. Quotes are checked automatically against the source where possible. Analyses marked “Draft analysis” were produced by the analysis skill and have not yet been checked by a person.</p>

    <h2 style="margin-top:36px" id="analyse">Analyse a protocol yourself</h2>
    <p>Every analysis here was made with the protocol-analyzer skill, and you can use it too.</p>
    <ol class="plain-num">
      <li><a href="${SKILL_URL}" target="_blank" rel="noopener">Download the protocol-analyzer skill</a>.</li>
      <li>Add it to Claude as a skill. Code execution must be turned on in Claude's settings.</li>
      <li>Ask Claude to analyse a protocol by name, specification or website, for example “Analyse AAuth using the protocol analyzer skill”. Claude Opus 5.5 with high effort gives the best results.</li>
      <li>Each protocol takes about 5 minutes. You get one HTML report: open it in a browser to read it, or <a href="#/add">add it to this explorer</a>.</li>
    </ol>

    <h2 style="margin-top:36px">How ranking works</h2>
    <p>On the <a href="#/rank">Rank</a> page you say how much each goal matters. Each property is linked to the goals it mainly serves, shown below. A property's weight is the average weight of its goals, which you can double or ignore for single properties. A protocol's score is the share of the weighted points it earns, out of 100. The links between properties and goals are this explorer's own reading of the framework, not part of the analyses.</p>
    <div class="cmp-wrap" style="max-height:none;margin-top:14px"><table class="cmp goal-map">
      <thead><tr><th scope="col" class="rowh">Property</th>${goals().map((g) => `<th scope="col">${esc(g.label)}</th>`).join("")}</tr></thead>
      <tbody>${scoredProps().map((p) => `<tr><th scope="row" class="rowh"><a href="#/properties/${esc(p.id)}">${esc(p.property)}</a></th>${goals().map((g) => `<td>${(p.goals || []).includes(g.id) ? `<span class="tick-yes" aria-label="Serves ${esc(g.label)}">Serves</span>` : `<span class="visually-hidden">No</span>`}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>

    <h2 style="margin-top:36px">The ${state.props.length} properties</h2>
    ${groups.map((g) => `<h3 style="margin-top:22px">${esc(g.name)}</h3><ul class="plain">${g.props.map((p) => `<li><b>${esc(p.property)}:</b> ${esc(p.question)}</li>`).join("")}</ul>`).join("")}
  </div></div>`;
  const target = params && params.get("s");
  if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
}
