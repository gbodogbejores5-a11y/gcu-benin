import { getSB, esc, icon, safe, emptyState, hydrateIcons, notConfiguredNotice, fmtDate, $ } from "./app.js";
const box = $("#g-list"), chips = $("#g-chips");
let items = [], cat = "", idx = 0;
const CATS = ["Rencontres", "Conférences", "Ateliers", "Activités éducatives", "Visites techniques", "Événements officiels"];
const lb = $("#lb");
$("#lb-x").innerHTML = icon("x", 22); $("#lb-p").innerHTML = icon("left", 22); $("#lb-n").innerHTML = icon("right", 22);
const view = () => items.filter((i) => !cat || i.category === cat);
function openLb(i) {
  const v = view(); idx = (i + v.length) % v.length; const it = v[idx];
  $("#lb-fig").innerHTML = (it.media_type === "video" ? `<video src="${esc(it.file_url)}" controls autoplay playsinline></video>` : `<img src="${esc(it.file_url)}" alt="${esc(it.title)}">`) + `<figcaption><strong>${esc(it.title)}</strong>${it.caption ? " — " + esc(it.caption) : ""}${it.event_label ? ` · ${esc(it.event_label)}` : ""}${it.taken_on ? ` · ${fmtDate(it.taken_on)}` : ""}</figcaption>`;
  lb.classList.add("open"); document.body.style.overflow = "hidden"; $("#lb-x").focus();
}
const closeLb = () => { lb.classList.remove("open"); $("#lb-fig").innerHTML = ""; document.body.style.overflow = ""; };
$("#lb-x").onclick = closeLb; $("#lb-p").onclick = () => openLb(idx - 1); $("#lb-n").onclick = () => openLb(idx + 1);
lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
document.addEventListener("keydown", (e) => { if (!lb.classList.contains("open")) return; if (e.key === "Escape") closeLb(); if (e.key === "ArrowLeft") openLb(idx - 1); if (e.key === "ArrowRight") openLb(idx + 1); });

function render() {
  const v = view();
  box.innerHTML = v.length ? v.map((it, i) => `<button type="button" class="g-item" data-i="${i}" aria-label="Agrandir : ${esc(it.title)}">
    ${it.media_type === "video" ? `<video src="${esc(it.file_url)}#t=0.1" preload="metadata" muted></video><span class="play">${icon("play", 18)}</span>` : `<img src="${esc(it.file_url)}" alt="${esc(it.title)}" loading="lazy">`}
    <span class="cap">${esc(it.title)}</span></button>`).join("") : emptyState("Aucun média pour le moment", "Les photos et vidéos autorisées des activités seront publiées ici.", "image");
  box.style.columns = v.length ? "" : "1";
  chips.innerHTML = ["", ...CATS].map((c) => `<button type="button" class="chip ${c === cat ? "active" : ""}" data-c="${esc(c)}">${c || "Tout"}</button>`).join("");
  hydrateIcons();
}
box.addEventListener("click", (e) => { const b = e.target.closest(".g-item"); if (b) openLb(+b.dataset.i); });
chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) { cat = b.dataset.c; render(); } });
(async () => {
  const sb = await getSB();
  if (!sb) { box.innerHTML = notConfiguredNotice(); return; }
  items = await safe(sb.from("gallery_items").select("*").eq("is_published", true).order("taken_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(200));
  render();
})();
