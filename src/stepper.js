// Guided-stepper controller — the wizard shell for the Orthographic Projection
// (Introduction) topic, adapted from the sibling topics' stepper.js. It
// sequences the seven steps defined in orthoSteps.js, revealing one step's
// controls at a time (progressive disclosure) and gating Next behind the
// current step's completion.
//
// Discrete per-step actions (the ray-mode compare toggle, Step 4; the
// dissolve toggle, Step 6) are wired directly here, the same split the
// sibling topics use — continuous numeric controls (the tilt and rotation
// sliders) live in uiManager.js instead.
//
// Layering (ADR-007 / RULES.md §3.6): leaf module. main.js injects the `sim`
// controller; this module never reaches into the orchestrator or another leaf.

import { STEPS } from './orthoSteps.js';
import { RayMode } from './orthoData.js';

const TOTAL = STEPS.length;

/**
 * @param {{
 *   announce: (msg: string) => void,
 *   showToast: (msg: string) => void,
 *   getData: () => { rotationY: number, projectorTilt: number, rayMode: string },
 *   getView: () => object,
 *   commit: (patch: object) => void,
 *   applyView: (view: object, cameraPose?: object) => void,
 *   setFlatOnly: (on: boolean) => void,
 *   isFlatOnly: () => boolean,
 *   hasDissolved: () => boolean,
 * }} sim  — injected by main.js (the simController contract).
 * @returns {{ sync: () => void, reset: () => void, dispose: () => void }}
 */
export function initStepper(sim) {
  const ac = new AbortController();
  const listen = { signal: ac.signal };
  const $ = (id) => document.getElementById(id);

  const card = $('step-card');
  const railItems = [...document.querySelectorAll('#step-rail .rail__item')];
  const panels = [...document.querySelectorAll('.step-panel')];
  const elCurrent = $('step-current');
  const elTotal = $('step-total');
  const elTitle = $('step-title');
  const elLead = $('step-lead');
  const elBody = $('step-body');
  const elHint = $('step-hint');

  const btnBack = $('btn-back');
  const btnNext = $('btn-next');

  const btnRayParallel = $('btn-ray-parallel');
  const btnRayPerspective = $('btn-ray-perspective');

  const btnDissolve = $('btn-dissolve');
  const doneDissolve = $('done-dissolve');

  if (elTotal) elTotal.textContent = String(TOTAL);

  let currentStep = 1;
  let highestVisited = 1;

  function isComplete(i) {
    const step = STEPS[i - 1];
    if (step.done) return !!step.done(sim);
    return i < highestVisited;
  }

  function canAdvance(step) {
    if (step >= TOTAL) return false;
    const meta = STEPS[step - 1];
    return meta.done ? !!meta.done(sim) : true;
  }

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------

  function renderRail() {
    for (const item of railItems) {
      const i = Number(item.dataset.step);
      const marker = item.querySelector('.rail__marker');
      const btn = item.querySelector('.rail__btn');
      const labelEl = item.querySelector('.rail__label');
      const current = i === currentStep;
      const complete = !current && isComplete(i);
      item.classList.toggle('is-current', current);
      item.classList.toggle('is-complete', complete);
      item.classList.toggle('is-upcoming', !current && !complete);
      if (marker) marker.textContent = complete ? '✓' : String(i);

      if (btn) {
        const reachable = current || complete || i < currentStep;
        btn.disabled = !reachable;
        const name = labelEl ? labelEl.textContent.trim() : `Step ${i}`;
        const stateWord = current ? 'current step' : reachable ? 'go to step' : 'locked';
        btn.setAttribute('aria-label', `Step ${i}, ${name}, ${stateWord}`);
        if (current) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      }
    }
  }

  /** Reflect live sim state into the per-step discrete action controls. */
  function renderActions() {
    const data = sim.getData();
    if (btnRayParallel) btnRayParallel.setAttribute('aria-pressed', String(data.rayMode === RayMode.PARALLEL));
    if (btnRayPerspective) btnRayPerspective.setAttribute('aria-pressed', String(data.rayMode === RayMode.PERSPECTIVE));

    const flat = sim.isFlatOnly();
    if (btnDissolve) btnDissolve.textContent = flat ? 'Show the solid again' : 'Reveal the flat view';
    if (doneDissolve) doneDissolve.hidden = !sim.hasDissolved();
  }

  function renderNav() {
    if (elCurrent) elCurrent.textContent = String(currentStep);
    if (btnBack) btnBack.hidden = currentStep === 1;
    if (btnNext) {
      btnNext.hidden = currentStep >= TOTAL;
      btnNext.disabled = !canAdvance(currentStep);
    }
  }

  function goToStep(n, { announce = true } = {}) {
    currentStep = Math.min(Math.max(n, 1), TOTAL);
    const firstArrival = currentStep === TOTAL && highestVisited < TOTAL;
    highestVisited = Math.max(highestVisited, currentStep);

    const meta = STEPS[currentStep - 1];
    if (elTitle) elTitle.textContent = meta.title;
    if (elLead) elLead.textContent = meta.lead;
    if (elBody) elBody.innerHTML = meta.body.map((p) => `<p>${p}</p>`).join('');
    if (elHint) {
      elHint.hidden = !meta.hint;
      if (meta.hint) elHint.innerHTML = meta.hint;
    }

    for (const panel of panels) {
      panel.hidden = Number(panel.dataset.step) !== currentStep;
    }

    sim.applyView(meta.view, meta.camera);

    if (card) card.scrollTop = 0;

    renderRail();
    renderActions();
    renderNav();

    if (firstArrival) sim.showToast?.('Orthographic Projection completed!');
    const winWord = firstArrival ? ' Orthographic Projection completed!' : '';
    if (announce) sim.announce(`Step ${currentStep} of ${TOTAL}. ${meta.title}.${winWord}`);
  }

  // ----------------------------------------------------------------------------
  // Wiring
  // ----------------------------------------------------------------------------

  // Step 4 — the parallel/perspective compare toggle.
  btnRayParallel?.addEventListener('click', () => {
    sim.commit({ rayMode: RayMode.PARALLEL });
    sim.announce('Showing parallel projectors.');
    renderActions();
  }, listen);
  btnRayPerspective?.addEventListener('click', () => {
    sim.commit({ rayMode: RayMode.PERSPECTIVE });
    sim.announce('Showing perspective (converging) rays, like a photograph.');
    renderActions();
  }, listen);

  // Step 6 — the dissolve toggle.
  btnDissolve?.addEventListener('click', () => {
    const next = !sim.isFlatOnly();
    sim.setFlatOnly(next);
    sim.announce(next
      ? 'The solid fades away, leaving only its flat view on the plane.'
      : 'The solid reappears.');
    renderRail(); renderActions(); renderNav();
  }, listen);

  btnNext?.addEventListener('click', () => { if (canAdvance(currentStep)) goToStep(currentStep + 1); }, listen);
  btnBack?.addEventListener('click', () => goToStep(currentStep - 1), listen);

  for (const item of railItems) {
    const btn = item.querySelector('.rail__btn');
    btn?.addEventListener('click', () => {
      const target = Number(item.dataset.step);
      if (target === currentStep) return;
      if (target > currentStep && !isComplete(target)) return;
      goToStep(target);
    }, listen);
  }

  // ----------------------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------------------

  function sync() { renderRail(); renderActions(); renderNav(); }

  function reset() {
    highestVisited = 1;
    goToStep(1, { announce: false });
  }

  goToStep(1, { announce: false });

  return { sync, reset, dispose: () => ac.abort() };
}
