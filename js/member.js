import { getSB, getSession, esc, icon, fmtDate, fmtDateTime, dayNum, monthShort, safe, emptyState, hydrateIcons, toast, friendlyError, siteUrl, CONFIG, LEVELS, COMMUNES, $, $$ } from "./app.js";
const root = document.getElementById("m-root");
let sb, sess, member, tab = "dash", qrLib;

const logout = async () => { await sb.auth.signOut(); location.replace("index.html"); };

async function qrData(text) {
  try { qrLib = qrLib || (await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm")).default; return await qrLib.toDataURL(text, { margin: 1, width: 280, color: { dark: "#0b1f3a", light: "#ffffff" } }); } catch { return ""; }
}

function nav(unread) {
  const items = [["dash", "dashboard", "Tableau de bord"], ["card", "idcard", "Ma carte de membre"], ["profile", "user", "Mon profil"], ["events", "calendar", "Mes événements"], ["notifs", "bell", `Notifications${unread ? ` (${unread})` : ""}`], ["settings", "settings", "Paramètres du compte"]];
  return `<nav class="side-nav" aria-label="Espace membre">${items.map(([k, ic, l]) => `<button type="button" data-tab="${k}" class="${tab === k ? "active" : ""}">${icon(ic, 20)} ${l}</button>`).join("")}
    <a href="ressources.html">${icon("folder", 20)} Ressources</a><a href="actualites.html">${icon("news", 20)} Actualités</a><a href="contact.html">${icon("mail", 20)} Écrire à la Direction</a>
    <button type="button" id="m-out">${icon("logout", 20)} Déconnexion</button></nav>`;
}

async function cardHTML() {
  const url = `${siteUrl()}/verifier.html?code=${encodeURIComponent(member.verify_code)}`;
  const qr = await qrData(url);
  return `<div id="print-zone"><div class="member-card" id="mcard">
    <div class="mc-top"><img src="${esc(CONFIG.LOGO)}" alt=""><div><b>${esc(CONFIG.ORG.short)}</b><small>Carte de membre</small></div></div>
    <div class="mc-mid"><div><span class="mc-label">Membre</span><div class="mc-name">${esc(member.first_name)}<br>${esc(member.last_name)}</div></div>
      ${qr ? `<div class="mc-qr"><img src="${qr}" alt="QR code de vérification"></div>` : ""}</div>
    <div class="mc-bottom"><div><span class="mc-label">N° de membre</span><span class="mc-num">${esc(member.member_number)}</span></div>
      <div><span class="mc-label">Depuis</span>${fmtDate(member.joined_at)}</div>
      <div><span class="mc-label">Statut</span>${member.status === "actif" ? "Actif" : "Suspendu"}</div></div></div></div>`;
}

async function downloadPng() {
  const W = 1011, H = 638, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1a3d6b"); g.addColorStop(1, "#0b1f3a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(76,201,240,.1)"; x.lineWidth = 1; for (let i = 0; i < W; i += 50) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 50) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
  [["#0e8f5b", 0], ["#ffb400", W / 3], ["#d6343a", (2 * W) / 3]].forEach(([col, px]) => { x.fillStyle = col; x.fillRect(px, H - 18, W / 3 + 1, 18); });
  x.fillStyle = "#fff"; x.font = "700 56px 'Barlow Condensed', Arial Narrow, sans-serif"; x.fillText(CONFIG.ORG.short, 120, 92);
  x.fillStyle = "#a9bdd4"; x.font = "600 20px Arial, sans-serif"; x.fillText("CARTE DE MEMBRE", 122, 124);
  x.fillStyle = "#ffb400"; x.font = "700 18px Arial, sans-serif"; x.fillText("MEMBRE", 50, 300);
  x.fillStyle = "#fff"; x.font = "700 78px 'Barlow Condensed', Arial Narrow, sans-serif"; x.fillText((member.first_name + "").toUpperCase(), 50, 372); x.fillText((member.last_name + "").toUpperCase(), 50, 450);
  x.fillStyle = "#ffb400"; x.font = "700 18px Arial, sans-serif"; x.fillText("N° DE MEMBRE", 50, 530); x.fillText("DEPUIS", 400, 530);
  x.fillStyle = "#fff"; x.font = "600 30px monospace"; x.fillText(member.member_number, 50, 568); x.font = "600 26px Arial, sans-serif"; x.fillText(fmtDate(member.joined_at), 400, 568);
  const logo = new Image(); logo.src = CONFIG.LOGO;
  await new Promise((r) => { logo.onload = r; logo.onerror = r; });
  x.fillStyle = "#fff"; x.beginPath(); x.roundRect(50, 50, 56, 56, 14); x.fill(); try { x.drawImage(logo, 54, 54, 48, 48); } catch {}
  const qr = $("#mcard .mc-qr img");
  if (qr) { x.fillStyle = "#fff"; x.beginPath(); x.roundRect(W - 290, 250, 240, 240, 18); x.fill(); x.drawImage(qr, W - 280, 260, 220, 220); }
  const a = document.createElement("a"); a.download = `carte-${member.member_number}.png`; a.href = c.toDataURL("image/png"); a.click();
}

const views = {
  async dash(ctx) {
    const [regs, news] = await Promise.all([
      safe(sb.from("event_registrations").select("event_id, events(id,title,starts_at,location,status)").eq("user_id", sess.user.id)),
      safe(sb.from("news").select("id,title,published_at,category").eq("is_published", true).order("published_at", { ascending: false }).limit(3)),
    ]);
    const up = regs.filter((r) => r.events && new Date(r.events.starts_at) >= new Date() && r.events.status === "publie");
    return `<div class="panel"><h2>Bonjour ${esc(member.first_name)} 👋</h2><p class="muted">Bienvenue dans votre espace GCU-BÉNIN.</p>
      <div class="kpis"><div class="kpi"><b>${up.length}</b><span>Événements à venir</span></div><div class="kpi"><b>${ctx.unread}</b><span>Notifications non lues</span></div><div class="kpi"><b>${member.status === "actif" ? "Actif" : "Suspendu"}</b><span>Statut d'adhésion</span></div></div>
      <p class="mt-2"><strong>N° de membre :</strong> <code>${esc(member.member_number)}</code></p></div>
      <div class="panel"><h3>Dernières actualités</h3>${news.length ? `<ul class="list-clean">${news.map((n) => `<li><span><strong>${esc(n.title)}</strong><br><span class="muted">${esc(n.category)} · ${fmtDate(n.published_at)}</span></span><a class="btn btn-outline btn-sm" href="actualites.html?id=${esc(n.id)}">Lire</a></li>`).join("")}</ul>` : `<p class="muted">Aucune actualité pour l'instant.</p>`}</div>
      <div class="panel"><h3>Accès rapide</h3><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-dark" href="ressources.html">Ressources réservées</a><a class="btn btn-outline" href="evenements.html">Agenda</a><a class="btn btn-outline" href="opportunites.html">Opportunités</a></div></div>`;
  },
  async card() {
    return `<div class="panel"><h2>Ma carte de membre numérique</h2><p class="muted">Présentez-la sur écran, imprimez-la ou téléchargez-la. Le QR code permet de vérifier son authenticité.</p>
      ${await cardHTML()}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px"><button class="btn btn-primary" id="c-png" type="button">${icon("download", 18)} Télécharger (PNG)</button><button class="btn btn-outline" id="c-print" type="button">${icon("print", 18)} Imprimer</button></div>
      <p class="hint mt-2">Code de vérification : <code>${esc(member.verify_code)}</code></p></div>`;
  },
  async profile() {
    return `<div class="panel"><h2>Mon profil</h2><form class="form" id="pf" novalidate>
      <div class="form-row"><div class="field"><label>Nom</label><input value="${esc(member.last_name)}" disabled></div><div class="field"><label>Prénom</label><input value="${esc(member.first_name)}" disabled></div></div>
      <div class="field"><label>Adresse e-mail</label><input value="${esc(member.email)}" disabled><span class="hint">Pour modifier votre nom ou votre e-mail, <a href="contact.html">contactez la Direction</a>.</span></div>
      <div class="form-row"><div class="field"><label for="pf-ph">Téléphone</label><input id="pf-ph" value="${esc(member.phone || "")}" maxlength="40"></div>
        <div class="field"><label for="pf-co">Commune</label><input id="pf-co" list="cm" value="${esc(member.commune || "")}" maxlength="100"><datalist id="cm">${COMMUNES.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div></div>
      <div class="form-row"><div class="field"><label for="pf-lv">Niveau d'études / profession</label><select id="pf-lv"><option value="">—</option>${LEVELS.map((l) => `<option ${l === member.level ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="field"><label for="pf-in">Établissement / structure</label><input id="pf-in" value="${esc(member.institution || "")}" maxlength="200"></div></div>
      <div class="field"><label for="pf-it">Domaine d'intérêt</label><input id="pf-it" value="${esc(member.interest || "")}" maxlength="200"></div>
      <div id="pf-out"></div><button class="btn btn-primary" type="submit">Enregistrer</button></form></div>`;
  },
  async events() {
    const regs = await safe(sb.from("event_registrations").select("id, created_at, events(id,title,starts_at,location,status)").eq("user_id", sess.user.id).order("created_at", { ascending: false }));
    const rows = regs.filter((r) => r.events);
    return `<div class="panel"><h2>Mes événements</h2>${rows.length ? `<ul class="list-clean">${rows.map((r) => { const e = r.events, past = new Date(e.starts_at) < new Date(); return `<li><span><strong>${esc(e.title)}</strong><br><span class="muted">${fmtDateTime(e.starts_at)}${e.location ? " · " + esc(e.location) : ""}</span></span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${e.status === "annule" ? '<span class="pill red">Annulé</span>' : past ? '<span class="pill">Terminé</span>' : '<span class="pill green">Inscrit</span>'}<a class="btn btn-outline btn-sm" href="evenements.html?id=${esc(e.id)}">Voir</a></span></li>`; }).join("")}</ul>` : emptyState("Aucune inscription", "Inscrivez-vous aux événements depuis l'agenda.", "calendar")}
      <p class="mt-2"><a class="btn btn-dark" href="evenements.html">Voir l'agenda</a></p></div>`;
  },
  async notifs() {
    const rows = await safe(sb.from("notifications").select("*").eq("user_id", sess.user.id).order("created_at", { ascending: false }).limit(50));
    return `<div class="panel"><h2>Notifications</h2>${rows.length ? `<ul class="list-clean">${rows.map((n) => `<li class="${n.is_read ? "" : "unread"}"><span><strong>${esc(n.title)}</strong><br>${esc(n.body || "")}<br><span class="muted" style="font-size:.82rem">${fmtDateTime(n.created_at)}</span></span>${n.link && /^[a-z0-9\-_]+\.html(\?[\w=\-]*)?$/i.test(n.link) ? `<a class="btn btn-outline btn-sm" href="${esc(n.link)}">Ouvrir</a>` : ""}</li>`).join("")}</ul>` : emptyState("Aucune notification", "Les nouvelles actualités et événements apparaîtront ici.", "bell")}</div>`;
  },
  async settings() {
    return `<div class="panel"><h2>Préférences de notification</h2><form class="form" id="np"><label class="check"><input type="checkbox" id="np-n" ${member.notify_news ? "checked" : ""}> Me notifier des nouvelles actualités</label><label class="check"><input type="checkbox" id="np-e" ${member.notify_events ? "checked" : ""}> Me notifier des nouveaux événements</label><div id="np-out"></div><button class="btn btn-primary" type="submit">Enregistrer</button></form></div>
      <div class="panel"><h2>Changer mon mot de passe</h2><form class="form" id="pw" novalidate><div class="field"><label for="pw-1">Nouveau mot de passe (10 caractères minimum)</label><input id="pw-1" type="password" autocomplete="new-password" minlength="10"></div><div class="field"><label for="pw-2">Confirmer</label><input id="pw-2" type="password" autocomplete="new-password"></div><div id="pw-out"></div><button class="btn btn-dark" type="submit">Modifier le mot de passe</button></form></div>
      <div class="panel"><h2>Session</h2><p class="muted">Connecté en tant que ${esc(sess.user.email)}.</p><button class="btn btn-outline" id="lo2" type="button">${icon("logout", 18)} Se déconnecter</button></div>`;
  },
};

function bind() {
  $("#c-png")?.addEventListener("click", downloadPng);
  $("#c-print")?.addEventListener("click", () => { document.body.classList.add("print-card"); window.print(); setTimeout(() => document.body.classList.remove("print-card"), 500); });
  $("#lo2")?.addEventListener("click", logout);
  const out = (el, t, m) => { el.innerHTML = `<div class="alert alert-${t}">${icon(t === "success" ? "check" : "alert", 20)}<div>${m}</div></div>`; };
  $("#pf")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.rpc("update_my_profile", { p: { phone: $("#pf-ph").value, commune: $("#pf-co").value, level: $("#pf-lv").value, institution: $("#pf-in").value, interest: $("#pf-it").value } });
    if (error) return out($("#pf-out"), "error", esc(friendlyError(error)));
    Object.assign(member, { phone: $("#pf-ph").value, commune: $("#pf-co").value, level: $("#pf-lv").value, institution: $("#pf-in").value, interest: $("#pf-it").value });
    out($("#pf-out"), "success", "Profil mis à jour.");
  });
  $("#np")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.rpc("update_my_profile", { p: { notify_news: $("#np-n").checked, notify_events: $("#np-e").checked } });
    if (error) return out($("#np-out"), "error", esc(friendlyError(error)));
    member.notify_news = $("#np-n").checked; member.notify_events = $("#np-e").checked; out($("#np-out"), "success", "Préférences enregistrées.");
  });
  $("#pw")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const a = $("#pw-1").value;
    if (a.length < 10) return out($("#pw-out"), "error", "Au moins 10 caractères.");
    if (a !== $("#pw-2").value) return out($("#pw-out"), "error", "Les deux mots de passe ne correspondent pas.");
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return out($("#pw-out"), "error", esc(friendlyError(error)));
    e.currentTarget.reset(); out($("#pw-out"), "success", "Mot de passe modifié.");
  });
}

async function draw() {
  const { count } = await sb.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", sess.user.id).eq("is_read", false);
  const unread = count || 0;
  root.innerHTML = `<aside>${nav(unread)}</aside><section id="m-view"><div class="loader"><i></i></div></section>`;
  $("#m-out").onclick = logout;
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; history.replaceState(null, "", "#" + tab); draw(); window.scrollTo({ top: 0 }); }));
  $("#m-view").innerHTML = await views[tab]({ unread });
  if (tab === "notifs" && unread) { await sb.rpc("mark_notifications_read"); $$("[data-tab=notifs]")[0].innerHTML = `${icon("bell", 20)} Notifications`; }
  bind(); hydrateIcons();
}

(async () => {
  sb = await getSB();
  if (!sb) { root.innerHTML = `<div class="alert alert-warn" style="grid-column:1/-1">${icon("alert", 20)}<div>Base de données non connectée. Voir <strong>README.md</strong>, étape 2.</div></div>`; return; }
  sess = await getSession();
  if (!sess) { location.replace("connexion.html?next=membre.html"); return; }
  const claimed = await sb.rpc("claim_membership");
  const { data } = await sb.from("members").select("*").eq("user_id", sess.user.id).maybeSingle();
  member = data;
  if (!member) {
    const confirmed = !!sess.user.email_confirmed_at;
    root.innerHTML = `<div style="grid-column:1/-1;max-width:720px;margin-inline:auto"><div class="panel"><h2>Votre compte est créé</h2>
      <div class="alert alert-info">${icon("info", 20)}<div>${confirmed ? "Aucune adhésion <strong>acceptée</strong> n'est associée à cette adresse e-mail pour l'instant." : "Votre adresse e-mail n'est pas encore confirmée : ouvrez le message de confirmation que nous vous avons envoyé."}</div></div>
      <p class="mt-2">Si vous n'avez pas encore fait de demande, <a href="adhesion.html">faites-la maintenant</a>. Si votre demande est en cours, <a href="adhesion.html#suivi">suivez son statut</a>. Utilisez la même adresse e-mail que celle de la demande.</p>
      <p><button class="btn btn-outline" id="lo3" type="button">Se déconnecter</button></p></div></div>`;
    $("#lo3").onclick = logout; return;
  }
  const h = location.hash.slice(1); if (views[h]) tab = h;
  draw();
})().catch((e) => { root.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(friendlyError(e))}</div>`; });
