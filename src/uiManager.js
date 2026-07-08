// Parameter dock controller — the bridge between the two continuous numeric
// controls (projector tilt, object rotation) and the orchestrator's
// commit()/rebuild() pipeline. Adapted from the sibling topics' uiManager.js:
// the slider <-> numeric-input two-way sync and the revert-on-invalid-entry
// rule are the same.
//
// Unlike the sibling topics, each field is revealed INDEPENDENTLY (tilt only
// on Step 5, rotation only on Step 6 — they are never both on stage at once),
// so sync() toggles each field's own hidden state from its own view flag
// rather than one group-level toggle.
//
// Layering (ADR-007 / RULES.md §3.6): leaf module. main.js injects the `sim`
// controller; this module never reaches into the orchestrator, the scene, or
// another leaf. The discrete ray-mode and dissolve controls live in
// stepper.js instead (the same split the sibling topics use).

/**
 * @typedef {Object} SimController
 * @property {() => {rotationY:number, projectorTilt:number, rayMode:string}} getData
 * @property {() => Record<string, any>} getView
 * @property {(partial:object) => void} commit
 * @property {(message:string) => void} announce
 */

const FIELDS = [
  { key: 'projectorTilt', range: 'rng-tilt', num: 'num-tilt', field: 'field-tilt', viewFlag: 'tiltControl', min: 60, max: 90, decimals: 0 },
  { key: 'rotationY', range: 'rng-rotation', num: 'num-rotation', field: 'field-rotation', viewFlag: 'rotationControl', min: 0, max: 360, decimals: 0 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Parse a typed numeric field, tolerating a decimal COMMA (3,5 → 3.5).
 * @param {string} str
 * @returns {number}
 */
const parseNumeric = (str) => parseFloat(String(str).trim().replace(',', '.'));

/**
 * @param {SimController} sim
 * @returns {{ sync: () => void, dispose: () => void }}
 */
export function initUIManager(sim) {
  const ac = new AbortController();
  const listen = { signal: ac.signal };
  const $ = (id) => document.getElementById(id);

  const controls = $('controls');
  const fmt = (value, decimals) => Number(value).toFixed(decimals);

  function setPair(cfg, value) {
    const range = $(cfg.range);
    const num = $(cfg.num);
    range.value = String(value);
    num.value = fmt(value, cfg.decimals);
    range.setAttribute('aria-valuetext', `${fmt(value, cfg.decimals)} degrees`);
  }

  for (const cfg of FIELDS) {
    const range = $(cfg.range);
    const num = $(cfg.num);

    range.addEventListener('input', () => {
      const value = clamp(parseFloat(range.value), cfg.min, cfg.max);
      setPair(cfg, value);
      sim.commit({ [cfg.key]: value });
    }, listen);

    num.addEventListener('change', () => {
      const parsed = parseNumeric(num.value);
      if (Number.isFinite(parsed)) {
        const value = clamp(parsed, cfg.min, cfg.max);
        setPair(cfg, value);
        sim.commit({ [cfg.key]: value });
      } else {
        const last = sim.getData()[cfg.key];
        setPair(cfg, last);
        sim.announce(`Kept your last value, ${fmt(last, cfg.decimals)} degrees.`);
      }
    }, listen);
  }

  /** Full refresh from current data + view — initial load, every commit,
   *  every step change, and reset. Each field is revealed independently by
   *  its own view flag (they are never both on stage at once). */
  function sync() {
    const data = sim.getData();
    const view = sim.getView();
    let anyVisible = false;

    for (const cfg of FIELDS) {
      const visible = !!view[cfg.viewFlag];
      anyVisible = anyVisible || visible;
      setPair(cfg, data[cfg.key]);
      const fieldEl = $(cfg.field);
      if (fieldEl) fieldEl.hidden = !visible;
      $(cfg.range).disabled = !visible;
      $(cfg.num).disabled = !visible;
    }

    if (controls) controls.hidden = !anyVisible;
  }

  sync();

  return { sync, dispose: () => ac.abort() };
}
