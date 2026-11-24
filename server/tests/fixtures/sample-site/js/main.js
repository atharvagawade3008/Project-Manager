const nav = document.querySelector('.site-nav');
const toggle = document.querySelector('[data-menu-toggle]');

if (nav && toggle) {
  toggle.addEventListener('click', () => {
    nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(nav.classList.contains('is-open')));
  });
}

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

export function initTestimonials() {
  // TODO: fetch and render client testimonials once the CMS endpoint is available
  return null;
}
