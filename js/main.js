// ==========================================================================
// GCU-BÉNIN — Scripts principaux
// ==========================================================================

(function() {
  'use strict';

  // ===== Éléments DOM =====
  const header = document.querySelector('header');
  const mobileMenuBtn = document.querySelector('[data-menu-btn]');
  const mobileNav = document.querySelector('[data-nav-mobile]');
  const animateElements = document.querySelectorAll('[data-animate]');
  const forms = document.querySelectorAll('form[data-validate]');
  
  // ===== Menu mobile =====
  function toggleMobileMenu() {
    const expanded = mobileMenuBtn?.getAttribute('aria-expanded') === 'true';
    mobileMenuBtn?.setAttribute('aria-expanded', !expanded);
    mobileNav?.classList.toggle('open');
    document.body.style.overflow = expanded ? '' : 'hidden';
  }
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  // ===== Animation au scroll =====
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    animateElements.forEach(el => {
      // Délai progressif
      const delay = parseInt(el.dataset.delay) || 0;
      if (delay) {
        el.style.transitionDelay = `${delay * 100}ms`;
      }
      observer.observe(el);
    });
  }
  
  // Démarrer les animations
  if (window.IntersectionObserver) {
    initScrollAnimations();
  } else {
    // Fallback : montrer tous les éléments immédiatement
    animateElements.forEach(el => el.classList.add('visible'));
  }

  // ===== Header sticky =====
  function initHeader() {
    if (!header) return;
    
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      
      if (currentScroll > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      lastScroll = currentScroll;
    });
  }
  
  initHeader();

  // ===== Validation des formulaires =====
  function initForms() {
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const validation = window.GCU_HELPERS.validateForm(form);
        
        if (!validation.valid) {
          validation.errors.forEach(error => {
            console.warn('Erreur de validation:', error);
          });
          
          const firstError = form.querySelector('.has-error');
          firstError?.focus();
          
          return;
        }
        
        // Afficher un message de succès
        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;
        
        // Simuler l'envoi (à remplacer par l'API réelle)
        setTimeout(() => {
          submitBtn.textContent = 'Message envoyé !';
          submitBtn.classList.add('success');
          
          // Réinitialiser après 3 secondes
          setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('success');
            form.reset();
          }, 3000);
        }, 1500);
      });
    });
  }
  
  initForms();

  // ===== Galerie d'images lightbox =====
  function initGallery() {
    const galleryItems = document.querySelectorAll('[data-gallery-item]');
    
    galleryItems.forEach(item => {
      item.addEventListener('click', () => {
        const imgSrc = item.dataset.full || item.querySelector('img')?.src;
        const caption = item.dataset.caption || '';
        
        // Créer la lightbox
        let lightbox = document.querySelector('.lightbox');
        
        if (!lightbox) {
          lightbox = document.createElement('div');
          lightbox.className = 'lightbox';
          lightbox.innerHTML = `
            <div class="lightbox-content">
              <button class="lightbox-close" aria-label="Fermer">&times;</button>
              <img src="" alt="">
              <p class="lightbox-caption"></p>
            </div>
          `;
          document.body.appendChild(lightbox);
          
          const closeBtn = lightbox.querySelector('.lightbox-close');
          closeBtn.addEventListener('click', () => {
            lightbox.classList.remove('open');
            document.body.style.overflow = '';
          });
          
          lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
              lightbox.classList.remove('open');
              document.body.style.overflow = '';
            }
          });
        }
        
        const img = lightbox.querySelector('img');
        const cap = lightbox.querySelector('.lightbox-caption');
        
        img.src = imgSrc;
        cap.textContent = caption;
        
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
  }
  
  initGallery();

  // ===== Smooth scroll pour les ancres =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ===== Mise à jour de l'année dans le footer =====
  const yearElements = document.querySelectorAll('[data-year]');
  yearElements.forEach(el => {
    el.textContent = new Date().getFullYear();
  });

})();