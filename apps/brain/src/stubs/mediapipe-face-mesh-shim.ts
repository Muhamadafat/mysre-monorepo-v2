// @mediapipe/face_mesh ships as a legacy global-script bundle (an IIFE that
// attaches `FaceMesh` etc. to `globalThis`), not a real ES/CJS module — it has
// no `export`/`module.exports` at all. Bundlers can't resolve a named
// `FaceMesh` import from it directly, so this shim runs the script for its
// side effect (populating globalThis) and re-exports what callers need.
// See apps/brain/next.config.ts `turbopack.resolveAlias` / `webpack()`.
// Relative path (not the bare specifier) so this import isn't caught by the
// `@mediapipe/face_mesh` alias that points here in the first place.
import '../../../../node_modules/@mediapipe/face_mesh/face_mesh.js';

declare const globalThis: any;

export const FaceMesh = globalThis.FaceMesh;
export const FACEMESH_TESSELATION = globalThis.FACEMESH_TESSELATION;
export const FACEMESH_RIGHT_EYE = globalThis.FACEMESH_RIGHT_EYE;
export const FACEMESH_LEFT_EYE = globalThis.FACEMESH_LEFT_EYE;
export const FACEMESH_FACE_OVAL = globalThis.FACEMESH_FACE_OVAL;
export const FACEMESH_LIPS = globalThis.FACEMESH_LIPS;
export const VERSION = globalThis.VERSION;

export default globalThis;
