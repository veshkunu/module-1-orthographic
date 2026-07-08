// Inline term-definition popover (DESIGN.md §5.7 "Inline term definition").
//
// Adapted verbatim from the sibling topics' terms.js: the Module-1 family's
// SINGLETON #term-pop element (the z-ladder's --z-term rung), filled from the
// TERMS glossary and driven by listeners DELEGATED from the stable #wizard
// container so re-rendered step bodies never need re-wiring.
//
// Layering (ADR-007 / RULES.md §3.6): leaf module. main.js calls initTerms()
// once at startup. It imports orthoSteps.js the same pure-data way stepper.js
// does; it never touches the orchestrator or another behaviour leaf.

import { TERMS } from './orthoSteps.js';

/** @returns {{ dispose: () => void }} */
export function initTerms() {
  const wizard = document.getElementById('wizard');
  const pop = document.getElementById('term-pop');
  if (!wizard || !pop) return { dispose: () => {} };

  const ac = new AbortController();
  const listen = { signal: ac.signal };
  const MARGIN = 8;

  let open = null;

  function hide() {
    if (!open) return;
    pop.classList.remove('is-open');
    open.removeAttribute('aria-describedby');
    open = null;
  }

  function show(term) {
    if (!term.isConnected) { hide(); return; }
    const def = TERMS[term.dataset.t];
    if (!def) return;
    if (open && open !== term) hide();

    pop.innerHTML = `<span class="term-pop__title">${def.label}</span>${def.def}`;
    term.setAttribute('aria-describedby', 'term-pop');

    const t = term.getBoundingClientRect();
    const p = pop.getBoundingClientRect();

    let top = t.bottom + 6;
    let placedAbove = false;
    if (top + p.height > window.innerHeight - MARGIN) {
      top = t.top - p.height - 6;
      placedAbove = true;
    }
    let left = t.left;
    if (left + p.width > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - p.width;
    if (left < MARGIN) left = MARGIN;

    pop.style.top = `${Math.max(MARGIN, top)}px`;
    pop.style.left = `${left}px`;
    pop.style.transformOrigin = placedAbove ? 'bottom' : 'top';
    pop.classList.add('is-open');
    open = term;
  }

  const termFrom = (e) => e.target.closest?.('.term');

  wizard.addEventListener('mouseover', (e) => { const t = termFrom(e); if (t) show(t); }, listen);
  wizard.addEventListener('mouseout', (e) => {
    const t = termFrom(e);
    if (t && t === open && document.activeElement !== t) hide();
  }, listen);
  wizard.addEventListener('focusin', (e) => { const t = termFrom(e); if (t) show(t); }, listen);
  wizard.addEventListener('focusout', (e) => { const t = termFrom(e); if (t && t === open) hide(); }, listen);
  wizard.addEventListener('click', (e) => {
    const t = termFrom(e);
    if (!t) return;
    e.preventDefault();
    if (open === t) hide(); else show(t);
  }, listen);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { open?.blur(); hide(); } }, listen);
  window.addEventListener('scroll', () => { if (open) show(open); }, { capture: true, signal: ac.signal });

  return { dispose: () => { hide(); ac.abort(); } };
}
