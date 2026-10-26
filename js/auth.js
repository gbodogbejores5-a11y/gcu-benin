import { getSB, getSession, esc, icon, friendlyError, params, siteUrl, $ } from "./app.js";

const msg = (el, type, text) => { el.innerHTML = text ? `<div class="alert alert-${type}">${icon(type === "success" ? "check" : type === "error" ? "alert" : "info", 20)}<div>${text}</div></div>` : ""; };
const show = (which) => {
  ["login", "register", "forgot", "reset"].forEach((k) => $("#f-" + k).classList.toggle("hidden", k !== which));
  $("#au-tabs").classList.toggle("hidden", which === "forgot" || which === "reset");
  document.querySelectorAll("#au-tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.t === which));
  $("#au-title").textContent = { login: "Connexion", register: "Créer mon compte", forgot: "Mot de passe oublié", reset: "Nouveau mot de passe" }[which];
  $("#au-sub").textContent = { login: "Accédez à votre espace membre.", register: "Réservé aux personnes ayant une demande d'adhésion acceptée.", forgot: "Nous vous envoyons un lien sécurisé.", reset: "Choisissez un mot de passe solide." }[which];
};
document.querySelectorAll("#au-tabs .tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.t)));
$("#to-forgot").addEventListener("click", (e) => { e.preventDefault(); show("forgot"); });
$("#to-login").addEventListener("click", (e) => { e.preventDefault(); show("login"); });
if (params().get("tab") === "register") show("register");

const safeNext = () => { const n = params().get("next") || "membre.html"; return /^[a-z0-9\-_/]+\.html(\?[\w=&%\-]*)?$/i.test(n) ? n : "membre.html"; };

function score(pw) {
  let s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
$("#r-pw").addEventListener("input", (e) => {
  const s = score(e.target.value), bar = $("#r-str");
  bar.style.width = (s / 5) * 100 + "%"; bar.style.background = s < 3 ? "var(--red)" : s < 4 ? "var(--amber)" : "var(--green)";
});

(async () => {
  const sb = await getSB();
  const warn = !sb;
  if (warn) document.querySelectorAll("form").forEach((f) => f.insertAdjacentHTML("afterbegin", `<div class="alert alert-warn">${icon("alert", 20)}<div>Base de données non connectée : voir <strong>README.md</strong>, étape 2.</div></div>`));
  if (!sb) return;

  sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") show("reset"); });
  const sess = await getSession();
  if (location.hash.includes("type=recovery") || params().get("reset")) show("reset");
  else if (sess) { location.replace(safeNext()); return; }

  $("#f-login").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("#l-msg"); msg(out, "info", "Connexion…");
    const { error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pw").value });
    if (error) return msg(out, "error", esc(friendlyError(error)));
    location.replace(safeNext());
  });

  $("#f-register").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("#r-msg"), pw = $("#r-pw").value;
    if (pw.length < 10) return msg(out, "error", "Le mot de passe doit contenir au moins 10 caractères.");
    if (score(pw) < 3) return msg(out, "error", "Mot de passe trop simple : ajoutez majuscules, chiffres ou symboles.");
    if (pw !== $("#r-pw2").value) return msg(out, "error", "Les deux mots de passe ne correspondent pas.");
    msg(out, "info", "Création du compte…");
    const { data, error } = await sb.auth.signUp({ email: $("#r-email").value.trim(), password: pw, options: { data: { full_name: $("#r-name").value.trim() }, emailRedirectTo: siteUrl() + "/connexion.html" } });
    if (error) return msg(out, "error", esc(friendlyError(error)));
    if (data.session) return location.replace("membre.html");
    e.currentTarget.reset();
    msg(out, "success", "Compte créé ! Ouvrez le <strong>message de confirmation</strong> envoyé à votre adresse e-mail, puis revenez vous connecter. Pensez à vérifier le dossier « courrier indésirable ».");
  });

  $("#f-forgot").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("#fg-msg");
    const { error } = await sb.auth.resetPasswordForEmail($("#fg-email").value.trim(), { redirectTo: siteUrl() + "/connexion.html?reset=1" });
    if (error) return msg(out, "error", esc(friendlyError(error)));
    msg(out, "success", "Si cette adresse correspond à un compte, un lien de réinitialisation vient d'être envoyé.");
  });

  $("#f-reset").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("#n-msg"), pw = $("#n-pw").value;
    if (pw.length < 10) return msg(out, "error", "Au moins 10 caractères.");
    if (pw !== $("#n-pw2").value) return msg(out, "error", "Les deux mots de passe ne correspondent pas.");
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return msg(out, "error", esc(friendlyError(error)));
    msg(out, "success", "Mot de passe modifié. Redirection…"); setTimeout(() => location.replace("membre.html"), 1200);
  });
})();
