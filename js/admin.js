/* ==========================================================================
   GCU-BÉNIN — Espace d'administration
   Les boutons masqués ne sont qu'un confort : TOUTES les permissions sont
   vérifiées par la base de données (RLS + fonctions SECURITY DEFINER).
   ========================================================================== */
import { CONFIG, getSB, isConfigured, esc, icon, $, $$, fmtDate, fmtDateTime, toLocalInput, debounce, toast, openModal, friendlyError, safe, emptyState, loader, hydrateIcons, RESOURCE_CATEGORIES, NEWS_CATEGORIES, OPP_TYPES, MESSAGE_CATEGORIES, MESSAGE_STATUS, REQUEST_STATUS, truncate } from "./app.js";

const app = document.getElementById("app");
let sb, user, perms = [], current = "dashboard", counts = { requests: 0, messages: 0 }, idleTimer;

/* ------------------------------------------------------------------ utilitaires */
const can = (p) => perms.includes(p);
const badge = (txt, cls = "") => `<span class="badge ${cls}">${esc(txt)}</span>`;
const yesno = (v) => (v ? badge("Oui", "ok") : badge("Non"));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
const alertBox = (t, m) => `<div class="alert alert-${t}">${icon(t === "success" ? "check" : t === "error" ? "alert" : "info", 20)}<div>${m}</div></div>`;
async function audit() { /* le journal est alimenté automatiquement par des triggers en base */ }

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => { await sb.auth.signOut(); location.reload(); }, (CONFIG.ADMIN_IDLE_MINUTES || 30) * 60000);
}
["click", "keydown", "mousemove", "touchstart"].forEach((ev) => addEventListener(ev, debounce(() => user && resetIdle(), 1000), { passive: true }));

async function upload(file, bucket, folder) {
  const ok = bucket === "media" ? /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/ : /^(application\/(pdf|msword|zip|vnd\..+)|image\/(jpeg|png))$/;
  if (!ok.test(file.type)) throw new Error("Type de fichier non autorisé.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Fichier trop volumineux (50 Mo maximum).");
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${uid()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return bucket === "media" ? sb.storage.from("media").getPublicUrl(path).data.publicUrl : path;
}

/* ------------------------------------------------------------------ formulaire générique */
function fieldHTML(f, v) {
  const id = "ff-" + f.k, val = v ?? "";
  const lab = `<label for="${id}">${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ""}</label>`;
  const help = f.help ? `<span class="hint">${esc(f.help)}</span>` : "";
  let inp = "";
  if (f.type === "textarea") inp = `<textarea id="${id}" name="${f.k}" ${f.req ? "required" : ""} rows="${f.rows || 5}">${esc(val)}</textarea>`;
  else if (f.type === "select") inp = `<select id="${id}" name="${f.k}" ${f.req ? "required" : ""}>${f.req ? "" : '<option value="">—</option>'}${f.opts.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>`;
  else if (f.type === "checkbox") return `<div class="field"><label class="check"><input type="checkbox" id="${id}" name="${f.k}" ${v ? "checked" : ""}> <span>${esc(f.label)}</span></label>${help}</div>`;
  else if (f.type === "datetime") inp = `<input id="${id}" name="${f.k}" type="datetime-local" value="${esc(toLocalInput(v))}" ${f.req ? "required" : ""}>`;
  else if (f.type === "image" || f.type === "file") inp = `${val ? `<div class="hint">Actuel : ${f.type === "image" ? `<a href="${esc(val)}" target="_blank" rel="noopener">${esc(truncate(String(val).split("/").pop(), 40))}</a>` : `<strong>${esc(truncate(String(val).split("/").pop(), 40))}</strong>`} — laissez vide pour le conserver</div>` : ""}<input id="${id}" name="${f.k}" type="file" accept="${f.accept || (f.type === "image" ? "image/jpeg,image/png,image/webp,image/gif" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.png")}">`;
  else inp = `<input id="${id}" name="${f.k}" type="${f.type || "text"}" value="${esc(val)}" ${f.req ? "required" : ""} ${f.max ? `maxlength="${f.max}"` : ""} ${f.type === "number" ? 'min="1"' : ""}>`;
  return `<div class="field" ${f.full === false ? "" : 'style="grid-column:1/-1"'}>${lab}${inp}${help}</div>`;
}

function openForm({ title, fields, values = {}, onSave, saveLabel = "Enregistrer", extra = "" }) {
  const m = openModal({ title, wide: true, body: `<form id="gform" class="form" novalidate>${extra}${fields.map((f) => fieldHTML(f, values[f.k])).join("")}<div id="gmsg" role="alert"></div></form>`,
    footer: `<button class="btn btn-outline" type="button" data-x>Annuler</button><button class="btn btn-primary" type="button" data-ok>${saveLabel}</button>` });
  m.$("[data-x]").onclick = m.close;
  m.$("[data-ok]").onclick = async (ev) => {
    const btn = ev.currentTarget, msg = m.$("#gmsg"); msg.innerHTML = "";
    const out = {};
    try {
      for (const f of fields) {
        const el = m.$("#ff-" + f.k); let v;
        if (f.type === "checkbox") v = el.checked;
        else if (f.type === "image" || f.type === "file") {
          const file = el.files?.[0];
          if (file) { btn.disabled = true; btn.textContent = "Téléversement…"; v = await upload(file, f.type === "image" ? "media" : "resources", f.folder || "divers"); } else continue;
        } else if (f.type === "datetime") v = el.value ? new Date(el.value).toISOString() : null;
        else if (f.type === "number") v = el.value ? Number(el.value) : null;
        else { v = el.value.trim(); if (v === "" && !f.req) v = null; }
        if (f.req && (v === null || v === "")) { el.focus(); throw new Error(`Le champ « ${f.label} » est obligatoire.`); }
        out[f.k] = v;
      }
      btn.disabled = true; btn.textContent = "Enregistrement…";
      await onSave(out, m);
      m.close();
    } catch (e) { msg.innerHTML = alertBox("error", esc(friendlyError(e))); btn.disabled = false; btn.textContent = saveLabel; }
  };
  return m;
}

/* ------------------------------------------------------------------ CRUD générique */
async function crud(box, o) {
  const { table, columns, fields, order = [["created_at", false]], perm, noun = "élément", addLabel = "Ajouter", canAdd = true, defaults = {}, filters = [], beforeSave } = o;
  const w = can(perm);
  box.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="cr-q" type="search" placeholder="Rechercher…" aria-label="Rechercher"></div>
    ${filters.map((f) => `<select data-f="${f.k}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}</option>${f.opts.map((x) => { const [a, b] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(a)}">${esc(b)}</option>`; }).join("")}</select>`).join("")}
    ${w && canAdd ? `<button class="btn btn-primary" id="cr-add" type="button">${icon("plus", 18)} ${addLabel}</button>` : ""}</div><div id="cr-t">${loader()}</div>`;
  let rows = [];
  const draw = () => {
    const q = $("#cr-q").value.toLowerCase().trim();
    const fv = Object.fromEntries($$("[data-f]", box).map((s) => [s.dataset.f, s.value]));
    const list = rows.filter((r) => (!q || JSON.stringify(r).toLowerCase().includes(q)) && Object.entries(fv).every(([k, v]) => !v || String(r[k]) === v));
    $("#cr-t").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr>${columns.map((c) => `<th>${esc(c.l)}</th>`).join("")}${w ? "<th>Actions</th>" : ""}</tr></thead><tbody>${list.map((r) => `<tr>${columns.map((c) => `<td class="${c.wrap ? "wrap" : ""}">${c.f ? c.f(r) : esc(r[c.k] ?? "")}</td>`).join("")}${w ? `<td><div class="actions"><button class="btn btn-outline btn-sm" data-e="${esc(r.id ?? r.key)}" type="button">${icon("edit", 15)} Modifier</button><button class="btn btn-danger btn-sm" data-d="${esc(r.id ?? r.key)}" type="button" aria-label="Supprimer">${icon("trash", 15)}</button></div></td>` : ""}</tr>`).join("")}</tbody></table></div>` : emptyState(`Aucun ${noun}`, w && canAdd ? `Cliquez sur « ${addLabel} » pour commencer.` : "Rien à afficher.", "folder");
    hydrateIcons();
  };
  const load = async () => {
    let req = sb.from(table).select("*").limit(500);
    order.forEach(([c, asc]) => (req = req.order(c, { ascending: asc })));
    const { data, error } = await req;
    if (error) { $("#cr-t").innerHTML = alertBox("error", esc(friendlyError(error))); return; }
    rows = data || []; draw();
  };
  const save = (row) => async (vals) => {
    if (beforeSave) await beforeSave(vals, row);
    const { error } = row ? await sb.from(table).update(vals).eq("id", row.id) : await sb.from(table).insert({ ...defaults, ...vals });
    if (error) throw error;
    toast(row ? "Modifications enregistrées." : "Élément créé.", "success"); load(); refreshCounts();
  };
  $("#cr-q").addEventListener("input", debounce(draw, 200));
  $$("[data-f]", box).forEach((s) => s.addEventListener("change", draw));
  $("#cr-add")?.addEventListener("click", () => openForm({ title: addLabel, fields, values: o.initial || {}, onSave: save(null) }));
  $("#cr-t").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-e]"), de = e.target.closest("[data-d]");
    if (ed) { const r = rows.find((x) => String(x.id ?? x.key) === ed.dataset.e); openForm({ title: "Modifier", fields, values: r, onSave: save(r) }); }
    if (de) {
      const r = rows.find((x) => String(x.id ?? x.key) === de.dataset.d);
      if (!confirm("Supprimer définitivement cet élément ? Cette action est irréversible.")) return;
      const { error } = await sb.from(table).delete().eq("id", r.id);
      if (error) return toast(friendlyError(error), "error");
      toast("Supprimé."); load(); refreshCounts();
    }
  });
  await load();
}

/* ------------------------------------------------------------------ vues */
const V = {};

V.dashboard = async (box) => {
  const c = async (t, f) => { let q = sb.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q); const { count } = await q; return count ?? "–"; };
  const [members, pend, news, ev, res, msgs, opps] = await Promise.all([
    can("members.manage") ? c("members") : "–", can("requests.manage") ? c("membership_requests", (q) => q.in("status", ["en_attente", "en_cours"])) : "–",
    c("news", (q) => q.eq("is_published", true)), c("events", (q) => q.eq("status", "publie").gte("starts_at", new Date().toISOString())),
    c("resources"), can("messages.manage") ? c("contact_messages", (q) => q.in("status", ["nouveau", "en_cours"])) : "–", c("opportunities", (q) => q.eq("is_published", true)),
  ]);
  const card = (ic, n, l, go, p) => `<button class="stat-card" ${go && (!p || can(p)) ? `data-go="${go}"` : ""} type="button" style="text-align:left;cursor:${go ? "pointer" : "default"}"><div class="icon-badge" style="width:48px;height:48px">${icon(ic, 24)}</div><div><b>${n}</b><span>${l}</span></div></button>`;
  box.innerHTML = `<div class="stat-cards">${card("users", members, "Membres inscrits", "members", "members.manage")}${card("user-plus", pend, "Demandes à traiter", "requests", "requests.manage")}${card("news", news, "Actualités publiées", "news", "news.manage")}${card("calendar", ev, "Événements à venir", "events", "events.manage")}${card("folder", res, "Ressources disponibles", "resources", "resources.manage")}${card("inbox", msgs, "Messages non traités", "messages", "messages.manage")}${card("briefcase", opps, "Opportunités publiées", "opportunities", "opportunities.manage")}</div>
    <div class="panel"><h2>Bienvenue</h2><p class="muted">Connecté en tant que <strong>${esc(user.email)}</strong>. Vos permissions : ${perms.length ? perms.map((p) => badge(p, "info")).join(" ") : "aucune"}.</p></div>`;
  $$("[data-go]", box).forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
};

V.requests = async (box) => {
  box.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="q" type="search" placeholder="Rechercher un nom, un e-mail, un code…"></div>
    <select id="st"><option value="">Tous les statuts</option>${Object.entries(REQUEST_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div><div id="t">${loader()}</div>`;
  let rows = [];
  const draw = () => {
    const q = $("#q").value.toLowerCase(), st = $("#st").value;
    const list = rows.filter((r) => (!st || r.status === st) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    $("#t").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Candidat</th><th>Contact</th><th>Profil</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${list.map((r) => `<tr><td>${fmtDate(r.created_at)}<br><span class="hint">${esc(r.code)}</span></td><td><strong>${esc(r.last_name)} ${esc(r.first_name)}</strong></td><td>${esc(r.email)}<br>${esc(r.phone || "")}</td><td>${esc(r.level || "—")}<br><span class="hint">${esc(r.commune || "")}</span></td>
      <td>${badge(REQUEST_STATUS[r.status], r.status === "accepte" ? "ok" : r.status === "refuse" ? "bad" : r.status === "en_cours" ? "info" : "warn")}</td>
      <td><div class="actions"><button class="btn btn-outline btn-sm" data-v="${r.id}" type="button">Examiner</button></div></td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucune demande", "Les demandes d'adhésion apparaîtront ici.", "user-plus");
    hydrateIcons();
  };
  const load = async () => { const { data, error } = await sb.from("membership_requests").select("*").order("created_at", { ascending: false }).limit(500); if (error) { $("#t").innerHTML = alertBox("error", esc(friendlyError(error))); return; } rows = data; draw(); refreshCounts(); };
  $("#q").addEventListener("input", debounce(draw, 200)); $("#st").addEventListener("change", draw);
  $("#t").addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    const r = rows.find((x) => x.id === b.dataset.v);
    const m = openModal({ title: `Demande ${r.code}`, wide: true, body: `<dl class="kv"><dt>Nom</dt><dd>${esc(r.last_name)} ${esc(r.first_name)}</dd><dt>E-mail</dt><dd>${esc(r.email)}</dd><dt>Téléphone</dt><dd>${esc(r.phone || "—")}</dd><dt>Commune</dt><dd>${esc(r.commune || "—")}</dd><dt>Niveau / profession</dt><dd>${esc(r.level || "—")}</dd><dt>Établissement</dt><dd>${esc(r.institution || "—")}</dd><dt>Domaine d'intérêt</dt><dd>${esc(r.interest || "—")}</dd><dt>Motivation</dt><dd>${esc(r.motivation || "—")}</dd><dt>Statut</dt><dd>${badge(REQUEST_STATUS[r.status])}</dd>${r.decision_note ? `<dt>Note</dt><dd>${esc(r.decision_note)}</dd>` : ""}</dl>
      ${r.status === "accepte" ? "" : `<div class="field mt-2"><label for="dn">Message / note pour le candidat (visible dans le suivi)</label><textarea id="dn" maxlength="1000" rows="3"></textarea></div>`}<div id="dm" class="mt-1"></div>`,
      footer: r.status === "accepte" ? `<button class="btn btn-outline" data-x type="button">Fermer</button>` : `<button class="btn btn-outline" data-x type="button">Fermer</button><button class="btn btn-dark" data-s="en_cours" type="button">Mettre en examen</button><button class="btn btn-danger" data-s="refuse" type="button">Refuser</button><button class="btn btn-primary" data-s="accepte" type="button">Accepter</button>` });
    m.$("[data-x]").onclick = m.close;
    $$("[data-s]", m.el).forEach((bt) => bt.addEventListener("click", async () => {
      const d = bt.dataset.s;
      if (d === "refuse" && !confirm("Refuser cette demande ?")) return;
      bt.disabled = true;
      const { data, error } = await sb.rpc("decide_membership_request", { p_id: r.id, p_decision: d, p_note: m.$("#dn")?.value || null });
      if (error) { m.$("#dm").innerHTML = alertBox("error", esc(friendlyError(error))); bt.disabled = false; return; }
      m.close(); toast(d === "accepte" ? `Membre créé : ${data}` : "Décision enregistrée.", "success"); load();
    }));
  });
  await load();
};

V.members = async (box) => {
  const w = can("members.manage");
  box.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="q" type="search" placeholder="Nom, e-mail, n° de membre…"></div>
    <select id="st"><option value="">Tous statuts</option><option value="actif">Actifs</option><option value="suspendu">Suspendus</option></select>${w ? `<button class="btn btn-primary" id="add" type="button">${icon("plus", 18)} Ajouter un membre</button>` : ""}</div><div id="t">${loader()}</div>`;
  let rows = [];
  const draw = () => {
    const q = $("#q").value.toLowerCase(), st = $("#st").value;
    const list = rows.filter((r) => (!st || r.status === st) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    $("#t").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Membre</th><th>Contact</th><th>Profil</th><th>Compte</th><th>Statut</th>${w ? "<th>Actions</th>" : ""}</tr></thead><tbody>${list.map((r) => `<tr><td><code>${esc(r.member_number)}</code></td><td><strong>${esc(r.last_name)} ${esc(r.first_name)}</strong><br><span class="hint">Depuis ${fmtDate(r.joined_at)}</span></td><td>${esc(r.email)}<br>${esc(r.phone || "")}</td><td>${esc(r.level || "—")}<br><span class="hint">${esc(r.commune || "")}</span></td><td>${r.user_id ? badge("Créé", "ok") : badge("Non créé", "warn")}</td><td>${badge(r.status === "actif" ? "Actif" : "Suspendu", r.status === "actif" ? "ok" : "bad")}</td>
      ${w ? `<td><div class="actions"><button class="btn btn-outline btn-sm" data-e="${r.id}" type="button">Modifier</button><button class="btn ${r.status === "actif" ? "btn-danger" : "btn-dark"} btn-sm" data-t="${r.id}" type="button">${r.status === "actif" ? "Suspendre" : "Réactiver"}</button></div></td>` : ""}</tr>`).join("")}</tbody></table></div>` : emptyState("Aucun membre", "Les membres apparaissent ici après acceptation de leur demande.", "users");
  };
  const load = async () => { const { data, error } = await sb.from("members").select("*").order("created_at", { ascending: false }).limit(1000); if (error) { $("#t").innerHTML = alertBox("error", esc(friendlyError(error))); return; } rows = data; draw(); };
  const F = [{ k: "last_name", label: "Nom", req: 1, full: false }, { k: "first_name", label: "Prénom", req: 1, full: false }, { k: "phone", label: "Téléphone", full: false }, { k: "commune", label: "Commune", full: false }, { k: "level", label: "Niveau / profession", full: false }, { k: "institution", label: "Établissement", full: false }, { k: "interest", label: "Domaine d'intérêt" }];
  $("#q").addEventListener("input", debounce(draw, 200)); $("#st").addEventListener("change", draw);
  $("#add")?.addEventListener("click", () => openForm({ title: "Ajouter un membre", fields: [...F.slice(0, 2), { k: "email", label: "E-mail", type: "email", req: 1 }, ...F.slice(2)], onSave: async (v) => { const { data, error } = await sb.rpc("admin_add_member", { p: v }); if (error) throw error; toast(`Membre créé : ${data}`, "success"); load(); } }));
  $("#t").addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-e]"), tg = e.target.closest("[data-t]");
    if (ed) { const r = rows.find((x) => x.id === ed.dataset.e); openForm({ title: "Modifier le membre", fields: F, values: r, onSave: async (v) => { const { error } = await sb.from("members").update(v).eq("id", r.id); if (error) throw error; toast("Membre mis à jour.", "success"); load(); } }); }
    if (tg) { const r = rows.find((x) => x.id === tg.dataset.t), ns = r.status === "actif" ? "suspendu" : "actif"; if (!confirm(`${ns === "suspendu" ? "Suspendre" : "Réactiver"} ${r.first_name} ${r.last_name} ?`)) return; const { error } = await sb.from("members").update({ status: ns }).eq("id", r.id); if (error) return toast(friendlyError(error), "error"); toast("Statut modifié.", "success"); load(); }
  });
  await load();
};

V.news = (box) => crud(box, { table: "news", perm: "news.manage", noun: "actualité", addLabel: "Nouvelle actualité", order: [["created_at", false]], defaults: { created_by: user.id },
  columns: [{ l: "Image", f: (r) => (r.image_url ? `<span class="thumb" style="background-image:url('${esc(r.image_url)}')"></span>` : "—") }, { l: "Titre", f: (r) => `<strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.category)}</span>`, wrap: 1 }, { l: "Publiée", f: (r) => yesno(r.is_published) }, { l: "Date", f: (r) => fmtDate(r.published_at || r.created_at) }],
  fields: [{ k: "title", label: "Titre", req: 1, max: 200 }, { k: "category", label: "Catégorie", type: "select", req: 1, opts: NEWS_CATEGORIES }, { k: "summary", label: "Résumé", type: "textarea", rows: 2, max: 300 }, { k: "content", label: "Contenu détaillé", type: "textarea", rows: 10, req: 1, help: "Mise en forme : ## Titre, ### Sous-titre, - liste, **gras**, *italique*, [lien](https://…)" }, { k: "image_url", label: "Image (facultative)", type: "image", folder: "actualites" }, { k: "is_published", label: "Publier (visible par tous et notifié aux membres)", type: "checkbox" }], initial: { category: NEWS_CATEGORIES[0] } });

V.events = (box) => crud(box, { table: "events", perm: "events.manage", noun: "événement", addLabel: "Nouvel événement", order: [["starts_at", false]], defaults: { created_by: user.id },
  columns: [{ l: "Date", f: (r) => fmtDateTime(r.starts_at) }, { l: "Événement", f: (r) => `<strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.location || "")}</span>`, wrap: 1 }, { l: "Statut", f: (r) => badge({ brouillon: "Brouillon", publie: "Publié", annule: "Annulé" }[r.status], r.status === "publie" ? "ok" : r.status === "annule" ? "bad" : "warn") }, { l: "Inscription", f: (r) => (r.registration_required ? `Oui${r.capacity ? ` (${r.capacity} places)` : ""}` : "Non") }],
  fields: [{ k: "title", label: "Titre", req: 1, max: 200 }, { k: "description", label: "Description", type: "textarea", rows: 6 }, { k: "location", label: "Lieu", full: false }, { k: "starts_at", label: "Début", type: "datetime", req: 1, full: false }, { k: "ends_at", label: "Fin", type: "datetime", full: false }, { k: "conditions", label: "Conditions de participation" }, { k: "registration_required", label: "Inscription obligatoire (réservée aux membres)", type: "checkbox" }, { k: "capacity", label: "Nombre de places (facultatif)", type: "number", full: false }, { k: "status", label: "Statut", type: "select", req: 1, opts: [["brouillon", "Brouillon"], ["publie", "Publié"], ["annule", "Annulé"]], full: false }, { k: "image_url", label: "Image (facultative)", type: "image", folder: "evenements" }], initial: { status: "brouillon" } });

V.resources = (box) => crud(box, { table: "resources", perm: "resources.manage", noun: "ressource", addLabel: "Ajouter une ressource", defaults: { created_by: user.id },
  columns: [{ l: "Titre", f: (r) => `<strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.category)}${r.source ? " · " + esc(r.source) : ""}</span>`, wrap: 1 }, { l: "Accès", f: (r) => badge(r.access === "membres" ? "Membres" : "Public", r.access === "membres" ? "info" : "ok") }, { l: "Fichier", f: (r) => (r.file_path ? badge("Oui", "ok") : r.external_url ? badge("Lien") : badge("—")) }, { l: "Publiée", f: (r) => yesno(r.is_published) }],
  fields: [{ k: "title", label: "Titre", req: 1, max: 200 }, { k: "description", label: "Description", type: "textarea", rows: 3 }, { k: "category", label: "Catégorie", type: "select", req: 1, opts: RESOURCE_CATEGORIES, full: false }, { k: "source", label: "Source / auteur", full: false, help: "Citez toujours l'auteur ou l'origine du document." }, { k: "file_path", label: "Fichier (PDF, Word, Excel, PowerPoint, ZIP — 50 Mo max)", type: "file", folder: "documents" }, { k: "external_url", label: "ou lien externe", type: "url", help: "Utilisé si aucun fichier n'est téléversé." }, { k: "access", label: "Accès", type: "select", req: 1, opts: [["public", "Public"], ["membres", "Réservé aux membres"]], full: false }, { k: "is_published", label: "Publiée", type: "checkbox" }], initial: { access: "public", is_published: true, category: RESOURCE_CATEGORIES[0] } });

V.opportunities = (box) => crud(box, { table: "opportunities", perm: "opportunities.manage", noun: "offre", addLabel: "Nouvelle offre", defaults: { created_by: user.id },
  columns: [{ l: "Type", f: (r) => badge(OPP_TYPES[r.type]?.label || r.type, OPP_TYPES[r.type]?.cls === "green" ? "ok" : "info") }, { l: "Offre", f: (r) => `<strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.organization || "")} · ${esc(r.location || "")}</span>`, wrap: 1 }, { l: "Date limite", f: (r) => (r.deadline ? fmtDate(r.deadline) : "—") }, { l: "Vérifiée", f: (r) => yesno(r.is_verified) }, { l: "Publiée", f: (r) => yesno(r.is_published) }],
  filters: [{ k: "type", label: "Tous types", opts: Object.entries(OPP_TYPES).map(([k, v]) => [k, v.label]) }],
  fields: [{ k: "type", label: "Type", type: "select", req: 1, opts: Object.entries(OPP_TYPES).map(([k, v]) => [k, v.label]), full: false }, { k: "title", label: "Intitulé", req: 1, max: 200, full: false }, { k: "organization", label: "Structure d'accueil / employeur", full: false }, { k: "location", label: "Lieu", full: false }, { k: "skills", label: "Compétences demandées" }, { k: "description", label: "Description", type: "textarea", rows: 6 }, { k: "deadline", label: "Date limite", type: "date", full: false }, { k: "apply_url", label: "Lien de candidature", type: "url", full: false }, { k: "apply_email", label: "E-mail de candidature", type: "email", full: false }, { k: "source_url", label: "Lien vers la source officielle", type: "url", full: false }, { k: "is_verified", label: "Offre vérifiée (source et authenticité confirmées)", type: "checkbox" }, { k: "is_published", label: "Publiée", type: "checkbox" }], initial: { type: "stage", is_published: true } });

V.partners = async (box) => {
  box.innerHTML = `<div class="alert alert-warn" style="margin-bottom:20px">${icon("alert", 20)}<div>N'affichez un organisme comme partenaire officiel (« Publié ») <strong>qu'avec son accord</strong>, et n'utilisez son logo qu'avec autorisation.</div></div><div id="pc"></div><h2 class="mt-4" style="font-size:1.8rem">Demandes de partenariat reçues</h2><div id="pr">${loader()}</div>`;
  await crud($("#pc"), { table: "partners", perm: "partners.manage", noun: "partenaire", addLabel: "Ajouter un partenaire", order: [["position", true]],
    columns: [{ l: "Logo", f: (r) => (r.logo_url ? `<span class="thumb" style="background-image:url('${esc(r.logo_url)}');background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#fff"></span>` : "—") }, { l: "Partenaire", f: (r) => `<strong>${esc(r.name)}</strong><br><span class="hint">${esc(r.nature || "")}</span>` }, { l: "Ordre", k: "position" }, { l: "Publié", f: (r) => yesno(r.is_published) }],
    fields: [{ k: "name", label: "Nom", req: 1 }, { k: "logo_url", label: "Logo (avec autorisation)", type: "image", folder: "partenaires" }, { k: "description", label: "Présentation", type: "textarea", rows: 3 }, { k: "nature", label: "Nature du partenariat", full: false }, { k: "website", label: "Site officiel", type: "url", full: false }, { k: "position", label: "Ordre d'affichage", type: "number", full: false }, { k: "is_published", label: "Publié (accord du partenaire obtenu)", type: "checkbox" }] });
  const { data, error } = await sb.from("partnership_requests").select("*").order("created_at", { ascending: false }).limit(200);
  $("#pr").innerHTML = error ? alertBox("error", esc(friendlyError(error))) : (data?.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Organisation</th><th>Contact</th><th>Message</th><th>Statut</th></tr></thead><tbody>${data.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td><strong>${esc(r.organisation)}</strong></td><td>${esc(r.contact_name)}<br><a href="mailto:${esc(r.email)}">${esc(r.email)}</a><br>${esc(r.phone || "")}</td><td class="wrap">${esc(r.message || "")}</td><td><button class="btn btn-sm ${r.status === "nouveau" ? "btn-primary" : "btn-outline"}" data-pr="${r.id}" data-s="${r.status === "nouveau" ? "traite" : "nouveau"}" type="button">${r.status === "nouveau" ? "Marquer traité" : "Rouvrir"}</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucune demande", "Les propositions de partenariat apparaîtront ici.", "handshake"));
  $("#pr").addEventListener("click", async (e) => { const b = e.target.closest("[data-pr]"); if (!b) return; const { error } = await sb.from("partnership_requests").update({ status: b.dataset.s }).eq("id", b.dataset.pr); if (error) return toast(friendlyError(error), "error"); V.partners(box); });
};

V.gallery = (box) => crud(box, { table: "gallery_items", perm: "gallery.manage", noun: "média", addLabel: "Ajouter un média",
  columns: [{ l: "Aperçu", f: (r) => (r.media_type === "photo" ? `<span class="thumb" style="background-image:url('${esc(r.file_url)}')"></span>` : badge("Vidéo", "info")) }, { l: "Titre", f: (r) => `<strong>${esc(r.title)}</strong><br><span class="hint">${esc(r.category || "")} ${esc(r.event_label || "")}</span>` }, { l: "Date", f: (r) => (r.taken_on ? fmtDate(r.taken_on) : "—") }, { l: "Publié", f: (r) => yesno(r.is_published) }],
  fields: [{ k: "title", label: "Titre", req: 1 }, { k: "file_url", label: "Photo ou vidéo (JPEG, PNG, WebP, MP4, WebM)", type: "image", accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm", folder: "galerie", help: "Obligatoire à la création." }, { k: "media_type", label: "Type", type: "select", req: 1, opts: [["photo", "Photo"], ["video", "Vidéo"]], full: false }, { k: "category", label: "Catégorie", type: "select", opts: ["Rencontres", "Conférences", "Ateliers", "Activités éducatives", "Visites techniques", "Événements officiels"], full: false }, { k: "event_label", label: "Événement associé", full: false }, { k: "taken_on", label: "Date", type: "date", full: false }, { k: "caption", label: "Légende" }, { k: "is_published", label: "Publié (autorisations d'images obtenues)", type: "checkbox" }], initial: { media_type: "photo", is_published: true },
  beforeSave: async (v, row) => { if (!row && !v.file_url) throw new Error("Ajoutez une photo ou une vidéo."); } });

V.faq = (box) => crud(box, { table: "faq", perm: "faq.manage", noun: "question", addLabel: "Nouvelle question", order: [["position", true]],
  columns: [{ l: "N°", k: "position" }, { l: "Question", f: (r) => `<strong>${esc(r.question)}</strong>`, wrap: 1 }, { l: "Publiée", f: (r) => yesno(r.is_published) }],
  fields: [{ k: "question", label: "Question", req: 1 }, { k: "answer", label: "Réponse", type: "textarea", rows: 6, req: 1 }, { k: "position", label: "Ordre", type: "number", full: false }, { k: "is_published", label: "Publiée", type: "checkbox" }], initial: { is_published: true } });

V.org = async (box) => {
  box.innerHTML = `<h2 style="font-size:1.8rem">Structures (organigramme)</h2><div id="ou"></div><h2 class="mt-4" style="font-size:1.8rem">Équipe dirigeante</h2><div class="alert alert-warn" style="margin-bottom:16px">${icon("alert", 20)}<div>Ajoutez uniquement des responsables <strong>officiellement désignés</strong>, avec les informations dont la publication est autorisée.</div></div><div id="ol"></div>`;
  const { data: units } = await sb.from("org_units").select("id,name").order("position");
  await crud($("#ou"), { table: "org_units", perm: "org.manage", noun: "structure", addLabel: "Ajouter une structure", order: [["position", true]],
    columns: [{ l: "Structure", f: (r) => `<strong>${esc(r.name)}</strong>` }, { l: "Rattachée à", f: (r) => esc(units?.find((u) => u.id === r.parent_id)?.name || "—") }, { l: "Ordre", k: "position" }, { l: "Publiée", f: (r) => yesno(r.is_published) }],
    fields: [{ k: "name", label: "Nom", req: 1 }, { k: "description", label: "Rôle / description (affiché au clic)", type: "textarea", rows: 4 }, { k: "parent_id", label: "Rattachée à", type: "select", opts: (units || []).map((u) => [u.id, u.name]), full: false }, { k: "position", label: "Ordre", type: "number", full: false }, { k: "is_published", label: "Publiée", type: "checkbox" }], initial: { is_published: true } });
  await crud($("#ol"), { table: "leaders", perm: "org.manage", noun: "responsable", addLabel: "Ajouter un responsable", order: [["position", true]],
    columns: [{ l: "Photo", f: (r) => (r.photo_url ? `<span class="thumb" style="background-image:url('${esc(r.photo_url)}')"></span>` : "—") }, { l: "Responsable", f: (r) => `<strong>${esc(r.full_name)}</strong><br><span class="hint">${esc(r.role_title)}</span>` }, { l: "Ordre", k: "position" }, { l: "Publié", f: (r) => yesno(r.is_published) }],
    fields: [{ k: "full_name", label: "Nom et prénom", req: 1, full: false }, { k: "role_title", label: "Fonction officielle", req: 1, full: false }, { k: "bio", label: "Courte présentation", type: "textarea", rows: 3 }, { k: "responsibilities", label: "Responsabilités", type: "textarea", rows: 3 }, { k: "photo_url", label: "Photo professionnelle (facultative)", type: "image", folder: "equipe" }, { k: "position", label: "Ordre", type: "number", full: false }, { k: "is_published", label: "Publié", type: "checkbox" }], initial: { is_published: true } });
};

V.messages = async (box) => {
  box.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="q" type="search" placeholder="Rechercher (nom, e-mail, objet, message)…"></div>
    <select id="st"><option value="">Tous statuts</option>${Object.entries(MESSAGE_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <select id="ct"><option value="">Toutes catégories</option>${Object.entries(MESSAGE_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    <select id="as"><option value="">Tous les responsables</option><option value="me">Qui me sont attribués</option><option value="none">Non attribués</option></select></div><div id="t">${loader()}</div>`;
  let rows = [], staff = [];
  const { data: sf } = await sb.rpc("list_staff"); staff = sf || [];
  const who = (id) => staff.find((s) => s.user_id === id)?.email || "—";
  const cls = { nouveau: "bad", en_cours: "info", en_attente: "warn", traite: "ok" };
  const draw = () => {
    const q = $("#q").value.toLowerCase(), st = $("#st").value, ct = $("#ct").value, as = $("#as").value;
    const list = rows.filter((r) => (!st || r.status === st) && (!ct || r.category === ct) && (!as || (as === "me" ? r.assigned_to === user.id : !r.assigned_to)) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    $("#t").innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Reçu</th><th>De</th><th>Objet</th><th>Catégorie</th><th>Attribué à</th><th>Statut</th><th></th></tr></thead><tbody>${list.map((r) => `<tr><td>${fmtDateTime(r.created_at)}</td><td><strong>${esc(r.name)}</strong><br><span class="hint">${esc(r.email)}</span></td><td class="wrap">${esc(r.subject)}<br><span class="hint">${esc(truncate(r.body, 80))}</span></td><td>${esc(MESSAGE_CATEGORIES[r.category] || r.category)}</td><td>${esc(who(r.assigned_to))}</td><td>${badge(MESSAGE_STATUS[r.status], cls[r.status])}</td><td><button class="btn btn-outline btn-sm" data-o="${r.id}" type="button">Ouvrir</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucun message", "La boîte de réception est vide.", "inbox");
    hydrateIcons();
  };
  const load = async () => { const { data, error } = await sb.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500); if (error) { $("#t").innerHTML = alertBox("error", esc(friendlyError(error))); return; } rows = data; draw(); refreshCounts(); };
  ["q"].forEach((i) => $("#" + i).addEventListener("input", debounce(draw, 200))); ["st", "ct", "as"].forEach((i) => $("#" + i).addEventListener("change", draw));
  box._reload = load;
  $("#t").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-o]"); if (!b) return;
    const r = rows.find((x) => x.id === b.dataset.o);
    const { data: notes } = await sb.from("message_notes").select("*").eq("message_id", r.id).order("created_at");
    const hist = (nn) => (nn?.length ? nn.map((n) => `<li><span><strong>${n.kind === "reponse" ? "Réponse envoyée" : "Note interne"}</strong> · ${esc(n.author_email || "")} · <span class="muted">${fmtDateTime(n.created_at)}</span><br>${esc(n.body)}</span></li>`).join("") : '<li><span class="muted">Aucune note pour le moment.</span></li>');
    const m = openModal({ title: r.subject, wide: true, body: `<dl class="kv"><dt>De</dt><dd>${esc(r.name)} — <a href="mailto:${esc(r.email)}?subject=${encodeURIComponent("Re: " + r.subject)}">${esc(r.email)}</a></dd><dt>Reçu le</dt><dd>${fmtDateTime(r.created_at)}</dd><dt>Catégorie</dt><dd>${esc(MESSAGE_CATEGORIES[r.category] || r.category)}</dd></dl>
      <div class="panel mt-2" style="background:var(--bg-soft);white-space:pre-wrap">${esc(r.body)}</div>
      <div class="form-row mt-2"><div class="field"><label for="ms">Statut</label><select id="ms">${Object.entries(MESSAGE_STATUS).map(([k, v]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="field"><label for="ma">Attribué à</label><select id="ma"><option value="">— Personne —</option>${staff.map((s) => `<option value="${s.user_id}" ${s.user_id === r.assigned_to ? "selected" : ""}>${esc(s.email)}</option>`).join("")}</select></div></div>
      <h4 class="mt-2">Historique</h4><ul class="list-clean" id="mh">${hist(notes)}</ul>
      <div class="field mt-2"><label for="mn">Ajouter une note interne ou consigner votre réponse</label><textarea id="mn" rows="3" maxlength="3000"></textarea></div><div id="mm" class="mt-1"></div>`,
      footer: `<button class="btn btn-outline" data-x type="button">Fermer</button><a class="btn btn-outline" href="mailto:${esc(r.email)}?subject=${encodeURIComponent("Re: " + r.subject)}">${icon("mail", 16)} Répondre par e-mail</a><button class="btn btn-dark" data-n="note" type="button">Ajouter la note</button><button class="btn btn-primary" data-n="reponse" type="button">Consigner la réponse</button><button class="btn btn-primary" data-sv type="button">Enregistrer statut / attribution</button>` });
    m.$("[data-x]").onclick = m.close;
    m.$("[data-sv]").onclick = async () => { const { error } = await sb.from("contact_messages").update({ status: m.$("#ms").value, assigned_to: m.$("#ma").value || null }).eq("id", r.id); if (error) return (m.$("#mm").innerHTML = alertBox("error", esc(friendlyError(error)))); toast("Message mis à jour.", "success"); m.close(); load(); };
    $$("[data-n]", m.el).forEach((bt) => bt.addEventListener("click", async () => {
      const body = m.$("#mn").value.trim(); if (!body) return (m.$("#mm").innerHTML = alertBox("error", "Écrivez d'abord le texte."));
      const { error } = await sb.from("message_notes").insert({ message_id: r.id, author_id: user.id, author_email: user.email, kind: bt.dataset.n, body });
      if (error) return (m.$("#mm").innerHTML = alertBox("error", esc(friendlyError(error))));
      if (bt.dataset.n === "reponse" && m.$("#ms").value !== "traite") { m.$("#ms").value = "traite"; await sb.from("contact_messages").update({ status: "traite" }).eq("id", r.id); }
      const { data: nn } = await sb.from("message_notes").select("*").eq("message_id", r.id).order("created_at"); m.$("#mh").innerHTML = hist(nn); m.$("#mn").value = ""; toast("Enregistré.", "success"); load();
    }));
  });
  await load();
};

V.roles = async (box) => {
  box.innerHTML = loader();
  const [{ data: staff, error: e1 }, { data: roles }, { data: allPerms }, { data: rp }] = await Promise.all([sb.rpc("list_staff"), sb.from("roles").select("*").order("created_at"), sb.from("permissions").select("*").order("key"), sb.from("role_permissions").select("*")]);
  if (e1) { box.innerHTML = alertBox("error", esc(friendlyError(e1))); return; }
  const rl = (k) => roles.find((r) => r.key === k)?.label || k;
  box.innerHTML = `<div class="panel"><h2>Personnel et accès</h2><p class="muted">Pour donner un accès, la personne doit d'abord <strong>créer un compte</strong> sur la page Connexion avec son e-mail.</p>
    <form class="form-row" id="af" style="align-items:end;margin:14px 0"><div class="field"><label for="ae">E-mail du compte</label><input id="ae" type="email" required></div><div class="field"><label for="ar">Rôle</label><select id="ar">${roles.map((r) => `<option value="${r.key}">${esc(r.label)}</option>`).join("")}</select></div><div><button class="btn btn-primary" type="submit">${icon("plus", 18)} Attribuer</button></div></form><div id="am"></div>
    ${staff?.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Compte</th><th>Rôles</th></tr></thead><tbody>${staff.map((s) => `<tr><td><strong>${esc(s.email)}</strong></td><td>${s.roles.map((k) => `<span class="badge info" style="margin-right:6px">${esc(rl(k))} <button type="button" data-rm="${s.user_id}|${k}" style="border:0;background:none;cursor:pointer;color:var(--red);font-weight:700" aria-label="Retirer ${esc(rl(k))}">×</button></span>`).join("")}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucun personnel", "", "users")}</div>
    <div class="panel"><h2>Rôles et permissions</h2><p class="muted">Chaque responsable ne reçoit que les permissions nécessaires à sa mission. « Administrateur principal » a toujours tous les droits.</p>
      ${can("roles.manage") ? `<button class="btn btn-outline" id="nr" type="button">${icon("plus", 18)} Créer un rôle</button>` : ""}
      <div id="rl" class="mt-2">${roles.filter((r) => r.key !== "admin_principal").map((r) => `<details class="panel" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">${esc(r.label)} <span class="hint">(${esc(r.key)})</span></summary><p class="muted">${esc(r.description || "")}</p>
        <div class="perm-grid" data-role="${r.key}">${allPerms.map((p) => `<label><input type="checkbox" value="${p.key}" ${rp.some((x) => x.role_key === r.key && x.permission === p.key) ? "checked" : ""} ${can("roles.manage") ? "" : "disabled"}> ${esc(p.label)}</label>`).join("")}</div>
        ${can("roles.manage") ? `<div class="mt-2" style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" data-sp="${r.key}" type="button">Enregistrer</button>${r.is_system ? "" : `<button class="btn btn-danger btn-sm" data-dr="${r.key}" type="button">Supprimer le rôle</button>`}</div>` : ""}</details>`).join("")}</div></div>`;
  $("#af").addEventListener("submit", async (e) => { e.preventDefault(); const { error } = await sb.rpc("assign_role", { p_email: $("#ae").value, p_role: $("#ar").value }); if (error) return ($("#am").innerHTML = alertBox("error", esc(friendlyError(error)))); toast("Rôle attribué.", "success"); V.roles(box); });
  box.addEventListener("click", async (e) => {
    const rm = e.target.closest("[data-rm]"), sp = e.target.closest("[data-sp]"), dr = e.target.closest("[data-dr]");
    if (rm) { const [u, k] = rm.dataset.rm.split("|"); if (!confirm("Retirer ce rôle ?")) return; const { error } = await sb.rpc("remove_role", { p_user: u, p_role: k }); if (error) return toast(friendlyError(error), "error"); toast("Rôle retiré."); V.roles(box); }
    if (sp) { const k = sp.dataset.sp, want = $$(`[data-role="${k}"] input:checked`).map((i) => i.value); await sb.from("role_permissions").delete().eq("role_key", k); if (want.length) { const { error } = await sb.from("role_permissions").insert(want.map((p) => ({ role_key: k, permission: p }))); if (error) return toast(friendlyError(error), "error"); } toast("Permissions enregistrées.", "success"); }
    if (dr) { if (!confirm("Supprimer ce rôle ? Il sera retiré à tous ses titulaires.")) return; const { error } = await sb.from("roles").delete().eq("key", dr.dataset.dr); if (error) return toast(friendlyError(error), "error"); V.roles(box); }
  });
  $("#nr")?.addEventListener("click", () => openForm({ title: "Créer un rôle", fields: [{ k: "label", label: "Nom du rôle", req: 1 }, { k: "description", label: "Description", type: "textarea", rows: 2 }], onSave: async (v) => { const key = "role_" + v.label.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30); const { error } = await sb.from("roles").insert({ key, label: v.label, description: v.description }); if (error) throw error; V.roles(box); } }));
};

V.logs = async (box) => {
  box.innerHTML = `<div class="toolbar"><div class="grow">${icon("search", 18)}<input id="q" type="search" placeholder="Filtrer (acteur, action, élément)…"></div><select id="en"><option value="">Tous éléments</option></select></div><div id="t">${loader()}</div>`;
  const { data, error } = await sb.from("audit_logs").select("*").order("id", { ascending: false }).limit(500);
  if (error) { $("#t").innerHTML = alertBox("error", esc(friendlyError(error))); return; }
  [...new Set(data.map((d) => d.entity))].sort().forEach((x) => $("#en").insertAdjacentHTML("beforeend", `<option>${esc(x)}</option>`));
  const draw = () => { const q = $("#q").value.toLowerCase(), en = $("#en").value; const l = data.filter((d) => (!en || d.entity === en) && (!q || JSON.stringify(d).toLowerCase().includes(q))); $("#t").innerHTML = l.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Élément</th><th>Détail</th></tr></thead><tbody>${l.map((d) => `<tr><td>${fmtDateTime(d.created_at)}</td><td>${esc(d.actor_email || "système")}</td><td>${badge({ INSERT: "Création", UPDATE: "Modification", DELETE: "Suppression" }[d.action] || d.action, d.action === "DELETE" ? "bad" : d.action === "INSERT" ? "ok" : "info")}</td><td>${esc(d.entity)}</td><td class="wrap">${esc(d.details?.label || "")} ${d.details?.status ? `<span class="hint">(${esc(d.details.status)})</span>` : ""}</td></tr>`).join("")}</tbody></table></div>` : emptyState("Aucune entrée", "", "log"); };
  $("#q").addEventListener("input", debounce(draw, 200)); $("#en").addEventListener("change", draw); draw(); hydrateIcons();
};

V.settings = async (box) => {
  const { data } = await sb.from("site_settings").select("*");
  const S = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  const F = [["contact_email", "E-mail officiel", "email"], ["contact_phone", "Téléphone", "tel"], ["contact_address", "Adresse physique (quand elle sera officielle)", "text"], ["social_facebook", "Facebook (URL du compte officiel)", "url"], ["social_whatsapp", "WhatsApp (lien de la chaîne ou du groupe officiel)", "url"], ["social_instagram", "Instagram", "url"], ["social_linkedin", "LinkedIn", "url"], ["social_youtube", "YouTube", "url"]];
  box.innerHTML = `<div class="panel"><h2>Coordonnées et réseaux sociaux</h2><div class="alert alert-info" style="margin-bottom:16px">${icon("info", 20)}<div>Ces informations sont <strong>publiques</strong> (pied de page, page Contact). Laissez vide tout compte qui n'existe pas encore ou n'est pas contrôlé par GCU-BÉNIN. N'y mettez jamais de mot de passe ni de coordonnées bancaires non vérifiées.</div></div>
    <form class="form" id="sf">${F.map(([k, l, t]) => `<div class="field"><label for="s-${k}">${esc(l)}</label><input id="s-${k}" type="${t}" value="${esc(S[k] || "")}" ${can("settings.manage") ? "" : "disabled"}></div>`).join("")}<div id="sm"></div>${can("settings.manage") ? `<button class="btn btn-primary" type="submit">Enregistrer</button>` : ""}</form></div>`;
  $("#sf").addEventListener("submit", async (e) => { e.preventDefault(); const rows = F.map(([k]) => ({ key: k, value: $("#s-" + k).value.trim() })); const bad = rows.find((r) => r.key.startsWith("social_") && r.value && !/^https?:\/\//i.test(r.value)); if (bad) return ($("#sm").innerHTML = alertBox("error", "Les liens des réseaux doivent commencer par https://")); const { error } = await sb.from("site_settings").upsert(rows); if (error) return ($("#sm").innerHTML = alertBox("error", esc(friendlyError(error)))); toast("Paramètres enregistrés.", "success"); });
};

V.security = async (box) => {
  const { data: f } = await sb.auth.mfa.listFactors();
  const totp = (f?.totp || []).filter((x) => x.status === "verified");
  box.innerHTML = `<div class="panel"><h2>Authentification à deux facteurs (recommandée)</h2><p class="muted">Ajoute un code à 6 chiffres (Google Authenticator, Microsoft Authenticator, Authy…) en plus du mot de passe. <strong>Fortement conseillée pour tous les comptes sensibles.</strong></p>
    ${totp.length ? `<div class="alert alert-success">${icon("shieldcheck", 20)}<div>Double authentification <strong>activée</strong>.</div></div><button class="btn btn-danger mt-2" id="mf-off" type="button">Désactiver</button>` : `<div id="mf-box"><button class="btn btn-primary" id="mf-on" type="button">Activer la double authentification</button></div>`}</div>
    <div class="panel"><h2>Changer mon mot de passe</h2><form class="form" id="pw" novalidate><div class="field"><label for="p1">Nouveau mot de passe (12 caractères minimum)</label><input id="p1" type="password" autocomplete="new-password" minlength="12"></div><div class="field"><label for="p2">Confirmer</label><input id="p2" type="password" autocomplete="new-password"></div><div id="pm"></div><button class="btn btn-dark" type="submit">Modifier</button></form></div>
    <div class="panel"><h2>Bonnes pratiques</h2><ul><li>Mot de passe unique, long, jamais partagé.</li><li>Une personne = un compte ; ne partagez jamais un accès.</li><li>Déconnexion automatique après ${CONFIG.ADMIN_IDLE_MINUTES} minutes d'inactivité.</li><li>Consultez régulièrement le journal des actions.</li></ul></div>`;
  $("#mf-on")?.addEventListener("click", async () => {
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "GCU-BENIN " + Date.now() });
    if (error) return toast(friendlyError(error), "error");
    $("#mf-box").innerHTML = `<p>1. Scannez ce QR code avec votre application d'authentification :</p><div style="background:#fff;display:inline-block;padding:10px;border-radius:12px;border:1px solid var(--line)"><img src="${data.totp.qr_code}" alt="QR code" width="200" height="200"></div><p class="hint">Ou saisissez la clé : <code>${esc(data.totp.secret)}</code></p><p>2. Saisissez le code à 6 chiffres :</p><div style="display:flex;gap:10px;flex-wrap:wrap"><input id="mf-c" inputmode="numeric" maxlength="6" style="max-width:160px" autocomplete="one-time-code"><button class="btn btn-primary" id="mf-v" type="button">Valider</button></div><div id="mf-m" class="mt-1"></div>`;
    $("#mf-v").onclick = async () => { const ch = await sb.auth.mfa.challenge({ factorId: data.id }); if (ch.error) return ($("#mf-m").innerHTML = alertBox("error", esc(friendlyError(ch.error)))); const v = await sb.auth.mfa.verify({ factorId: data.id, challengeId: ch.data.id, code: $("#mf-c").value.trim() }); if (v.error) return ($("#mf-m").innerHTML = alertBox("error", "Code incorrect.")); toast("Double authentification activée.", "success"); V.security(box); };
  });
  $("#mf-off")?.addEventListener("click", async () => { if (!confirm("Désactiver la double authentification ?")) return; const { error } = await sb.auth.mfa.unenroll({ factorId: totp[0].id }); if (error) return toast(friendlyError(error) + " (une vérification récente par code peut être nécessaire : reconnectez-vous)", "error"); toast("Désactivée."); V.security(box); });
  $("#pw").addEventListener("submit", async (e) => { e.preventDefault(); const a = $("#p1").value; if (a.length < 12) return ($("#pm").innerHTML = alertBox("error", "Au moins 12 caractères.")); if (a !== $("#p2").value) return ($("#pm").innerHTML = alertBox("error", "Les mots de passe ne correspondent pas.")); const { error } = await sb.auth.updateUser({ password: a }); if (error) return ($("#pm").innerHTML = alertBox("error", esc(friendlyError(error)))); e.currentTarget.reset(); $("#pm").innerHTML = alertBox("success", "Mot de passe modifié."); });
};

/* ------------------------------------------------------------------ navigation */
const NAVS = [
  ["dashboard", "dashboard", "Tableau de bord", null, "Pilotage"],
  ["requests", "user-plus", "Demandes d'adhésion", "requests.manage", "Communauté"], ["members", "users", "Membres", "members.manage"], ["messages", "inbox", "Messagerie", "messages.manage"],
  ["news", "news", "Actualités", "news.manage", "Contenus"], ["events", "calendar", "Événements", "events.manage"], ["resources", "folder", "Ressources", "resources.manage"], ["opportunities", "briefcase", "Opportunités", "opportunities.manage"], ["gallery", "image", "Galerie", "gallery.manage"], ["partners", "handshake", "Partenaires", "partners.manage"], ["faq", "help", "FAQ", "faq.manage"],
  ["org", "sitemap", "Organisation", "org.manage", "Site"], ["settings", "settings", "Paramètres du site", "settings.manage"],
  ["roles", "key", "Rôles et accès", "roles.manage", "Sécurité"], ["logs", "log", "Journal des actions", "logs.view"], ["security", "lock", "Sécurité du compte", null],
];
const TITLES = Object.fromEntries(NAVS.map((n) => [n[0], n[2]]));

async function refreshCounts() {
  const c = async (t, st) => { const { count } = await sb.from(t).select("id", { count: "exact", head: true }).in("status", st); return count || 0; };
  counts.requests = can("requests.manage") ? await c("membership_requests", ["en_attente"]) : 0;
  counts.messages = can("messages.manage") ? await c("contact_messages", ["nouveau"]) : 0;
  [["requests", counts.requests], ["messages", counts.messages]].forEach(([k, n]) => { const b = $(`[data-nav="${k}"] .badge-n`); if (b) { b.textContent = n; b.style.display = n ? "" : "none"; } });
}

function shell() {
  let grp = "";
  const items = NAVS.filter(([, , , p]) => !p || can(p)).map(([k, ic, l, , g]) => { let h = ""; if (g && g !== grp) { grp = g; h = `<div class="grp">${g}</div>`; } return h + `<button type="button" data-nav="${k}" class="${k === current ? "active" : ""}">${icon(ic, 20)} <span>${l}</span>${["requests", "messages"].includes(k) ? '<span class="badge-n" style="display:none">0</span>' : ""}</button>`; }).join("");
  app.innerHTML = `<div class="admin-shell"><aside class="admin-side" id="side"><a class="brand" href="../index.html"><img src="${esc("../" + CONFIG.LOGO)}" alt="" width="40" height="40"><span class="brand-text"><strong>${esc(CONFIG.ORG.short)}</strong><small>Administration</small></span></a>${items}<div style="flex:1"></div><button type="button" id="lo">${icon("logout", 20)} Déconnexion</button></aside>
    <div class="admin-main"><div class="admin-top"><div style="display:flex;gap:12px;align-items:center"><button class="btn btn-outline btn-sm admin-burger" id="bg" type="button" aria-label="Menu">${icon("menu", 20)}</button><h1 id="ttl"></h1></div><div class="admin-user"><span>${esc(user.email)}</span><a class="btn btn-outline btn-sm" href="../index.html" target="_blank" rel="noopener">${icon("external", 15)} Voir le site</a></div></div><div id="view"></div></div></div>`;
  $("#side").addEventListener("click", (e) => { const b = e.target.closest("[data-nav]"); if (b) { go(b.dataset.nav); $("#side").classList.remove("open"); } });
  $("#bg").onclick = () => $("#side").classList.toggle("open");
  $("#lo").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  hydrateIcons();
}
async function go(k) {
  current = V[k] ? k : "dashboard"; history.replaceState(null, "", "#" + current);
  $$("[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === current));
  $("#ttl").textContent = TITLES[current]; const box = $("#view"); box.innerHTML = loader();
  const need = NAVS.find((n) => n[0] === current)?.[3];
  if (need && !can(need)) { box.innerHTML = alertBox("error", "Vous n'avez pas la permission d'accéder à cette section."); return; }
  try { await V[current](box); } catch (e) { box.innerHTML = alertBox("error", esc(friendlyError(e))); }
  hydrateIcons(); window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ authentification */
function loginScreen(msg = "") {
  app.innerHTML = `<div class="auth-wrap" style="min-height:100vh"><div class="auth-box"><div class="form-card"><div class="center"><img src="../assets/images/logo.svg" alt="" width="64" height="64" style="margin:0 auto 10px"><h1 style="font-size:2rem">Administration</h1><p class="muted">Accès réservé au personnel autorisé de GCU-BÉNIN.</p></div>
    <form class="form mt-2" id="lf" novalidate><div class="field"><label for="em">Adresse e-mail</label><input id="em" type="email" required autocomplete="username"></div><div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" required autocomplete="current-password"></div><div id="lm">${msg}</div><button class="btn btn-primary" type="submit">Se connecter</button></form></div><p class="center hint mt-2"><a href="../index.html">← Retour au site</a></p></div></div>`;
  $("#lf").addEventListener("submit", async (e) => { e.preventDefault(); $("#lm").innerHTML = ""; const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value }); if (error) return ($("#lm").innerHTML = alertBox("error", esc(friendlyError(error)))); start(); });
}
function mfaScreen(factorId) {
  app.innerHTML = `<div class="auth-wrap" style="min-height:100vh"><div class="auth-box"><div class="form-card center"><div class="icon-badge" style="margin:0 auto 14px">${icon("shieldcheck", 28)}</div><h1 style="font-size:2rem">Vérification en deux étapes</h1><p class="muted">Saisissez le code à 6 chiffres de votre application d'authentification.</p>
    <form class="form mt-2" id="mf"><input id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="text-align:center;font-size:1.6rem;letter-spacing:.4em" required><div id="mm"></div><button class="btn btn-primary" type="submit">Valider</button><button class="btn btn-outline" id="out" type="button">Annuler</button></form></div></div></div>`;
  $("#code").focus();
  $("#out").onclick = async () => { await sb.auth.signOut(); location.reload(); };
  $("#mf").addEventListener("submit", async (e) => { e.preventDefault(); const ch = await sb.auth.mfa.challenge({ factorId }); if (ch.error) return ($("#mm").innerHTML = alertBox("error", esc(friendlyError(ch.error)))); const v = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: $("#code").value.trim() }); if (v.error) return ($("#mm").innerHTML = alertBox("error", "Code incorrect.")); start(); });
}

async function start() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginScreen();
  user = session.user;
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") { const { data: f } = await sb.auth.mfa.listFactors(); const t = f?.totp?.find((x) => x.status === "verified"); if (t) return mfaScreen(t.id); }
  const { data: p, error } = await sb.rpc("my_permissions");
  perms = error ? [] : p || [];
  if (!perms.length) {
    app.innerHTML = `<div class="auth-wrap" style="min-height:100vh"><div class="auth-box"><div class="form-card center"><div class="icon-badge" style="margin:0 auto 14px;background:var(--red);color:#fff">${icon("lock", 28)}</div><h1 style="font-size:2rem">Accès refusé</h1><p class="muted">Le compte <strong>${esc(user.email)}</strong> n'a aucun rôle d'administration.${error ? "" : " Si une double authentification est exigée, activez-la puis reconnectez-vous."}</p><button class="btn btn-dark" id="out" type="button">Se déconnecter</button></div></div></div>`;
    $("#out").onclick = async () => { await sb.auth.signOut(); location.reload(); }; return;
  }
  resetIdle(); shell();
  const h = location.hash.slice(1); await go(V[h] ? h : "dashboard"); refreshCounts();
  sb.channel("admin-rt")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, (pl) => { if (can("messages.manage")) { toast(`📩 Nouveau message : ${pl.new.subject}`, "success"); refreshCounts(); if (current === "messages") $("#view")._reload?.(); } })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "membership_requests" }, () => { if (can("requests.manage")) { toast("🧑 Nouvelle demande d'adhésion", "success"); refreshCounts(); } })
    .subscribe();
}

(async () => {
  if (!isConfigured) { app.innerHTML = `<div class="auth-wrap" style="min-height:100vh"><div class="auth-box"><div class="form-card">${alertBox("warn", "Base de données non connectée. Renseignez <code>js/config.js</code> (voir README.md, étape 2).")}</div></div></div>`; return; }
  sb = await getSB();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && user) location.reload(); });
  start();
})();
