// citation-js only uses node-fetch/sync-fetch on the server; in the browser it
// switches to the native fetch/Headers at runtime (see @citation-js/core's
// isBrowser check). The static import still forces bundlers to resolve these
// Node-only packages for the client bundle, so we alias them to this no-op
// stub (see apps/brain/next.config.ts `turbopack.resolveAlias`).
function unavailable(): never {
  throw new Error('node-fetch/sync-fetch is not available in the browser');
}
unavailable.Headers = class {};

export default unavailable;
export const Headers = unavailable.Headers;
