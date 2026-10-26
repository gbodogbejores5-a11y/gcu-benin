import { getSB, esc, icon, safe, emptyState, hydrateIcons, observeReveals, notConfiguredNotice, friendlyError, $ } from "./app.js";
const list = $("#p-list");
(async () => {
  const sb = await getSB();
  if (!sb) { list.innerHTML = notConfiguredNotice(); return; }
  const rows = await safe(sb.from("partners").select("*").eq("is_published", true).order("position"));
  list.innerHTML = rows.length ? rows.map((p) => `<article class="card reveal"><div class="card-body">
    ${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="Logo ${esc(p.name)}" style="max-height:70px;width:auto;margin-bottom:8px" loading="lazy">` : ""}
    <h3>${esc(p.name)}</h3>${p.nature ? `<span class="pill blue">${esc(p.nature)}</span>` : ""}<p>${esc(p.description || "")}</p>
    ${/^https?:\/\//i.test(p.website || "") ? `<a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="width:fit-content">Site officiel ${icon("external", 15)}</a>` : ""}</div></article>`).join("")
    : `<div style="grid-column:1/-1">${emptyState("Les partenaires seront présentés ici", "Un organisme n'apparaît comme partenaire officiel qu'avec son accord.", "handshake")}</div>`;
  hydrateIcons(); observeReveals();
  const t0 = Date.now();
  $("#p-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("#p-out");
    const show = (t, m) => (out.innerHTML = `<div class="alert alert-${t}">${icon(t === "success" ? "check" : "alert", 20)}<div>${m}</div></div>`);
    if ($("#p-hp").value) return show("success", "Merci !");
    if (Date.now() - t0 < 3000) return show("error", "Prenez quelques secondes pour relire votre message.");
    const { error } = await sb.rpc("submit_partnership_request", { p: { organisation: $("#p-org").value, contact_name: $("#p-name").value, email: $("#p-email").value, phone: $("#p-phone").value, message: $("#p-msg").value } });
    if (error) return show("error", esc(friendlyError(error)));
    e.currentTarget.reset(); show("success", "Votre proposition a été transmise aux responsables autorisés. Merci pour votre intérêt !");
  });
})();
