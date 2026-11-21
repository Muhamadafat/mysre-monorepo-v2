/**
 * PDFs uploaded through brain live on brain's origin
 * (http://brain.lvh.me:3001/uploads/...), which sends no CORS header, so
 * pdf.js in the writer (another origin) can't fetch them and the viewer
 * stays blank. Those URLs are loaded through the writer's own
 * /api/references/pdf instead. Anything else is returned unchanged.
 *
 * Only for LOADING the file: highlights/annotations still use the original
 * URL, because /api/annotation finds the article by Node.att_url.
 */
export function viewablePdfUrl(url: string): string {
  if (!url || url.startsWith("/") || typeof window === "undefined") return url;
  try {
    const parsed = new URL(url);
    if (parsed.origin === window.location.origin) return url;
    if (!parsed.pathname.startsWith("/uploads/")) return url;
    return `/api/references/pdf?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
