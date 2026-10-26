/* ==========================================================================
   GCU-BÉNIN — noyau commun : client Supabase, utilitaires, en-tête / pied de page
   ========================================================================== */
import { CONFIG } from "./config.js";
export { CONFIG };

/* ---------- Supabase ---------- */
export const isConfigured =
  !!CONFIG.SUPABASE_URL && !!CONFIG.SUPABASE_ANON_KEY &&
  !CONFIG.SUPABASE_URL.includes("VOTRE") && !CONFIG.SUPABASE_ANON_KEY.includes("VOTRE");

let _sb = null;
export async function getSB() {
  if (!isConfigured) return null;
  if (_sb) return _sb;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  _sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _sb;
}
export async function getSession() {
  const sb = await getSB();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

/* ---------- Utilitaires ---------- */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const params = () => new URLSearchParams(location.search);
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const siteUrl = () => (CONFIG.SITE_URL || location.origin).replace(/\/$/, "");

const TZ = "Africa/Porto-Novo";
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : "";
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
export const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
export const dayNum = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", timeZone: TZ });
export const monthShort = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "short", timeZone: TZ }).replace(".", "");
export const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
export const initials = (n = "") => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Image de fond sûre pour un attribut style. */
export function bg(url) {
  if (!url) return "";
  const safe = encodeURI(String(url)).replace(/'/g, "%27").replace(/"/g, "%22").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `style="background-image:url(&quot;${esc(safe)}&quot;)"`;
}

/** Mini-Markdown sécurisé (titres ##, listes -, **gras**, *italique*, liens https). */
export function mdLite(src = "") {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  let out = "", list = false, para = [];
  const flushP = () => { if (para.length) { out += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
  const flushL = () => { if (list) { out += "</ul>"; list = false; } };
  for (const raw of String(src).replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushP(); flushL(); continue; }
    if (/^##\s+/.test(line)) { flushP(); flushL(); out += `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`; continue; }
    if (/^###\s+/.test(line)) { flushP(); flushL(); out += `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`; continue; }
    if (/^[-•]\s+/.test(line)) { flushP(); if (!list) { out += "<ul>"; list = true; } out += `<li>${inline(line.replace(/^[-•]\s+/, ""))}</li>`; continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return out;
}

export function friendlyError(e) {
  const m = String(e?.message || e || "");
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Connexion impossible. Vérifiez votre accès Internet et réessayez.";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m)) return "Action non autorisée avec votre compte.";
  if (/invalid login credentials/i.test(m)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(m)) return "Adresse e-mail non confirmée : ouvrez le message de confirmation reçu par e-mail.";
  if (/user already registered/i.test(m)) return "Un compte existe déjà avec cette adresse e-mail. Utilisez « Connexion ».";
  if (/duplicate key/i.test(m)) return "Cet enregistrement existe déjà (adresse e-mail ou identifiant en double).";
  if (/rate limit|too many/i.test(m)) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  if (/password/i.test(m) && /(short|least|weak)/i.test(m)) return "Mot de passe trop faible : utilisez au moins 10 caractères.";
  return m || "Une erreur est survenue. Réessayez.";
}

/* ---------- Icônes (SVG en ligne, trait 1.8) ---------- */
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M17 14.3c2.4.1 4.5 2 4.5 4.7"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  "user-plus": '<circle cx="10" cy="8" r="3.4"/><path d="M3.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M19 8v6M16 11h6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  shieldcheck: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  scale: '<path d="M12 4v16M6 20h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  handshake: '<path d="M2 12l5-5 4 2 3-2 4 3 4 0M2 12l6 6c1 1 2.4 1 3.2 0l1-1M12 17l2 2c.9.9 2.3.9 3 0l4-5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8z"/>',
  hardhat: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 6v5M8.5 7.8V11M15.5 7.8V11"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  news: '<path d="M5 5h11v14H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1zM16 9h4v8a2 2 0 0 1-2 2M8 9h5M8 13h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 13h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 6 6L16.5 12.5 20.5 14v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="9" cy="10" r="1.800"/><path d="M21 16l-5-5-8 9"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .900-1 1.700M12 17h.01"/>',
  gift: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M12 9v11M3 13h18M12 9C9 9 7 7.500 7.500 6S10.500 5 12 9c1.500-4 3.500-4.500 4.500-3S15 9 12 9z"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.4-1.500 1.600-2.200 3-2.200s2.600.7 3 2.200M14.500 10h4M14.500 13.500h4"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M20 20l-4.200-4.200"/>',
  download: '<path d="M12 4v11M7.500 11L12 15.500 16.500 11M5 20h14"/>',
  upload: '<path d="M12 16V5M7.500 9L12 4.500 16.500 9M5 20h14"/>',
  file: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.500 13h7M8.500 17h5"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15zM10 21h4"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.200 5.200l2.100 2.100M16.700 16.700l2.100 2.100M5.200 18.800l2.100-2.100M16.700 7.300l2.100-2.100"/>',
  dashboard: '<rect x="3.500" y="3.500" width="7" height="9" rx="1.500"/><rect x="13.500" y="3.500" width="7" height="5" rx="1.500"/><rect x="13.500" y="11.500" width="7" height="9" rx="1.500"/><rect x="3.500" y="15.500" width="7" height="5" rx="1.500"/>',
  inbox: '<path d="M3 13l2.500-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1 2.500h6L16 13h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  building: '<path d="M4 21V6l8-3 8 3v15M2 21h20M8 9h2M14 9h2M8 13h2M14 13h2M10 21v-4h4v4"/>',
  crane: '<path d="M6 21V8M6 8h14M3 8h3M6 3l-3 5M6 3l14 5M17 8v5M17 13a1.200 1.200 0 1 0 0 .01M4 21h5"/>',
  road: '<path d="M8 3L4 21M16 3l4 18M12 4v3M12 10.500v3M12 17v3"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM7 13l2.500 2.500M10 10l2.500 2.500M13 7l2.500 2.500"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 12.500l9 5 9-5M3 17l9 5 9-5"/>',
  hammer: '<path d="M14 6l4 4M12 8l-8 8 4 4 8-8M13 4l3-1 5 5-1 3-3 1"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5zM6 11.500V17c0 1.500 2.700 3 6 3s6-1.500 6-3v-5.500"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  qr: '<rect x="3.500" y="3.500" width="7" height="7" rx="1"/><rect x="13.500" y="3.500" width="7" height="7" rx="1"/><rect x="3.500" y="13.500" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14v3M14 19h3M19 19h1.500"/>',
  print: '<path d="M7 9V3h10v6M7 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3M7 14h10v7H7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.600 0l3-3a4 4 0 0 0-5.600-5.600l-1 1M14 10a4 4 0 0 0-5.600 0l-3 3a4 4 0 0 0 5.600 5.600l1-1"/>',
  log: '<path d="M7 4h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9.500 3h5v3h-5zM9 11h6M9 15h6"/>',
  flagalert: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  mailopen: '<path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 10l9 6 9-6"/>',
  home: '<path d="M3 11l9-7 9 7M5.500 9.500V20h13V9.500M10 20v-5h4v5"/>',
  sitemap: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2.500" y="16" width="6" height="5" rx="1"/><rect x="15.500" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5.500 16v-4h13v4"/>',
};
export function icon(name, size = 22, extra = "") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${P[name] || P.info}</svg>`;
}

/* ---------- Toasts & modales ---------- */
export function toast(msg, type = "") {
  let w = $(".toast-wrap");
  if (!w) { w = document.createElement("div"); w.className = "toast-wrap"; w.setAttribute("role", "status"); w.setAttribute("aria-live", "polite"); document.body.appendChild(w); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.textContent = msg; w.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; setTimeout(() => t.remove(), 450); }, 4200);
}

export function openModal({ title = "", body = "", footer = "", wide = false, onClose } = {}) {
  const back = document.createElement("div");
  back.className = "modal-backdrop open";
  back.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" type="button" aria-label="Fermer">${icon("x", 20)}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</div>`;
  document.body.appendChild(back);
  document.body.style.overflow = "hidden";
  const close = () => { back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  $(".modal-close", back).addEventListener("click", close);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  setTimeout(() => $("input,select,textarea,button.btn", back)?.focus(), 30);
  return { el: back, close, $: (s) => $(s, back) };
}

export const loader = () => `<div class="loader" role="status" aria-label="Chargement"><i></i></div>`;
export const emptyState = (title, text, ic = "folder") => `<div class="empty"><div class="icon-badge">${icon(ic, 28)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;

/* ---------- Animations ---------- */
export function observeReveals(root = document) {
  const els = $$(".reveal:not(.in)", root);
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}
export function countUps(root = document) {
  $$("[data-count]", root).forEach((el) => {
    const target = +el.dataset.count; if (!target) { el.textContent = "0"; return; }
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return; io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const tick = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
  });
}

/* ---------- Paramètres publics du site (coordonnées, réseaux) ---------- */
let _settings = null;
export async function loadSettings() {
  if (_settings) return _settings;
  const base = {
    contact_email: CONFIG.CONTACT.email, contact_phone: CONFIG.CONTACT.phone, contact_address: CONFIG.CONTACT.address,
    social_facebook: CONFIG.SOCIAL.facebook, social_whatsapp: CONFIG.SOCIAL.whatsapp, social_instagram: CONFIG.SOCIAL.instagram,
    social_linkedin: CONFIG.SOCIAL.linkedin, social_youtube: CONFIG.SOCIAL.youtube,
  };
  try {
    const sb = await getSB();
    if (sb) {
      const { data } = await sb.from("site_settings").select("key,value");
      (data || []).forEach((r) => { if (r.value) base[r.key] = r.value; });
    }
  } catch { /* on garde les valeurs de config.js */ }
  _settings = base;
  return base;
}
const SOCIAL_LABELS = { facebook: "Facebook", whatsapp: "WhatsApp", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" };
export function socialLinks(s) {
  return Object.keys(SOCIAL_LABELS)
    .filter((k) => /^https?:\/\//i.test(s["social_" + k] || ""))
    .map((k) => `<a href="${esc(s["social_" + k])}" target="_blank" rel="noopener noreferrer" aria-label="${SOCIAL_LABELS[k]}">${SOCIAL_LABELS[k]}</a>`).join("");
}

/* ---------- En-tête & pied de page ---------- */
const NAV = [
  ["index.html", "Accueil"], ["a-propos.html", "À propos"], ["organisation.html", "Organisation"],
  ["actualites.html", "Actualités"], ["evenements.html", "Événements"], ["ressources.html", "Ressources"], ["opportunites.html", "Opportunités"],
];
const MORE = [["activites.html", "Activités"], ["partenaires.html", "Partenaires"], ["galerie.html", "Galerie"], ["faq.html", "FAQ"], ["soutenir.html", "Soutenir GCU-BÉNIN"], ["contact.html", "Contact"]];
export const currentPage = () => { let p = location.pathname.split("/").pop() || "index"; return p.replace(/\.html$/, "") || "index"; };
const isActive = (href) => href.replace(/\.html$/, "") === currentPage();

function headerHTML() {
  const a = (h, l) => `<a href="${h}"${isActive(h) ? ' class="active" aria-current="page"' : ""}>${l}</a>`;
  const moreActive = MORE.some(([h]) => isActive(h));
  return `<div class="stripe"></div>
  <header class="site-header" id="top"><div class="container header-inner">
    <a class="brand" href="index.html" aria-label="${esc(CONFIG.ORG.short)} — accueil">
      <img src="${esc(CONFIG.LOGO)}" alt="" width="46" height="46"><span class="brand-text"><strong>${esc(CONFIG.ORG.short)}</strong><small>Génie Civil Unis</small></span></a>
    <nav class="nav" aria-label="Navigation principale">${NAV.map(([h, l]) => a(h, l)).join("")}
      <div class="dd"><button class="dd-btn${moreActive ? " active" : ""}" type="button" aria-expanded="false" aria-haspopup="true">Plus ${icon("chevron", 16)}</button>
        <div class="dd-menu">${MORE.map(([h, l]) => `<a href="${h}">${l}</a>`).join("")}</div></div>
    </nav>
    <div class="header-cta">
      <a class="btn btn-outline btn-sm btn-ghost-nav" id="acct-link" href="connexion.html">${icon("user", 18)} Connexion</a>
      <a class="btn btn-primary btn-sm" href="adhesion.html">Rejoindre</a>
      <button class="burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false">${icon("menu", 24)}</button>
    </div></div></header>
  <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
    <div class="mm-top"><a class="brand" href="index.html" style="color:#fff"><img src="${esc(CONFIG.LOGO)}" alt="" width="42" height="42"><span class="brand-text"><strong>${esc(CONFIG.ORG.short)}</strong></span></a>
      <button class="modal-close" type="button" id="mm-close" aria-label="Fermer le menu">${icon("x", 22)}</button></div>
    ${[...NAV, ...MORE].map(([h, l]) => `<a class="mm-link" href="${h}">${l}</a>`).join("")}
    <a class="btn btn-primary" href="adhesion.html">Rejoindre la communauté</a>
    <a class="btn btn-light" href="connexion.html">Espace membre</a>
  </div>`;
}

function footerHTML() {
  return `<footer class="site-footer"><div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="index.html"><img src="${esc(CONFIG.LOGO)}" alt="" width="52" height="52"><span class="brand-text"><strong>${esc(CONFIG.ORG.short)}</strong><small>${esc(CONFIG.ORG.name)}</small></span></a>
        <p class="footer-slogan">« ${esc(CONFIG.ORG.slogan)} »</p>
        <p>Une communauté nationale qui rassemble élèves, étudiants, techniciens et ingénieurs autour du génie civil, pour partager les connaissances et construire l'avenir du Bénin.</p>
        <div class="socials" id="f-socials"></div>
      </div>
      <div><h4>Navigation rapide</h4><ul>
        <li><a href="index.html">Accueil</a></li><li><a href="a-propos.html">À propos</a></li><li><a href="a-propos.html#qui-sommes-nous">Qui sommes-nous ?</a></li>
        <li><a href="a-propos.html#objectifs">Objectifs</a></li><li><a href="a-propos.html#mission">Notre mission</a></li><li><a href="a-propos.html#valeurs">Nos valeurs</a></li>
        <li><a href="organisation.html">Organisation</a></li><li><a href="activites.html">Nos activités</a></li></ul></div>
      <div><h4>Espace communautaire</h4><ul>
        <li><a href="adhesion.html">Adhésion</a></li><li><a href="membre.html">Espace membre</a></li><li><a href="ressources.html">Ressources</a></li>
        <li><a href="actualites.html">Actualités</a></li><li><a href="evenements.html">Événements</a></li><li><a href="opportunites.html">Opportunités</a></li>
        <li><a href="partenaires.html">Partenaires</a></li><li><a href="galerie.html">Galerie</a></li></ul></div>
      <div><h4>Contact</h4><ul class="footer-contact" id="f-contact"><li><a href="contact.html">${icon("mail", 18)}<span>Formulaire de contact</span></a></li></ul>
        <p class="mt-2" style="font-size:.9rem"><a href="faq.html">Questions fréquentes</a> · <a href="soutenir.html">Soutenir GCU-BÉNIN</a></p></div>
    </div>
    <div class="footer-legal">
      <div class="legal-links">
        <a href="statuts.html">Statuts</a><a href="reglement-interieur.html">Règlement intérieur</a><a href="confidentialite.html">Politique de confidentialité</a>
        <a href="conditions.html">Conditions d'utilisation</a><a href="confidentialite.html#donnees">Gestion des données personnelles</a><a href="confidentialite.html#cookies">Cookies</a>
      </div>
      <div>© ${new Date().getFullYear()} ${esc(CONFIG.ORG.name)} (${esc(CONFIG.ORG.short)}). Tous droits réservés.</div>
    </div></div></footer>`;
}

export async function initLayout() {
  const h = $("#site-header"), f = $("#site-footer");
  if (h) h.innerHTML = headerHTML();
  if (f) f.innerHTML = footerHTML();
  if (!$(".skip-link")) { const s = document.createElement("a"); s.className = "skip-link"; s.href = "#main"; s.textContent = "Aller au contenu"; document.body.prepend(s); }

  const header = $(".site-header");
  const onScroll = () => header?.classList.toggle("scrolled", scrollY > 8);
  onScroll(); addEventListener("scroll", onScroll, { passive: true });

  const dd = $(".dd");
  $(".dd-btn")?.addEventListener("click", (e) => { e.stopPropagation(); const o = dd.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); });
  document.addEventListener("click", () => dd?.classList.remove("open"));

  const mm = $("#mobile-menu"), burger = $(".burger");
  const setMM = (o) => { mm?.classList.toggle("open", o); mm?.setAttribute("aria-hidden", !o); burger?.setAttribute("aria-expanded", o); document.body.style.overflow = o ? "hidden" : ""; };
  burger?.addEventListener("click", () => setMM(true));
  $("#mm-close")?.addEventListener("click", () => setMM(false));
  $$(".mm-link, #mobile-menu .btn", mm || document).forEach((a) => a.addEventListener("click", () => setMM(false)));

  hydrateIcons(); hydratePhotos(); observeReveals(); countUps();

  // Coordonnées + réseaux (async, n'empêche pas l'affichage)
  loadSettings().then((s) => {
    const c = $("#f-contact");
    if (c) {
      let html = "";
      if (s.contact_email) html += `<li>${icon("mail", 18)}<a href="mailto:${esc(s.contact_email)}">${esc(s.contact_email)}</a></li>`;
      if (s.contact_phone) html += `<li>${icon("phone", 18)}<a href="tel:${esc(s.contact_phone.replace(/\s/g, ""))}">${esc(s.contact_phone)}</a></li>`;
      if (s.contact_address) html += `<li>${icon("pin", 18)}<span>${esc(s.contact_address)}</span></li>`;
      c.innerHTML = html + `<li><a href="contact.html">${icon("mail", 18)}<span>Formulaire de contact</span></a></li>`;
    }
    const so = $("#f-socials"); if (so) so.innerHTML = socialLinks(s);
  });

  // Bouton de compte
  getSession().then((sess) => {
    const a = $("#acct-link");
    if (sess && a) { a.href = "membre.html"; a.innerHTML = `${icon("user", 18)} Mon espace`; }
  }).catch(() => {});
}

/** Débloque le chargement d'une page de liste : affiche un message si la base n'est pas branchée. */
export function notConfiguredNotice() {
  return `<div class="alert alert-info">${icon("info", 20)}<div>Le contenu dynamique apparaîtra ici dès que la base de données sera connectée (voir <strong>README.md</strong>, étape 2).</div></div>`;
}

/* ---------- Icônes et photos déclaratives dans le HTML statique ---------- */
/** <i data-icon="users" data-size="28"></i>  →  SVG en ligne */
export function hydrateIcons(root = document) {
  $$("i[data-icon]", root).forEach((el) => {
    const t = document.createElement("span");
    t.style.display = "contents";
    t.innerHTML = icon(el.dataset.icon, +el.dataset.size || 22, el.dataset.class ? `class="${esc(el.dataset.class)}"` : "");
    el.replaceWith(...t.childNodes);
  });
}
/** <div class="photo ph" data-photo="assets/images/x.jpg"> : l'image remplace le motif « plan » dès qu'elle existe. */
export function hydratePhotos(root = document) {
  $$("[data-photo]", root).forEach((el) => {
    const src = el.dataset.photo; if (!src) return;
    const im = new Image();
    im.onload = () => { el.style.backgroundImage = `url("${src}")`; el.classList.remove("ph"); $(".ph-art", el)?.remove(); };
    im.src = src;
  });
}

/* ---------- Listes communes ---------- */
export const RESOURCE_CATEGORIES = ["Bâtiment", "Routes et travaux publics", "Dessin technique", "Lecture de plans", "Matériaux de construction", "Topographie", "Structures et fondations", "Béton armé", "Métré et devis", "Sécurité sur les chantiers", "Logiciels de conception et de dessin", "Documents pédagogiques"];
export const CATEGORY_ICONS = { "Bâtiment": "building", "Routes et travaux publics": "road", "Dessin technique": "ruler", "Lecture de plans": "eye", "Matériaux de construction": "layers", "Topographie": "compass", "Structures et fondations": "hardhat", "Béton armé": "hammer", "Métré et devis": "scale", "Sécurité sur les chantiers": "shieldcheck", "Logiciels de conception et de dessin": "crane", "Documents pédagogiques": "cap" };
export const NEWS_CATEGORIES = ["Annonce officielle", "Vie de la communauté", "Communiqué de la Direction nationale", "Compte rendu d'activité", "Information technique", "Partenariat", "Actualité du secteur"];
export const OPP_TYPES = { stage: { label: "Stage", cls: "blue", icon: "briefcase" }, formation: { label: "Formation", cls: "green", icon: "cap" }, emploi: { label: "Emploi", cls: "amber", icon: "hammer" } };
export const MESSAGE_CATEGORIES = { adhesion: "Adhésion", partenariat: "Partenariat", ressources: "Ressources", evenements: "Événements", opportunites: "Opportunités", signalement: "Signalement", presse: "Presse / médias", autre: "Autre demande" };
export const MESSAGE_STATUS = { nouveau: "Nouveau", en_cours: "En cours", en_attente: "En attente de réponse", traite: "Traité" };
export const REQUEST_STATUS = { en_attente: "En attente", en_cours: "En cours d'examen", accepte: "Acceptée", refuse: "Refusée" };
export const LEVELS = ["Élève (filière technique)", "Étudiant", "Technicien", "Ingénieur", "Architecte ou profession associée", "Enseignant / formateur", "Professionnel de la construction", "Autre"];
export const COMMUNES = ["Cotonou", "Abomey-Calavi", "Porto-Novo", "Sèmè-Podji", "Ouidah", "Allada", "Parakou", "Djougou", "Natitingou", "Kandi", "Malanville", "Bohicon", "Abomey", "Lokossa", "Comè", "Dassa-Zoumè", "Savè", "Pobè", "Aplahoué", "Tanguiéta"];

export const truncate = (s = "", n = 140) => { s = String(s).replace(/\s+/g, " ").replace(/[#*_\[\]()-]{1,}/g, (m) => (m.length > 1 ? "" : m)).trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const isExpired = (deadline) => !!deadline && deadline < todayISO();
export const safe = async (p, fallback = []) => { try { const r = await p; return r?.error ? (console.warn(r.error), fallback) : (r?.data ?? fallback); } catch (e) { console.warn(e); return fallback; } };
