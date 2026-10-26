import { getSB, getSession, esc, icon, loadSettings, socialLinks, friendlyError, MESSAGE_CATEGORIES, hydrateIcons, $ } from "./app.js";
$("#c-cat").innerHTML = Object.entries(MESSAGE_CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
const t0 = Date.now();
loadSettings().then((s) => {
  const li = [];
  if (s.contact_email) li.push(`<li>${icon("mail", 20)} <a href="mailto:${esc(s.contact_email)}">${esc(s.contact_email)}</a></li>`);
  if (s.contact_phone) li.push(`<li>${icon("phone", 20)} <a href="tel:${esc(s.contact_phone.replace(/\s/g, ""))}">${esc(s.contact_phone)}</a></li>`);
  if (s.contact_address) li.push(`<li>${icon("pin", 20)} ${esc(s.contact_address)}</li>`);
  $("#c-info").innerHTML = li.join("") || `<li><span class="muted">Les coordonnées officielles seront publiées prochainement. Utilisez le formulaire.</span></li>`;
  $("#c-socials").innerHTML = socialLinks(s);
});
getSession().then((sess) => { if (sess) $("#c-email").value = sess.user.email || ""; }).catch(() => {});
$("#c-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("#c-out"), btn = $("#c-btn");
  const show = (t, m) => (out.innerHTML = `<div class="alert alert-${t}">${icon(t === "success" ? "check" : "alert", 20)}<div>${m}</div></div>`);
  if ($("#c-hp").value) return show("success", "Merci !");
  if (Date.now() - t0 < 3000) return show("error", "Prenez quelques secondes pour relire votre message.");
  if (!$("#c-consent").checked) return show("error", "Merci d'accepter le traitement de vos données pour traiter votre demande.");
  const sb = await getSB();
  if (!sb) return show("error", "La base de données n'est pas encore connectée (voir README.md).");
  btn.disabled = true;
  const { error } = await sb.rpc("submit_contact_message", { p: { name: $("#c-name").value, email: $("#c-email").value, subject: $("#c-subject").value, category: $("#c-cat").value, body: $("#c-body").value } });
  btn.disabled = false;
  if (error) return show("error", esc(friendlyError(error)));
  e.currentTarget.reset(); show("success", "<strong>Message envoyé.</strong> Il a été enregistré et transmis aux responsables autorisés. Nous vous répondrons dans les meilleurs délais.");
});
hydrateIcons();
