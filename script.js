const backdrop = document.querySelector('.modal-backdrop');
const close = document.querySelector('.modal-close');
const panels = [...document.querySelectorAll('.modal-content')];
const triggers = [...document.querySelectorAll('[data-modal]')];

function openModal(name){
  panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  const active = panels.find(p => p.classList.contains('active'));
  const index = Math.max(0, panels.indexOf(active)) + 1;
  document.querySelector('.modal-counter').textContent = `${String(index).padStart(2,'0')} / 03`;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeModal(){
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
triggers.forEach(t => t.addEventListener('click', () => openModal(t.dataset.modal)));
close.addEventListener('click', closeModal);
backdrop.addEventListener('click', e => { if(e.target === backdrop) closeModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

const dots = [...document.querySelectorAll('.hero-index span')];
let dotIndex = 0;
setInterval(() => {
  dots[dotIndex].classList.remove('is-active');
  dotIndex = (dotIndex + 1) % dots.length;
  dots[dotIndex].classList.add('is-active');
}, 2600);

const revealTargets = document.querySelectorAll('.studio-title,.studio-copy,.service-item,.archive-card,.closing-grid');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
},{threshold:.12});
revealTargets.forEach(el => observer.observe(el));
