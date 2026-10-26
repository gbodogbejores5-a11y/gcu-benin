import { getSB, esc, icon, fmtDate, safe, emptyState, observeReveals, hydrateIcons, notConfiguredNotice, params, debounce, loader, toast, friendlyError, openModal, OPP_TYPES, isExpired, truncate, mdLite } from "./app.js";
import { oppCard } from "./ui.js";
const root = document.getElementById("opp-root");
let sb;

function reportModal(id) {
  const m = openModal({ title: "Signaler une offre", body: `<p class="muted">Offre expirée, suspecte, demande d'argent… Merci de préciser le motif.</p>
    <div class="field"><label for="rp-r">Motif <span class="req">*</span></label><textarea id="rp-r" maxlength="1000"></textarea></div><div id="rp-msg" class="mt-1"></div>`,
    footer: `<button class="btn btn-outline" type="button" data-x>Annuler</button><button class="btn btn-primary" type="button" data-ok>Envoyer</button>` });
  m.$("[data-x]").onclick = m.close;
  m.$("[data-ok]").onclick = async () => {
    const { error } = await sb.rpc("report_content", { p_kind: "opportunity", p_target: id, p_reason: m.$("#rp-r").value });
    if (error) { m.$("#rp-msg").innerHTML = `<div class="alert alert-error">${esc(friendlyError(error))}</div>`; return; }
    m.close(); toast("Merci, signalement transmis.", "success");
  };
}

async function detail(id) {
  const { data: o } = await sb.from("opportunities").select("*").eq("id", id).eq("is_published", true).maybeSingle();
  if (!o) { root.innerHTML = emptyState("Offre introuvable", "Elle n'existe pas ou a été retirée.", "briefcase") + `<p class="center mt-2"><a class="btn btn-dark" href="opportunites.html">Toutes les offres</a></p>`; return; }
  document.title = `${o.title} — GCU-BÉNIN`;
  const t = OPP_TYPES[o.type] || OPP_TYPES.stage, expired = isExpired(o.deadline);
  const apply = /^https?:\/\//i.test(o.apply_url || "") ? `<a class="btn btn-primary" href="${esc(o.apply_url)}" target="_blank" rel="noopener noreferrer">Postuler ${icon("external", 16)}</a>` : o.apply_email ? `<a class="btn btn-primary" href="mailto:${esc(o.apply_email)}?subject=${encodeURIComponent("Candidature : " + o.title)}">Postuler par e-mail</a>` : "";
  const src = /^https?:\/\//i.test(o.source_url || "") ? `<a class="btn btn-outline" href="${esc(o.source_url)}" target="_blank" rel="noopener noreferrer">Voir la source officielle ${icon("external", 16)}</a>` : "";
  root.innerHTML = `<article class="prose" style="margin-inline:auto">
    <a href="opportunites.html" class="btn btn-outline btn-sm">${icon("left", 16)} Toutes les offres</a>
    <div class="mt-3" style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill ${t.cls}">${t.label}</span>${o.is_verified ? `<span class="pill green">${icon("check", 12)} Offre vérifiée</span>` : `<span class="pill amber">Non vérifiée</span>`}${expired ? '<span class="pill red">Expirée</span>' : ""}</div>
    <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin-top:12px">${esc(o.title)}</h1>
    <dl class="kv panel" style="margin:20px 0"><dt>Structure</dt><dd>${esc(o.organization || "—")}</dd><dt>Lieu</dt><dd>${esc(o.location || "—")}</dd>
      <dt>Compétences</dt><dd>${esc(o.skills || "—")}</dd><dt>Date limite</dt><dd>${o.deadline ? fmtDate(o.deadline) : "Non précisée"}</dd><dt>Publiée le</dt><dd>${fmtDate(o.created_at)}</dd></dl>
    ${mdLite(o.description || "")}
    ${!o.is_verified ? `<div class="alert alert-warn mt-2">${icon("alert", 20)}<div>GCU-BÉNIN ne garantit pas une offre dont l'authenticité n'a pas été confirmée. Ne versez jamais d'argent pour obtenir un stage ou un emploi.</div></div>` : ""}
    <div class="mt-3" style="display:flex;gap:10px;flex-wrap:wrap">${expired ? "" : apply}${src}<button class="btn btn-outline" id="op-rp" type="button">${icon("flagalert", 16)} Signaler cette offre</button></div></article>`;
  document.getElementById("op-rp").onclick = () => reportModal(id);
  hydrateIcons();
}

async function list() {
  let type = "", term = "", loc = "", since = "", showExp = false;
  root.innerHTML = `<div class="tabs" id="o-tabs"><button class="tab active" data-t="" type="button">Toutes</button>${Object.entries(OPP_TYPES).map(([k, v]) => `<button class="tab" data-t="${k}" type="button">${v.label}s</button>`).join("")}</div>
    <div class="toolbar"><div class="grow">${icon("search", 18)}<input id="o-q" type="search" placeholder="Mot-clé (poste, structure, compétence)…" aria-label="Recherche"></div>
      <select id="o-loc" aria-label="Localisation"><option value="">Toutes localisations</option></select>
      <select id="o-since" aria-label="Date de publication"><option value="">Toutes dates</option><option value="7">7 derniers jours</option><option value="30">30 derniers jours</option><option value="90">3 derniers mois</option></select>
      <label class="check"><input type="checkbox" id="o-exp"> Afficher les expirées</label></div>
    <div class="grid grid-3" id="o-list">${loader()}</div>`;
  const out = document.getElementById("o-list");
  let all = [];
  const load = async () => {
    let req = sb.from("opportunities").select("id,type,title,organization,location,deadline,is_verified,created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(150);
    if (type) req = req.eq("type", type);
    if (since) req = req.gte("created_at", new Date(Date.now() - +since * 864e5).toISOString());
    const t = term.replace(/[%,()]/g, " ").trim();
    if (t) req = req.or(`title.ilike.%${t}%,organization.ilike.%${t}%,skills.ilike.%${t}%,description.ilike.%${t}%`);
    all = await safe(req);
    const locs = [...new Set(all.map((o) => o.location).filter(Boolean))].sort();
    const sel = document.getElementById("o-loc");
    if (sel.options.length <= 1) locs.forEach((l) => sel.insertAdjacentHTML("beforeend", `<option>${esc(l)}</option>`));
    render();
  };
  const render = () => {
    const rows = all.filter((o) => (!loc || o.location === loc) && (showExp || !isExpired(o.deadline)));
    out.innerHTML = rows.length ? rows.map(oppCard).join("") : `<div style="grid-column:1/-1">${emptyState("Aucune offre trouvée", "Modifiez vos filtres ou revenez bientôt.", "briefcase")}</div>`;
    hydrateIcons(); observeReveals(out);
  };
  load();
  document.getElementById("o-tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (!b) return; document.querySelectorAll("#o-tabs .tab").forEach((x) => x.classList.toggle("active", x === b)); type = b.dataset.t; load(); });
  document.getElementById("o-q").addEventListener("input", debounce((e) => { term = e.target.value; load(); }, 300));
  document.getElementById("o-loc").addEventListener("change", (e) => { loc = e.target.value; render(); });
  document.getElementById("o-since").addEventListener("change", (e) => { since = e.target.value; load(); });
  document.getElementById("o-exp").addEventListener("change", (e) => { showExp = e.target.checked; render(); });
  hydrateIcons();
}

(async () => {
  sb = await getSB();
  if (!sb) { root.innerHTML = notConfiguredNotice(); return; }
  const id = params().get("id");
  try { id ? await detail(id) : await list(); } catch (e) { root.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; }
})();
