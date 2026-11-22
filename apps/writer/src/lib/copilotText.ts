/**
 * The reply arrives a moment later; if the writer kept typing meanwhile, keep
 * only the part of the suggestion they have not typed yet, or drop it when
 * what they typed does not match it.
 */
export function reconcileCompletion(sent: string, now: string, completion: string): string | null {
  if (now === sent) return completion;
  if (!now.startsWith(sent)) return null;
  const typed = now.slice(sent.length);
  const squash = (t: string) => t.replace(/\s+/g, " ");
  const want = squash(completion.trimStart());
  const got = squash(typed.trimStart());
  if (!want.toLowerCase().startsWith(got.toLowerCase())) return null;
  const rest = want.slice(got.length);
  // Writer stopped mid-word: the rest continues that word, no extra space.
  return /\s$/.test(typed) ? rest.trimStart() : rest;
}
