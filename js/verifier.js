import { getSB, esc, icon, params, fmtDate, $ } from "./app.js";
async function check(code) {
  const out = $("#v-out"), sb = await getSB();
  if (!sb) { out.innerHTML = `<div class="alert alert-warn">${icon("alert", 20)}<div>Base de données non connectée.</div></div>`; return; }
  const { data } = await sb.rpc("verify_member", { p_code: code });
  const m = data?.[0];
  out.innerHTML = !m ? `<div class="alert alert-error">${icon("alert", 20)}<div><strong>Carte non reconnue.</strong> Ce code ne correspond à aucun membre.</div></div>`
    : m.status === "actif" ? `<div class="alert alert-success">${icon("shieldcheck", 22)}<div><strong>Carte valide.</strong><br>${esc(m.first_name)} ${esc(m.last_name.charAt(0))}. — N° ${esc(m.member_number)}<br>Membre depuis le ${fmtDate(m.joined_at)}.</div></div>`
    : `<div class="alert alert-warn">${icon("alert", 20)}<div><strong>Carte non active.</strong> Ce membre est actuellement suspendu.</div></div>`;
}
$("#v-form").addEventListener("submit", (e) => { e.preventDefault(); check($("#v-code").value); });
const c = params().get("code"); if (c) { $("#v-code").value = c; check(c); }
