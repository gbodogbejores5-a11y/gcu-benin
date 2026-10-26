import { getSB, esc, icon, bg, initials, safe, emptyState, hydrateIcons, observeReveals, notConfiguredNotice } from "./app.js";
const chart = document.getElementById("org-chart"), lead = document.getElementById("leaders");

function node(u, byParent) {
  const kids = byParent[u.id] || [];
  return `<div class="org-branch"><div class="org-node"><button class="org-node-btn" type="button" aria-expanded="false">${esc(u.name)} ${icon("chevron", 20)}</button>
    <div class="org-node-desc">${esc(u.description || "Description à venir.")}</div></div>
    ${kids.length ? `<div class="org-arrow" aria-hidden="true"></div><div class="org-children">${kids.map((k) => node(k, byParent)).join("")}</div>` : ""}</div>`;
}
(async () => {
  const sb = await getSB();
  if (!sb) { chart.innerHTML = notConfiguredNotice(); lead.innerHTML = ""; return; }
  const [units, leaders] = await Promise.all([
    safe(sb.from("org_units").select("*").eq("is_published", true).order("position")),
    safe(sb.from("leaders").select("*").eq("is_published", true).order("position")),
  ]);
  const ids = new Set(units.map((u) => u.id)), by = {};
  units.forEach((u) => { const p = ids.has(u.parent_id) ? u.parent_id : "root"; (by[p] = by[p] || []).push(u); });
  chart.innerHTML = by.root?.length ? `<div>${by.root.map((u) => node(u, by)).join("")}</div>` : emptyState("Organigramme à venir", "La structure sera présentée ici.", "sitemap");
  chart.addEventListener("click", (e) => {
    const b = e.target.closest(".org-node-btn"); if (!b) return;
    const n = b.parentElement; const o = n.classList.toggle("open"); b.setAttribute("aria-expanded", o);
  });
  lead.innerHTML = leaders.length ? leaders.map((l) => `<article class="card leader reveal"><div class="avatar" ${l.photo_url ? bg(l.photo_url) : ""}>${l.photo_url ? "" : esc(initials(l.full_name))}</div>
    <h3>${esc(l.full_name)}</h3><span class="role">${esc(l.role_title)}</span>${l.bio ? `<p>${esc(l.bio)}</p>` : ""}${l.responsibilities ? `<p class="muted" style="font-size:.9rem"><strong>Responsabilités :</strong> ${esc(l.responsibilities)}</p>` : ""}</article>`).join("")
    : `<div style="grid-column:1/-1">${emptyState("Équipe dirigeante à venir", "Les responsables seront présentés ici après leur désignation officielle.", "users")}</div>`;
  hydrateIcons(); observeReveals();
})();
