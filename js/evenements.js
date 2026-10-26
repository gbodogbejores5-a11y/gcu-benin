import { getSB, getSession, esc, icon, bg, fmtDate, fmtDateTime, fmtTime, dayNum, monthShort, safe, emptyState, observeReveals, hydrateIcons, notConfiguredNotice, mdLite, params, toast, friendlyError, loader } from "./app.js";
import { eventRow } from "./ui.js";
const root = document.getElementById("ev-root");
let sb;

async function detail(id) {
  const { data: e } = await sb.from("events").select("*").eq("id", id).in("status", ["publie", "annule"]).maybeSingle();
  if (!e) { root.innerHTML = emptyState("Événement introuvable", "Il n'existe pas ou n'est plus publié.", "calendar") + `<p class="center mt-2"><a class="btn btn-dark" href="evenements.html">Retour à l'agenda</a></p>`; return; }
  document.title = `${e.title} — GCU-BÉNIN`;
  const sess = await getSession();
  let isMember = false, registered = false, count = 0;
  if (sess) {
    const { data: m } = await sb.from("members").select("id,status").eq("user_id", sess.user.id).maybeSingle();
    isMember = !!m && m.status === "actif";
    const { data: r } = await sb.from("event_registrations").select("id").eq("event_id", id).eq("user_id", sess.user.id).maybeSingle();
    registered = !!r;
  }
  const past = new Date(e.starts_at) < new Date();
  const cancelled = e.status === "annule";
  let action = "";
  if (cancelled) action = `<div class="alert alert-error">${icon("alert", 20)}<div><strong>Cet événement est annulé.</strong></div></div>`;
  else if (past) action = `<div class="alert alert-info">${icon("info", 20)}<div>Cet événement est terminé.</div></div>`;
  else if (!e.registration_required) action = `<div class="alert alert-success">${icon("check", 20)}<div>Entrée libre : aucune inscription n'est nécessaire.</div></div>`;
  else if (!sess) action = `<a class="btn btn-primary" href="connexion.html?next=${encodeURIComponent("evenements.html?id=" + id)}">Se connecter pour s'inscrire</a><p class="hint mt-1">L'inscription est réservée aux membres.</p>`;
  else if (!isMember) action = `<div class="alert alert-warn">${icon("alert", 20)}<div>L'inscription est réservée aux membres actifs. <a href="adhesion.html">Faire une demande d'adhésion</a>.</div></div>`;
  else action = registered
    ? `<div class="alert alert-success">${icon("check", 20)}<div><strong>Vous êtes inscrit(e).</strong> Retrouvez cet événement dans votre espace membre.</div></div><button class="btn btn-outline mt-1" id="ev-cancel" type="button">Annuler mon inscription</button>`
    : `<button class="btn btn-primary" id="ev-join" type="button">S'inscrire à l'événement</button>`;

  root.innerHTML = `<article class="prose" style="margin-inline:auto">
    <a href="evenements.html" class="btn btn-outline btn-sm">${icon("left", 16)} Agenda</a>
    <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin-top:22px">${esc(e.title)}</h1>
    ${e.image_url ? `<div class="article-cover" ${bg(e.image_url)} role="img" aria-label=""></div>` : ""}
    <dl class="kv panel" style="margin:20px 0"><dt>Date</dt><dd>${fmtDateTime(e.starts_at)}${e.ends_at ? ` → ${fmtTime(e.ends_at)}` : ""}</dd>
      <dt>Lieu</dt><dd>${esc(e.location || "À préciser")}</dd>
      <dt>Participation</dt><dd>${e.registration_required ? "Inscription requise" : "Entrée libre"}${e.capacity ? ` · ${e.capacity} places` : ""}</dd>
      ${e.conditions ? `<dt>Conditions</dt><dd>${esc(e.conditions)}</dd>` : ""}</dl>
    ${mdLite(e.description || "")}
    <div class="mt-3" id="ev-action">${action}</div></article>`;
  hydrateIcons();
  document.getElementById("ev-join")?.addEventListener("click", async (ev) => {
    ev.currentTarget.disabled = true;
    const { error } = await sb.from("event_registrations").insert({ event_id: id, user_id: sess.user.id });
    if (error) { toast(friendlyError(error), "error"); ev.currentTarget.disabled = false; return; }
    toast("Inscription confirmée.", "success"); detail(id);
  });
  document.getElementById("ev-cancel")?.addEventListener("click", async () => {
    const { error } = await sb.from("event_registrations").delete().eq("event_id", id).eq("user_id", sess.user.id);
    if (error) return toast(friendlyError(error), "error");
    toast("Inscription annulée."); detail(id);
  });
}

function calendar(events) {
  let cur = new Date(); cur.setDate(1);
  let sel = null;
  const byDay = {};
  events.forEach((e) => { const k = new Date(e.starts_at).toLocaleDateString("sv-SE", { timeZone: "Africa/Porto-Novo" }); (byDay[k] = byDay[k] || []).push(e); });
  const box = document.getElementById("cal-box"), side = document.getElementById("cal-side");
  const draw = () => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const todayK = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Porto-Novo" });
    let cells = ["L", "M", "M", "J", "V", "S", "D"].map((d) => `<div class="cal-dow">${d}</div>`).join("") + '<div class="cal-day empty"></div>'.repeat(first);
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells += `<button type="button" class="cal-day ${byDay[k] ? "has" : ""} ${k === todayK ? "today" : ""} ${k === sel ? "sel" : ""}" data-k="${k}" ${byDay[k] ? "" : "tabindex='-1'"}>${d}</button>`;
    }
    box.innerHTML = `<div class="cal-head"><button type="button" id="cal-p" aria-label="Mois précédent">${icon("left", 18)}</button><b>${cur.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b><button type="button" id="cal-n" aria-label="Mois suivant">${icon("right", 18)}</button></div><div class="cal-grid">${cells}</div>`;
    side.innerHTML = sel && byDay[sel] ? byDay[sel].map(eventRow).join("") : `<p class="muted">Sélectionnez un jour marqué pour voir ses événements.</p>`;
    hydrateIcons(); observeReveals(side);
  };
  box.addEventListener("click", (ev) => {
    if (ev.target.closest("#cal-p")) { cur.setMonth(cur.getMonth() - 1); draw(); }
    else if (ev.target.closest("#cal-n")) { cur.setMonth(cur.getMonth() + 1); draw(); }
    else { const b = ev.target.closest(".cal-day.has"); if (b) { sel = b.dataset.k; draw(); } }
  });
  draw();
}

async function list() {
  const all = await safe(sb.from("events").select("id,title,location,starts_at,status,registration_required").in("status", ["publie", "annule"]).order("starts_at"));
  const now = new Date();
  const up = all.filter((e) => new Date(e.starts_at) >= now), past = all.filter((e) => new Date(e.starts_at) < now).reverse();
  root.innerHTML = `<div class="cal-layout">
    <div><div class="cal" id="cal-box"></div></div><div><h2 style="font-size:1.8rem">Jour sélectionné</h2><div id="cal-side"></div></div></div>
    <div class="mt-4"><div class="tabs" role="tablist"><button class="tab active" data-t="up" type="button">À venir (${up.length})</button><button class="tab" data-t="past" type="button">Archives (${past.length})</button></div>
    <div id="ev-list"></div></div>`;
  calendar(all);
  const out = document.getElementById("ev-list");
  const show = (t) => {
    const rows = t === "up" ? up : past;
    out.innerHTML = rows.length ? rows.map(eventRow).join("") : emptyState(t === "up" ? "Aucun événement à venir" : "Aucune archive", t === "up" ? "Les prochaines activités seront annoncées ici." : "Les événements passés apparaîtront ici.", "calendar");
    hydrateIcons(); observeReveals(out);
  };
  show("up");
  root.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (!b) return; root.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b)); show(b.dataset.t); });
  hydrateIcons();
}

(async () => {
  sb = await getSB();
  if (!sb) { root.innerHTML = notConfiguredNotice(); return; }
  const id = params().get("id");
  try { id ? await detail(id) : await list(); } catch (e) { root.innerHTML = `<div class="alert alert-error">${esc(friendlyError(e))}</div>`; }
})();
