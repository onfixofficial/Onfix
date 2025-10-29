/* main.js — Refactored for ONFIX landing page
   - Load modular sections
   - Init UI interactions after sections loaded
   - Clean, single-responsibility functions
*/

/* ============================
   Sections to fetch (id targets must exist in index.html)
   ============================ */
const sections = [
  { id: 'section-navbar', path: 'sections/navbar.html' },
  { id: 'section-hero', path: 'sections/hero.html' },
  { id: 'section-services', path: 'sections/services.html' },
  { id: 'section-portfolio', path: 'sections/portfolio.html' },
  { id: 'section-ig', path: 'sections/ig.html' },
  { id: 'section-pesan', path: 'sections/pesan.html' },
  { id: 'section-cta', path: 'sections/cta.html' },
  { id: 'section-footer', path: 'sections/footer.html' }
];

/* ============================
   Section loader
   ============================ */
async function loadSection(targetId, path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    const html = await res.text();
    const container = document.getElementById(targetId);
    if (container) container.innerHTML = html;
    else console.warn('Missing container for', targetId);
  } catch (err) {
    console.error('Error loading', path, err);
    const container = document.getElementById(targetId);
    if (container) container.innerHTML = `<div class="container py-4"><p class="text-muted">Failed to load ${path}</p></div>`;
  }
}

async function loadAllSectionsSequentially() {
  for (const s of sections) {
    await loadSection(s.id, s.path);
  }
  // After sections inserted into DOM, initialize interactions
  initInteractions();
}

/* Start loading when DOM ready */
window.addEventListener('DOMContentLoaded', loadAllSectionsSequentially);


/* ============================
   Top-level initializer
   ============================ */
function initInteractions() {
  setYear();
  initLazyLoader();        // create lazy loader & expose observeLazy()
  initRevealOnScroll();
  initNavScroll();
  initHeroInteractions();
  initServicesScroller();
  initPortfolioLightbox();
  initContactForm();      // floating label + stagger
  initOrderForm();        // order/contact form submit handling
  // ensure lazy observer picks up newly added images
  if (window.observeLazy) window.observeLazy();
}

/* ============================
   Utility: set current year for elements with id year / year-js / yearFooter
   ============================ */
function setYear() {
  const yearEls = document.querySelectorAll('#year, #year-js, #yearFooter');
  yearEls.forEach(el => { el.textContent = new Date().getFullYear(); });
}

/* ============================
   Lazy loader (IntersectionObserver)
   - Defines window.observeLazy() to re-observe newly added images
   ============================ */
function initLazyLoader() {
  if (window.observeLazy) return; // already initialized

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.getAttribute('data-src');
      if (src) {
        img.src = src;
        // optional: support srcset if provided as data-srcset
        const srcset = img.getAttribute('data-srcset');
        if (srcset) img.setAttribute('srcset', srcset);
      }
      img.classList.add('loaded');
      obs.unobserve(img);
    });
  }, { rootMargin: '160px 0px' });

  // observe initial images already present
  document.querySelectorAll('img.lazy').forEach(i => io.observe(i));

  // helper to observe any new lazy images injected later
  window.observeLazy = () => {
    document.querySelectorAll('img.lazy:not(.loaded)').forEach(i => io.observe(i));
  };
}

/* ============================
   Reveal on scroll (IntersectionObserver)
   - Adds .is-visible to elements with .reveal
   ============================ */
function initRevealOnScroll() {
  const reveals = Array.from(document.querySelectorAll('.reveal'));
  if (!reveals.length) return;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(r => io.observe(r));
}

// ===============================
// 🌐 NAVBAR BEHAVIOR ON SCROLL
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.getElementById("topNav");
  const threshold = 50;

  const onScroll = () => {
    if (window.scrollY > threshold) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // Run once on load
});


/* ============================
   Hero micro-interactions
   - subtle parallax + tilt on hover
   ============================ */
function initHeroInteractions() {
  const mockup = document.getElementById('heroMockup');
  const floats = Array.from(document.querySelectorAll('.float-ico, .float-img'));

  // parallax on scroll
  const parallax = () => {
    const sc = window.scrollY;
    if (mockup) {
      const depth = 0.08;
      mockup.style.transform = `translateY(${Math.max(-18, -sc * depth)}px)`;
    }
    floats.forEach((el, i) => {
      const d = (i + 1) * 0.06;
      el.style.transform = `translateY(${Math.max(-24, -sc * d)}px) rotate(${Math.sin(sc * 0.01 + i) * 3}deg)`;
    });
  };

  window.addEventListener('scroll', parallax, { passive: true });
  parallax();

  // micro-tilt for mockup
  if (mockup) {
    const onMove = (e) => {
      const rect = mockup.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width - 0.5;
      const my = (e.clientY - rect.top) / rect.height - 0.5;
      mockup.style.transform = `perspective(900px) rotateY(${mx * 6}deg) rotateX(${-my * 6}deg) translateY(-8px)`;
    };
    const onLeave = () => { mockup.style.transform = ''; };
    mockup.addEventListener('mousemove', onMove);
    mockup.addEventListener('mouseleave', onLeave);
  }

  // ensure hero images lazy-load
  if (window.observeLazy) window.observeLazy();
}

/* ============================
   Services scroller (single, robust implementation)
   - expects .services-scroll and buttons .svc-prev / .svc-next
   - handles wheel-to-scroll and keyboard arrows
   ============================ */
function initServicesScroller() {
  const scrollWrap = document.querySelector('.services-scroll, #servicesScroll');
  if (!scrollWrap) return;

  const prevBtn = document.querySelector('.svc-prev, #svc-prev');
  const nextBtn = document.querySelector('.svc-next, #svc-next');

  // compute reasonable scroll distance based on a card width + gap
  const scrollByCard = (dir = 1) => {
    const card = scrollWrap.querySelector('.service-card');
    if (!card) return;
    const gap = 18; // fallback gap
    const style = getComputedStyle(scrollWrap);
    // attempt detect gap via row-gap/column-gap if present
    const colGap = parseInt(style.columnGap || style.gap || gap, 10) || gap;
    const cardWidth = Math.round(card.getBoundingClientRect().width);
    scrollWrap.scrollBy({ left: (cardWidth + colGap) * dir, behavior: 'smooth' });
  };

  prevBtn && prevBtn.addEventListener('click', () => scrollByCard(-1));
  nextBtn && nextBtn.addEventListener('click', () => scrollByCard(1));

  // wheel -> horizontal scroll
  scrollWrap.addEventListener('wheel', (e) => {
    // prefer horizontal native scroll if user scrolls horizontally
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollWrap.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      e.preventDefault();
    }
  }, { passive: false });

  // keyboard arrows
  scrollWrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') scrollByCard(1);
    if (e.key === 'ArrowLeft') scrollByCard(-1);
  });

  // accessibility: ensure focusable
  scrollWrap.setAttribute('tabindex', scrollWrap.getAttribute('tabindex') || '0');

  // lazy images inside services
  if (window.observeLazy) window.observeLazy();
}

/* ============================
   Portfolio lightbox
   - finds #pfLightbox and .portfolio-item
   ============================ */
function initPortfolioLightbox() {
  const lb = document.getElementById('pfLightbox');
  if (!lb) return;
  const lbImg = lb.querySelector('.lb-img');

  const close = () => {
    lb.classList.remove('show');
    lb.setAttribute('aria-hidden', 'true');
    if (lbImg) lbImg.src = '';
  };

  document.querySelectorAll('.portfolio-item').forEach(item => {
    item.addEventListener('click', () => {
      const full = item.dataset.full || (item.querySelector('img') && item.querySelector('img').src);
      if (lbImg) lbImg.src = full || '';
      lb.classList.add('show');
      lb.setAttribute('aria-hidden', 'false');
    });
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') item.click(); });
  });

  const closeBtn = lb.querySelector('.close-lb');
  if (closeBtn) closeBtn.addEventListener('click', close);
  lb.addEventListener('click', (ev) => { if (ev.target === lb) close(); });
}

/* ============================
   Contact form enhancements
   - floating labels & reveal stagger
   - expects contact form markup: inputs/selects/textarea have placeholder=" "
   ============================ */
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  // add reveal-child + stagger delays to direct row children
  const rowChildren = Array.from(contactForm.querySelectorAll('.row > *'));
  rowChildren.forEach((el, idx) => {
    el.classList.add('reveal-child');
    el.style.transitionDelay = `${idx * 80}ms`;
  });

  // observe contact-section to trigger stagger reveal when visible
  const contactSection = document.querySelector('.contact-section');
  if (contactSection && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          contactForm.querySelectorAll('.reveal-child').forEach(el => el.classList.add('is-visible'));
          o.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    obs.observe(contactSection);
  }

  // floating label support: add 'filled' class on input if has value
  const fields = contactForm.querySelectorAll('input[placeholder], textarea[placeholder], select[placeholder]');
  fields.forEach(f => {
    // initial state
    if (f.value && f.value.trim() !== '') f.classList.add('filled');
    // toggle on input/change
    f.addEventListener('input', () => {
      if (f.value && f.value.trim() !== '') f.classList.add('filled');
      else f.classList.remove('filled');
    });
    // for selects, also listen to change
    f.addEventListener('change', () => {
      if (f.value && f.value.trim() !== '') f.classList.add('filled');
      else f.classList.remove('filled');
    });
  });
}

/* ============================
   Order / contact form submit behavior
   - #orderForm opens WA with prefilled message
   - #contactForm submit also opens WA (fallback)
   ============================ */
function initOrderForm() {
  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(orderForm);
      const name = data.get('name') || '';
      const service = data.get('service') || '';
      const phone = data.get('phone') || '';
      const notes = data.get('notes') || '';
      const text = encodeURIComponent(`Halo OnFix, saya *${name}* ingin memesan layanan: *${service}*.\nNoWA: ${phone}\nCatatan: ${notes}`);
      const waLink = `https://wa.me/6281931786798?text=${text}`;
      window.open(waLink, '_blank');
    });
  }

  // contact form id could be contactForm (contact section) — fallback
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = contactForm.querySelector('#name')?.value?.trim() ?? '';
      const phone = contactForm.querySelector('#phone')?.value?.trim() ?? '';
      const service = contactForm.querySelector('#service')?.value ?? '';
      const msg = contactForm.querySelector('#message')?.value?.trim() ?? '';
      const text = encodeURIComponent(`Halo OnFix, saya ${name}.%0AIngin layanan: ${service || '-'}%0A${msg}%0AHubungi saya di: ${phone}`);
      const wa = `https://wa.me/6281931786798?text=${text}`;
      window.open(wa, '_blank');
    });
  }

  // optional quick-wa button
  const btn = document.querySelector('#btn-wa');
  if (btn) btn.addEventListener('click', () => window.open('https://wa.me/6281931786798?text=Halo%20OnFix,%20saya%20butuh%20konsultasi', '_blank'));
}

/* ============================
   Defensive: ensure lazy observer runs if sections were static
   ============================ */
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // If loadAllSectionsSequentially already fired and initInteractions ran,
  // observeLazy may exist. Try to call it safely.
  setTimeout(() => { if (window.observeLazy) window.observeLazy(); }, 600);
}

// Hero: set background image from data-bg, parallax slight
(function(){
  const heroBg = document.querySelector('.hero-bg');
  if (!heroBg) return;
  const src = heroBg.getAttribute('data-bg') || 'assets/hero-bg.jpg';
  heroBg.style.backgroundImage = `url("${src}")`;

  // parallax effect on scroll
  const handle = () => {
    const sc = window.scrollY;
    heroBg.style.transform = `translateY(${Math.min(0, sc * -0.08)}px) scale(${1 + Math.min(0.02, sc * 0.0005)})`;
    // soften filter when scroll
    heroBg.style.filter = `saturate(${1 - Math.min(0.06, sc * 0.0005)}) contrast(${1 - Math.min(0.04, sc * 0.0004)})`;
  };
  window.addEventListener('scroll', handle, { passive:true });
  handle();

  // micro-tilt on card
  const card = document.getElementById('heroCard');
  if (card) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;
      const my = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${mx * 4}deg) rotateX(${ -my * 4 }deg) translateZ(6px)`;
    });
    card.addEventListener('mouseleave', () => card.style.transform = '');
  }
})();
