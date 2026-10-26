import { getSB, esc, icon, fmtDate, fmtTime, safe, emptyState, observeReveals, hydrateIcons, isConfigured, notConfiguredNotice, truncate } from "./app.js";
import { eventRow } from "./ui.js";
const box = document.getElementById("act-list");
(async () => {
  const sb = await getSB();
  if (!sb) { box.innerHTML = notConfiguredNotice(); return; }
  const rows = await safe(sb.from("events").select("id,title,description,location,starts_at,status,registration_required").in("status", ["publie", "annule"]).order("starts_at", { ascending: false }).limit(12));
  box.innerHTML = rows.length ? rows.map(eventRow).join("") : emptyState("Aucune activité publiée pour le moment", "Chaque activité affichera son titre, sa description, sa date, son lieu et ses modalités de participation.", "calendar");
  hydrateIcons(); observeReveals();
})();
