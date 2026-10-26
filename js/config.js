/* ==========================================================================
   CONFIGURATION DU SITE — le seul fichier à modifier avant la mise en ligne
   ========================================================================== */

export const CONFIG = {
  // 1) Supabase : Project Settings → API (voir README, étape 2)
  //    La clé « anon public » est faite pour être publique : la sécurité repose
  //    sur les règles RLS du fichier supabase/01_schema.sql.
  //    ⚠ N'ÉCRIVEZ JAMAIS la clé « service_role » dans ce fichier.
  SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "VOTRE_CLE_ANON_PUBLIQUE",

  // 2) Adresse finale du site (sans « / » à la fin) — sert aux liens des cartes de membre
  SITE_URL: "",   // ex. "https://gcu-benin.pages.dev"  (vide = adresse actuelle du navigateur)

  // 3) Identité
  ORG: {
    short: "GCU-BÉNIN",
    name: "GÉNIE CIVIL UNIS — BÉNIN",
    slogan: "Unis par le génie civil, bâtissons l'avenir du Bénin.",
  },
  LOGO: "assets/images/logo.svg",   // remplacez par "assets/images/logo.png" si le client a son propre logo

  // 4) Coordonnées et réseaux : peuvent aussi être modifiés dans l'administration
  //    (Paramètres du site). Les valeurs de l'administration ont la priorité.
  //    Laissez vide tant que le compte / l'adresse n'existe pas officiellement.
  CONTACT: { email: "", phone: "", address: "" },
  SOCIAL: { facebook: "", whatsapp: "", instagram: "", linkedin: "", youtube: "" },

  // 5) Délai d'inactivité de l'administration avant déconnexion automatique (minutes)
  ADMIN_IDLE_MINUTES: 30,
};
