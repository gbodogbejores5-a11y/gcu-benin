import { getSB, getSession, esc, icon, fmtDate, safe, emptyState, observeReveals, hydrateIcons, notConfiguredNotice, params, debounce, loader, toast, friendlyError, openModal, RESOURCE_CATEGORIES, CATEGORY_ICONS, truncate } from "./app.js";
const root = document.getElementById("res-root");
let sb, sess, isMember = false;

function card(r) {
  const locked = r.access === "membres" && !isMember;
  return `<article class="card reveal"><div class="card-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill blue">${icon(CATEGORY_ICONS[r.category] || "folder", 13)} ${esc(r.category)}</span>
    ${r.access === "membres" ? `<span class="pill dark">${icon("lock", 12)} Membres</span>` : `<span class="pill green">Public</span>`}</div>
    <h3>${esc(r.title)}</h3><p>${esc(truncate(r.description || "", 170))}</p>
    <div class="meta">${r.source ? `<span>${icon("file", 15)} ${esc(r.source)}</span>` : ""}<span>${icon("calendar", 15)} ${fmtDate(r.created_at)}</span></div></div>
    <div class="card-foot" style="display:flex;gap:8px;flex-wrap:wrap">
      ${locked ? `<a class="btn btn-dark btn-sm" href="connexion.html?next=ressources.html">${icon("lock", 15)} Réservé aux membres</a>` : `<button type="button" class="btn btn-primary btn-sm" data-open="${esc(r.id)}">${icon(r.file_path ? "download" : "external", 15)} ${r.file_path ? "Télécharger" : "Consulter"}</button>`}
      <button type="button" class="btn btn-outline btn-sm" data-report="${esc(r.id)}" title="Signaler ce document">${icon("flagalert", 15)} Signaler</button></div></article>`;
}

async function open(r) {
  if (r.file_path) {
    const { data, error } = await sb.storage.from("resources").createSignedUrl(r.file_path, 120);
    if (error || !data) return toast("Fichier indisponible ou accès refusé.", "error");
    window.open(data.signedUrl, "_blank", "noopener");
  } else if (/^https?:\/\//i.test(r.external_url || "")) window.open(r.external_url, "_blank", "noopener,noreferrer");
  else toast("Aucun fichier associé à cette ressource.", "error");
}

function report(id) {
  const m = openModal({ title: "Signaler une ressource", body: `<p class="muted">Document inapproprié, droits de diffusion incertains, contenu erroné… Les responsables examineront votre signalement.</p>
    <div class="field"><label for="rp-r">Motif du signalement <span class="req">*</span></label><textarea id="rp-r" maxlength="1000" required></textarea></div><div id="rp-msg" class="mt-1"></div>`,
    footer: `<button class="btn btn-outline" type="button" data-x>Annuler</button><button class="btn btn-primary" type="button" data-ok>Envoyer le signalement</button>` });
  m.$("[data-x]").onclick = m.close;
  m.$("[data-ok]").onclick = async () => {
    const { error } = await sb.rpc("report_content", { p_kind: "resource", p_target: id, p_reason: m.$("#rp-r").value });
    if (error) { m.$("#rp-msg").innerHTML = `<div class="alert alert-error">${esc(friendlyError(error))}</div>`; return; }
    m.close(); toast("Merci, votre signalement a été transmis.", "success");
  };
}

(async () => {
  sb = await getSB();
  if (!sb) { root.innerHTML = notConfiguredNotice(); return; }
  sess = await getSession();
  if (sess) { const { data } = await sb.from("members").select("status").eq("user_id", sess.user.id).maybeSingle(); isMember = data?.status === "actif"; }
  const q = params(); let cat = q.get("cat") || "", term = "";
  root.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="r-q" type="search" placeholder="Rechercher une ressource (titre, description, source)…" aria-label="Rechercher"></div></div>
    <div class="chips" id="r-chips" style="margin-bottom:26px"></div>
    ${!isMember ? `<div class="alert alert-info" style="margin-bottom:26px">${icon("lock", 20)}<div>Certaines ressources sont <strong>réservées aux membres</strong>. ${sess ? "Votre compte n'est pas encore relié à une adhésion validée." : `<a href="connexion.html?next=ressources.html">Connectez-vous</a> ou <a href="adhesion.html">rejoignez la communauté</a>.`}</div></div>` : ""}
    <div class="grid grid-3" id="r-list">${loader()}</div>`;
  const chips = document.getElementById("r-chips"), out = document.getElementById("r-list");
  let cache = [];
  const drawChips = () => { chips.innerHTML = ["", ...RESOURCE_CATEGORIES].map((c) => `<button type="button" class="chip ${c === cat ? "active" : ""}" data-c="${esc(c)}">${c || "Toutes"}</button>`).join(""); };
  const render = () => {
    out.innerHTML = cache.length ? cache.map(card).join("") : `<div style="grid-column:1/-1">${emptyState("Aucune ressource trouvée", cat || term ? "Essayez une autre recherche ou une autre catégorie." : "Les documents seront ajoutés prochainement.", "folder")}</div>`;
    hydrateIcons(); observeReveals(out);
  };
  const load = async () => {
    out.innerHTML = loader();
    let req = sb.from("resources").select("id,title,description,category,source,file_path,external_url,access,created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(100);
    if (cat) req = req.eq("category", cat);
    const t = term.replace(/[%,()]/g, " ").trim();
    if (t) req = req.or(`title.ilike.%${t}%,description.ilike.%${t}%,source.ilike.%${t}%`);
    cache = await safe(req); render();
  };
  drawChips(); load();
  chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; cat = b.dataset.c; drawChips(); load(); });
  document.getElementById("r-q").addEventListener("input", debounce((e) => { term = e.target.value; load(); }, 300));
  out.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]"), r = e.target.closest("[data-report]");
    if (o) open(cache.find((x) => x.id === o.dataset.open)); if (r) report(r.dataset.report);
  });
  hydrateIcons();
})().catch((e) => { root.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; });
