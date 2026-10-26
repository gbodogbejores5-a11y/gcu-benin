import { esc, icon, bg, fmtDate, dayNum, monthShort, fmtTime, truncate, OPP_TYPES } from "./app.js";

export function newsCard(n) {
  return `<a class="card reveal" href="actualites.html?id=${esc(n.id)}">
    <div class="card-media ${n.image_url ? "" : "ph"}" ${bg(n.image_url)}>${n.image_url ? "" : `<div class="ph-icon">${icon("news", 48)}</div>`}</div>
    <div class="card-body"><span class="pill amber">${esc(n.category)}</span><h3>${esc(n.title)}</h3>
    <p>${esc(truncate(n.summary || n.content, 130))}</p><div class="meta"><span>${icon("calendar", 15)} ${fmtDate(n.published_at || n.created_at)}</span></div></div></a>`;
}
export function eventRow(e) {
  const cancelled = e.status === "annule";
  return `<article class="event-row reveal ${cancelled ? "cancelled" : ""}">
    <div class="date-block"><b>${dayNum(e.starts_at)}</b><span>${monthShort(e.starts_at)}</span></div>
    <div><h3>${esc(e.title)}</h3>
      <div class="meta"><span>${icon("clock", 15)} ${fmtTime(e.starts_at)}</span>${e.location ? `<span>${icon("pin", 15)} ${esc(e.location)}</span>` : ""}
      ${cancelled ? '<span class="pill red">Annulé</span>' : e.registration_required ? '<span class="pill blue">Inscription requise</span>' : '<span class="pill green">Entrée libre</span>'}</div></div>
    <a class="btn btn-outline btn-sm" href="evenements.html?id=${esc(e.id)}">Détails</a></article>`;
}
export function oppCard(o) {
  const t = OPP_TYPES[o.type] || OPP_TYPES.stage;
  return `<a class="card reveal" href="opportunites.html?id=${esc(o.id)}"><div class="card-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill ${t.cls}">${t.label}</span>${o.is_verified ? `<span class="pill green">${icon("check", 12)} Vérifié</span>` : ""}</div>
    <h3>${esc(o.title)}</h3><p>${esc(o.organization || "")}</p>
    <div class="meta">${o.location ? `<span>${icon("pin", 15)} ${esc(o.location)}</span>` : ""}${o.deadline ? `<span>${icon("clock", 15)} Avant le ${fmtDate(o.deadline)}</span>` : ""}</div></div></a>`;
}

