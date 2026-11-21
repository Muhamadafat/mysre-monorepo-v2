import { safeSegment, userPrefix } from "./recordingKeys";

/**
 * Images pasted / dropped / picked in the draft editor are stored in the same
 * S3 bucket as the voice recordings:
 *
 *   <S3_PREFIX><userId>/<projectId>/IMAGE_UPLOAD/<uuid>.<ext>
 *
 * The browser gets /api/upload/file/<userId>/<projectId>/<uuid>.<ext>, which
 * streams the object back (the bucket itself stays private).
 */
export const IMAGE_FOLDER = "IMAGE_UPLOAD";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Allowed image types → file extension. No SVG: it can carry scripts. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const EXT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export function imageKey(prefix: string, userId: string, projectId: string | null, id: string, ext: string): string {
  return `${userPrefix(prefix, userId)}${safeSegment(projectId, "tanpa-project")}/${IMAGE_FOLDER}/${safeSegment(id, "img")}.${ext}`;
}

export function imageUrl(userId: string, projectId: string | null, id: string, ext: string): string {
  return `/api/upload/file/${safeSegment(userId, "user")}/${safeSegment(projectId, "tanpa-project")}/${safeSegment(id, "img")}.${ext}`;
}

/**
 * [userId, projectId, "<id>.<ext>"] from the URL → the S3 key and content
 * type, or null when anything looks off (no "..", only known extensions).
 */
export function keyFromImagePath(prefix: string, parts: string[]): { key: string; contentType: string } | null {
  if (parts.length !== 3) return null;
  const [userId, projectId, file] = parts;
  const segment = /^[a-zA-Z0-9_-]{1,40}$/;
  const match = file.match(/^([a-zA-Z0-9_-]{1,40})\.(png|jpg|gif|webp)$/);
  if (!segment.test(userId) || !segment.test(projectId) || !match) return null;
  return { key: imageKey(prefix, userId, projectId, match[1], match[2]), contentType: EXT_TYPES[match[2]] };
}
