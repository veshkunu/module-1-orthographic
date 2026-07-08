// orthoSteps.js — pure data layer for the Orthographic Projection (Introduction)
// guided sequence. No Three.js, no DOM nodes. stepper.js renders these into the
// step card and rail; main.js consumes the view flags through
// simController.applyView(). Body/hint copy is authored HTML (trusted, no user
// input) so it can embed <button class="term"> definitions, exactly as the
// sibling topics' step files do.
//
// Scope (deliberate — do not expand): this is an INTRODUCTION to the concept of
// orthographic projection using ONE object and ONE projection plane. It does not
// teach quadrants, first/third-angle placement, multiple coordinated views,
// sectional/auxiliary views, or drawing problems — those are the Spatial
// Framework / Points / Lines topics' job.
//
// Each step declares:
//   id        — stable key
//   title     — the tutor's headline (Title type)
//   lead      — one-sentence explanation under the title (Lead type)
//   body[]    — paragraphs of instruction (Body type); may contain term buttons
//   hint      — optional accent-wash callout
//   controls  — revealed controls (progressive disclosure):
//               'rayMode' | 'tilt' | 'rotation'
//   view      — viewport flags merged over DEFAULT_VIEW by simController.applyView()
//   done      — optional (sim) => boolean completion gate; steps without one are
//               reading/exploring steps, complete once the learner moves past them
//   orbitHint — show the one-time "drag to rotate" chip on this step

/** Term glossary. Keys match data-t="…" on term buttons. */
export const TERMS = Object.freeze({
  observer: {
    label: 'observer',
    def: 'Observer — the person (or camera) looking at the object. In an ordinary photograph the observer’s eye is the single point every light ray converges on.',
  },
  object: {
    label: 'object',
    def: 'The object — the real 3D thing being drawn. Every one of its corners is what gets projected onto the plane.',
  },
  plane: {
    label: 'projection plane',
    def: 'Projection plane — a flat, imaginary surface the object’s shadow is cast onto. An engineering drawing is just marks on a projection plane.',
  },
  projector: {
    label: 'projector',
    def: 'Projector — a straight line from a point on the object to its landing point on the plane. Every corner of the object gets its own projector.',
  },
  parallel: {
    label: 'parallel projection',
    def: 'Parallel projection — every projector points in the same direction, as if the light source were infinitely far away. This is what makes orthographic projection give a TRUE size, no matter how far the object sits from the plane.',
  },
  perspective: {
    label: 'perspective projection',
    def: 'Perspective projection — every ray converges on a single point (the observer’s eye), the way a camera or your own vision works. Near things look bigger, far things look smaller — great for realism, useless for exact measurement.',
  },
  perpendicular: {
    label: 'perpendicular',
    def: 'Perpendicular — meeting at exactly 90°. Orthographic projectors must strike the plane perpendicular to it, or the view they form is stretched out of true shape.',
  },
  orthographic: {
    label: 'orthographic projection',
    def: 'Orthographic projection — a drawing method where parallel projectors meet the plane at 90°. Because the rays never converge, every measurement on the resulting view is the object’s TRUE size.',
  },
  trueshape: {
    label: 'true shape',
    def: 'True shape — a view whose lengths and angles can be measured directly with a scale, exactly matching the real object. Only a perpendicular, parallel projection guarantees this.',
  },
  view: {
    label: 'view',
    def: 'View — the flat 2D picture formed on the plane once every projected point is connected up the same way the object’s edges connect.',
  },
});

/** Baseline viewport flags. simController.applyView() merges each step's `view`
 *  over this, so a step only declares what it turns ON. The geometry leaves
 *  read the merged result inside rebuild(). */
export const DEFAULT_VIEW = Object.freeze({
  showWedge: false,      // the object itself
  showObserver: false,   // Step 1: eye glyph + camera-following sight-lines
  showLabels: false,     // vertex letters A–F
  showPlane: false,      // the single projection plane
  showProjectors: false, // the projector ray bundle
  showAngle: false,      // the live "∠ …°" readout at the plane (Step 5+)
  showView: false,       // the formed 2D outline drawn on the plane
  rayModeControl: false, // Step 4 only: shows the parallel/perspective toggle
                         // AND permits currentData.rayMode to affect rendering
                         // (every other step forces PARALLEL regardless of it)
  tiltControl: false,    // Step 5 only: shows the projector-tilt slider
  rotationControl: false,// Step 6 only: shows the object-rotation slider
});

/** The guided sequence, in order — the 7-step introduction to orthographic projection. */
export const STEPS = Object.freeze([
  {
    id: 'observer',
    title: 'The Observer',
    lead: 'Every drawing begins with someone looking at something.',
    body: [
      'The solid floating here is what you are about to learn to draw. Right now you are looking at it the ordinary way: as an <button type="button" class="term" data-t="observer">observer</button>, with your eye acting like a camera. Notice the faint lines running from your own viewpoint to a few of its corners — those are sight lines, and they all meet at one point: you.',
      'Orbit around the solid. However you move, the sight lines keep converging on your eye. Keep that picture in mind — it is exactly what a later step will contrast against.',
    ],
    hint: 'A photograph works the same way: every ray of light that reaches the camera lens passes through one single point.',
    controls: [],
    view: { showWedge: true, showObserver: true },
    orbitHint: true,
  },
  {
    id: 'object',
    title: 'The Object',
    lead: 'Meet the solid you will be projecting.',
    body: [
      'This is the <button type="button" class="term" data-t="object">object</button> — a simple wedge with six corners, lettered A through F. Every one of these six points is what will eventually get projected onto a flat drawing.',
      'A real engineering drawing never shows the solid itself — only the flat marks its corners leave behind. So before that happens, take a moment to see the solid clearly and know its corners by name.',
    ],
    hint: 'Corners A, B, C sit on one triangular end; D, E, F sit directly opposite on the other end.',
    controls: [],
    view: { showWedge: true, showLabels: true },
  },
  {
    id: 'plane',
    title: 'The Projection Plane',
    lead: 'A drawing needs a flat surface to land on.',
    body: [
      'This grey sheet is the <button type="button" class="term" data-t="plane">projection plane</button> — an imaginary flat surface standing behind the object. Nothing is drawn yet; it is simply where the object’s shadow is about to be cast.',
      'Orbit around it. Confirm for yourself that it really is flat and stands still relative to the object — every projection in engineering drawing starts with a plane exactly like this one.',
    ],
    hint: 'Later lessons give this plane a specific name and role (a wall, a floor). For now it is simply "the plane" — the projection idea works the same on any flat surface.',
    controls: [],
    view: { showWedge: true, showLabels: true, showPlane: true },
  },
  {
    id: 'parallel',
    title: 'Parallel Projectors',
    lead: 'Cast a straight line from every corner to the plane — all pointing the same way.',
    body: [
      'Each thin line you now see is a <button type="button" class="term" data-t="projector">projector</button>: a straight path from one corner of the object to its landing point on the plane. Every projector here runs in exactly the same direction — this is called <button type="button" class="term" data-t="parallel">parallel projection</button>.',
      'Try the switch below. It swaps the parallel bundle for a <button type="button" class="term" data-t="perspective">perspective</button> bundle — the way a camera actually sees, with every ray converging on one eye point, just like Step 1. Watch how the landing points shift: perspective rays make near corners land farther apart than far corners. Parallel rays never do that — the object could sit right against the plane or a mile away, and its landing points would not change size at all.',
    ],
    hint: 'This is the whole reason engineers use parallel projectors: the resulting drawing does not care how far away the object is.',
    controls: ['rayMode'],
    view: { showWedge: true, showLabels: true, showPlane: true, showProjectors: true, rayModeControl: true },
  },
  {
    id: 'perpendicular',
    title: 'Perpendicular Projection',
    lead: 'The projectors must strike the plane at exactly 90°.',
    body: [
      'Look at the small right-angle mark where a projector meets the plane. Right now every projector is <button type="button" class="term" data-t="perpendicular">perpendicular</button> to the plane — it strikes it at 90°. This is what makes the result <button type="button" class="term" data-t="orthographic">orthographic</button> projection specifically, not just any parallel projection.',
      'Drag the angle slider below away from 90°. The projectors tilt, and the landing points slide sideways — the resulting outline stretches and skews out of shape. Put the angle back to 90° and it snaps back to the object’s <button type="button" class="term" data-t="trueshape">true shape</button>. That is why perpendicularity is non-negotiable: it is the only angle where every length on the drawing can be trusted as a real measurement.',
    ],
    hint: 'An architect’s "oblique" sketch deliberately uses a tilted, non-perpendicular projection for a pictorial effect — it looks nice, but you could never take exact measurements off it.',
    controls: ['tilt'],
    view: { showWedge: true, showLabels: true, showPlane: true, showProjectors: true, showAngle: true, tiltControl: true },
  },
  {
    id: 'formation',
    title: 'Formation of the View',
    lead: 'Connect the landing points the same way the object’s edges connect, and the view appears.',
    body: [
      'Every corner now has a landing point on the plane. Join the landing points the same way A connects to B, B to C, and so on around the solid, and the outline traces itself — this flat outline is the <button type="button" class="term" data-t="view">view</button>.',
      'Drag the rotation slider to turn the object. Watch the view redraw itself in real time: a different orientation genuinely produces a different-shaped view, because you are always looking at the flat silhouette of whichever corners face the plane right now.',
      'When you are ready, use "Reveal the flat view" to fade the solid away entirely, leaving only its drawing on the plane — the moment a 3D object becomes a 2D engineering drawing.',
    ],
    hint: 'Nothing about the object changed — only its orientation. The view is always just the object’s current silhouette.',
    controls: ['rotation', 'dissolve'],
    view: { showWedge: true, showLabels: true, showPlane: true, showProjectors: true, showView: true, showAngle: true, rotationControl: true },
    done: (sim) => sim.hasDissolved(),
  },
  {
    id: 'why',
    title: 'Why Orthographic Projection?',
    lead: 'One flat drawing, and every length on it is trustworthy.',
    body: [
      'A photograph of this object would look impressive, but you could never lay a ruler on it and trust the result — perspective always distorts distance. The orthographic view you just built is the opposite: because its projectors are parallel and perpendicular, every length and angle on it matches the real object exactly.',
      'That single guarantee — a flat drawing an engineer can measure and trust — is why every technical drawing, from a machine part to a building, is built on orthographic projection. The next lessons (Quadrants, Points, Lines) build on exactly this idea, adding a second plane and a naming system, but the core trick never changes: parallel, perpendicular projectors turn a solid into a trustworthy flat drawing.',
    ],
    hint: 'You now understand orthographic projection itself — the framework every later Engineering Graphics lesson assumes you already have.',
    controls: [],
    view: { showWedge: true, showLabels: true, showPlane: true, showProjectors: true, showView: true, showAngle: true },
  },
]);

/** Convenience: total number of steps. */
export const STEP_COUNT = STEPS.length;
