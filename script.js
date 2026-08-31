const cursor = document.querySelector('.cursor-pixel');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (cursor && !reduceMotion) {
  window.addEventListener('pointermove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  }, {passive:true});
}

const interactive = document.querySelectorAll('a, button, input, textarea');
interactive.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('pointer-active'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('pointer-active'));
});

const form = document.getElementById('brief-form');
const note = document.getElementById('form-note');
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim();
  const message = String(data.get('message') || '').trim();
  const subject = `fournfour brief — ${name || 'new enquiry'}`;
  const body = [`Name: ${name}`, `Email: ${email}`, '', 'What are we making?', message].join('\n');
  window.location.href = `mailto:hello@fournfour.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (note) note.textContent = 'Email draft prepared — send it from your mail app.';
});

// Tiny old-web interactions: random micro-shift on marked chromatic elements.
if (!reduceMotion) {
  document.querySelectorAll('.chromatic').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      el.style.setProperty('--jitter', `${(Math.random()*6-3).toFixed(1)}px`);
    });
  });
}
