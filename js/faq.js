import { getSB, esc, icon, safe, emptyState, hydrateIcons, notConfiguredNotice, mdLite, $ } from "./app.js";
const box = $("#faq-list");
(async () => {
  const sb = await getSB();
  if (!sb) { box.innerHTML = notConfiguredNotice(); return; }
  const rows = await safe(sb.from("faq").select("*").eq("is_published", true).order("position"));
  box.innerHTML = rows.length ? rows.map((f, i) => `<div class="acc-item"><button type="button" class="acc-btn" aria-expanded="false" aria-controls="fq${i}">${esc(f.question)} ${icon("chevron", 20)}</button><div class="acc-panel" id="fq${i}">${mdLite(f.answer)}</div></div>`).join("") : emptyState("Aucune question publiée", "La FAQ sera complétée prochainement.", "help");
  box.addEventListener("click", (e) => { const b = e.target.closest(".acc-btn"); if (!b) return; const it = b.parentElement, o = it.classList.toggle("open"); b.setAttribute("aria-expanded", o); });
  hydrateIcons();
})();
