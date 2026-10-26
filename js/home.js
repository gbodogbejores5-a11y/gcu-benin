import { getSB, esc, icon, bg, fmtDate, dayNum, monthShort, fmtTime, truncate, safe, loader, emptyState, observeReveals, countUps, hydrateIcons, loadSettings, socialLinks, isConfigured, notConfiguredNotice, RESOURCE_CATEGORIES, CATEGORY_ICONS, OPP_TYPES, isExpired, fmtDateTime } from "./app.js";

import { newsCard, eventRow, oppCard } from "./ui.js";
const $id = (i) => document.getElementById(i);

async function init() {
  hydrateIcons();
  // Domaines (statique, toujours visible)
  $id("home-resources").innerHTML = RESOURCE_CATEGORIES.slice(0, 8).map((c, i) => `<a class="feature reveal" data-delay="${i % 4}" href="ressources.html?cat=${encodeURIComponent(c)}"><div class="icon-badge">${icon(CATEGORY_ICONS[c] || "folder", 26)}</div><h4>${esc(c)}</h4></a>`).join("");

  const s = await loadSettings();
  $id("home-socials").innerHTML = socialLinks(s);

  const sb = await getSB();
  const stat = (n, l) => `<div class="stat"><b data-count="${n}">0</b><span>${l}</span></div>`;
  let stats = [];

  if (!sb) {
    const note = notConfiguredNotice();
    $id("home-news").innerHTML = note; $id("home-events").innerHTML = note; $id("home-opps").innerHTML = note;
  } else {
    const nowISO = new Date().toISOString();
    const [news, events, opps, partners, st] = await Promise.all([
      safe(sb.from("news").select("id,title,category,summary,content,image_url,published_at,created_at").eq("is_published", true).order("published_at", { ascending: false }).limit(3)),
      safe(sb.from("events").select("id,title,location,starts_at,status,registration_required").in("status", ["publie", "annule"]).gte("starts_at", nowISO).order("starts_at").limit(3)),
      safe(sb.from("opportunities").select("id,type,title,organization,location,deadline,is_verified").eq("is_published", true).order("created_at", { ascending: false }).limit(6)),
      safe(sb.from("partners").select("name,logo_url,website").eq("is_published", true).order("position")),
      safe(sb.rpc("public_stats"), null),
    ]);
    $id("home-news").innerHTML = news.length ? news.map(newsCard).join("") : emptyState("Bientôt des actualités", "Les annonces officielles de la communauté seront publiées ici.", "news");
    $id("home-events").innerHTML = events.length ? events.map(eventRow).join("") : emptyState("Aucun événement programmé", "Les prochaines rencontres, conférences et ateliers apparaîtront ici.", "calendar");
    const live = opps.filter((o) => !isExpired(o.deadline)).slice(0, 3);
    $id("home-opps").innerHTML = live.length ? live.map(oppCard).join("") : emptyState("Aucune offre pour le moment", "Les stages, formations et emplois vérifiés seront publiés ici.", "briefcase");
    if (partners.length) {
      $id("home-partners-wrap").hidden = false;
      $id("home-partners").innerHTML = partners.map((p) => `<${p.website ? `a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer"` : "div"} class="card reveal"><div class="card-body" style="align-items:center;text-align:center;justify-content:center;min-height:130px">${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="${esc(p.name)}" style="max-height:70px;width:auto" loading="lazy">` : `<h4 style="margin:0">${esc(p.name)}</h4>`}</div></${p.website ? "a" : "div"}>`).join("");
    }
    if (st) {
      if (st.members > 0) stats.push([st.members, st.members > 1 ? "membres" : "membre"]);
      if (st.events > 0) stats.push([st.events, "événements"]);
      if (st.resources > 0) stats.push([st.resources, "ressources"]);
      if (st.opportunities > 0) stats.push([st.opportunities, "opportunités"]);
    }
  }
  stats.unshift([RESOURCE_CATEGORIES.length, "domaines techniques"]);
  if (stats.length < 3) stats.push([4, "organes de gouvernance"], [10, "valeurs fondatrices"]);
  $id("home-stats").innerHTML = stats.slice(0, 5).map(([n, l]) => stat(n, l)).join("");
  hydrateIcons(); observeReveals(); countUps();
}
init();
