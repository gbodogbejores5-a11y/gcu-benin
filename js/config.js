/* ==========================================================================
   GCU-BÉNIN — Configuration globale du site
   ========================================================================== */

window.GCU_CONFIG = {
  // Identité du site
  nom: {
    long: "GÉNIE CIVIL UNIS — BÉNIN",
    court: "GCU-BÉNIN",
    sigle: "GCU-BÉNIN"
  },
  
  slogan: "Unis par le génie civil, bâtissons l'avenir du Bénin.",
  
  // Coordonnées
  contact: {
    email: "",      // À remplir
    telephone: "",  // À remplir
    adresse: ""     // À remplir
  },
  
  // Réseaux sociaux
  social: {
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    whatsapp: ""
  },
  
  // Langue par défaut
  langue: "fr",
  
  // Année de création
  anneeCreation: new Date().getFullYear(),
  
  // Membres
  adhesion: {
    ouverte: true,
    cotisation: ""  // Laisser vide tant que non défini
  },
  
  // Configuration du serveur (à connecter plus tard)
  api: {
    base: "",       // URL de l'API
    timeout: 10000  // Timeout de 10 secondes
  }
};

// Fonction utilitaire pour formater l'année courante
window.GCU_HELPERS = {
  anneeCourante() {
    return new Date().getFullYear();
  },
  
  formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  },
  
  // Validation des formulaires
  validateForm(form) {
    const errors = [];
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    
    inputs.forEach(input => {
      if (!input.value.trim()) {
        errors.push({
          field: input.name,
          message: `Le champ ${input.placeholder || input.name} est requis`
        });
        input.classList.add('has-error');
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};