import { getSB, isConfigured, esc, icon, friendlyError, hydrateIcons, fmtDate, LEVELS, COMMUNES, REQUEST_STATUS, $ } from "./app.js";
const t0 = Date.now();
const lvl = $("#f-level"); LEVELS.forEach((l) => lvl.insertAdjacentHTML("beforeend", `<option>${esc(l)}</option>`));
$("#communes").innerHTML = COMMUNES.map((c) => `<option value="${esc(c)}">`).join("");

document.querySelectorAll(".tabs .tab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs .tab").forEach((x) => x.classList.toggle("active", x === b));
  $("#pane-form").classList.toggle("hidden", b.dataset.t !== "form");
  $("#pane-track").classList.toggle("hidden", b.dataset.t !== "track");
}));
if (location.hash === "#suivi") document.querySelector('[data-t="track"]').click();

const msg = (el, type, html) => { el.innerHTML = html ? `<div class="alert alert-${type}">${icon(type === "success" ? "check" : type === "error" ? "alert" : "info", 20)}<div>${html}</div></div>` : ""; };

$("#adh-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget, out = $("#adh-msg"), btn = $("#adh-btn");
  const d = Object.fromEntries(new FormData(f));
  if (d.website) return msg(out, "success", "Merci !");            // pot de miel : les robots remplissent ce champ
  if (Date.now() - t0 < 4000) return msg(out, "error", "Veuillez prendre quelques secondes pour relire votre demande, puis réessayez.");
  if (!d.first_name?.trim() || !d.last_name?.trim()) return msg(out, "error", "Le nom et le prénom sont obligatoires.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || "")) return msg(out, "error", "Adresse e-mail invalide.");
  if (!d.rules) return msg(out, "error", "Vous devez accepter les règles de la communauté.");
  if (!d.consent) return msg(out, "error", "Vous devez consentir au traitement de vos données personnelles.");
  const sb = await getSB();
  if (!sb) return msg(out, "error", "La base de données n'est pas encore connectée (voir README.md).");
  btn.disabled = true; btn.textContent = "Envoi en cours…";
  const { data, error } = await sb.rpc("submit_membership_request", { p: { ...d, consent: true } });
  btn.disabled = false; btn.textContent = "Envoyer ma demande";
  if (error) return msg(out, "error", esc(friendlyError(error)));
  f.reset();
  $("#pane-form").innerHTML = `<div class="form-card center"><div class="icon-badge" style="margin:0 auto 16px;background:var(--green);color:#fff">${icon("check", 30)}</div>
    <h2>Demande bien reçue !</h2><p>Votre demande est enregistrée avec le statut <strong>« En attente »</strong>. Conservez votre code de suivi :</p>
    <p style="font-family:ui-monospace,monospace;font-size:1.8rem;font-weight:700;letter-spacing:.1em;background:var(--bg-soft);padding:14px;border-radius:12px;display:inline-block">${esc(data)}</p>
    <p class="muted">Vous pourrez suivre l'avancement avec ce code et votre adresse e-mail.</p>
    <p><a class="btn btn-dark" id="go-track" href="adhesion.html#suivi">Suivre ma demande</a> <a class="btn btn-outline" href="index.html">Retour à l'accueil</a></p></div>`;
  $("#go-track").addEventListener("click", () => setTimeout(() => location.reload(), 50));
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#trk-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("#trk-msg"), sb = await getSB();
  if (!sb) return msg(out, "error", "La base de données n'est pas encore connectée.");
  const { data, error } = await sb.rpc("track_membership_request", { p_code: $("#t-code").value, p_email: $("#t-email").value });
  if (error) return msg(out, "error", esc(friendlyError(error)));
  const r = data?.[0];
  if (!r) return msg(out, "error", "Aucune demande ne correspond à ce code et à cette adresse e-mail.");
  const label = REQUEST_STATUS[r.status] || r.status;
  const next = { en_attente: "Votre demande a bien été reçue et attend son examen.", en_cours: "Votre demande est en cours d'examen par les responsables.", accepte: `Félicitations ${esc(r.first_name)} ! Créez maintenant votre compte avec la même adresse e-mail : <a href="connexion.html">Créer mon compte</a>.`, refuse: "Votre demande n'a pas été retenue." }[r.status] || "";
  msg(out, r.status === "accepte" ? "success" : r.status === "refuse" ? "error" : "info", `<strong>Statut : ${esc(label)}</strong><br>Déposée le ${fmtDate(r.created_at)}.<br>${next}${r.decision_note ? `<br><em>Message des responsables : ${esc(r.decision_note)}</em>` : ""}`);
});
hydrateIcons();
