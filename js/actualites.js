import { getSB, esc, icon, bg, fmtDate, safe, emptyState, observeReveals, hydrateIcons, notConfiguredNotice, mdLite, params, debounce, loader, NEWS_CATEGORIES, friendlyError } from "./app.js";
import { newsCard } from "./ui.js";
const root = document.getElementById("news-root");

async function detail(sb, id) {
  const { data, error } = await sb.from("news").select("*").eq("id", id).eq("is_published", true).maybeSingle();
  if (error || !data) { root.innerHTML = emptyState("Publication introuvable", "Cette actualité n'existe pas ou n'est plus publiée.", "news") + `<p class="center mt-2"><a class="btn btn-dark" href="actualites.html">Retour aux actualités</a></p>`; return; }
  document.title = `${data.title} — GCU-BÉNIN`;
  root.innerHTML = `<article class="prose" style="margin-inline:auto">
    <a href="actualites.html" class="btn btn-outline btn-sm">${icon("left", 16)} Toutes les actualités</a>
    <div class="mt-3"><span class="pill amber">${esc(data.category)}</span></div>
    <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin-top:12px">${esc(data.title)}</h1>
    <div class="meta mb-2">${icon("calendar", 15)} ${fmtDate(data.published_at || data.created_at)}</div>
    ${data.image_url ? `<div class="article-cover" ${bg(data.image_url)} role="img" aria-label=""></div>` : ""}
    ${data.summary ? `<p class="lead">${esc(data.summary)}</p>` : ""}
    ${mdLite(data.content)}</article>`;
  hydrateIcons();
}

async function list(sb) {
  const q = params();
  let cat = q.get("cat") || "", term = q.get("q") || "";
  root.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="n-q" type="search" placeholder="Rechercher une actualité…" aria-label="Rechercher" value="${esc(term)}"></div></div>
    <div class="chips mb-2" id="n-chips" style="margin-bottom:26px"></div><div class="grid grid-3" id="n-list">${loader()}</div>`;
  const chips = document.getElementById("n-chips"), out = document.getElementById("n-list");
  const drawChips = () => { chips.innerHTML = ["", ...NEWS_CATEGORIES].map((c) => `<button type="button" class="chip ${c === cat ? "active" : ""}" data-c="${esc(c)}">${c || "Toutes"}</button>`).join(""); };
  const load = async () => {
    out.innerHTML = loader();
    let req = sb.from("news").select("id,title,category,summary,content,image_url,published_at,created_at").eq("is_published", true).order("published_at", { ascending: false }).limit(60);
    if (cat) req = req.eq("category", cat);
    const t = term.replace(/[%,()]/g, " ").trim();
    if (t) req = req.or(`title.ilike.%${t}%,summary.ilike.%${t}%,content.ilike.%${t}%`);
    const rows = await safe(req);
    out.innerHTML = rows.length ? rows.map(newsCard).join("") : `<div style="grid-column:1/-1">${emptyState("Aucune actualité trouvée", t || cat ? "Essayez d'autres mots-clés ou une autre catégorie." : "Les annonces seront publiées ici.", "news")}</div>`;
    hydrateIcons(); observeReveals();
  };
  drawChips(); load();
  chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; cat = b.dataset.c; drawChips(); load(); });
  document.getElementById("n-q").addEventListener("input", debounce((e) => { term = e.target.value; load(); }, 300));
  hydrateIcons();
}

(async () => {
  const sb = await getSB();
  if (!sb) { root.innerHTML = notConfiguredNotice(); return; }
  const id = params().get("id");
  try { id ? await detail(sb, id) : await list(sb); } catch (e) { root.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; }
})();
