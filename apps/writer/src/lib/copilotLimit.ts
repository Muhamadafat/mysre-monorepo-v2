/**
 * Per-user request caps for the ghost-text autocomplete (/api/copilot),
 * which runs on the lecturer's key. The counters live in memory: they reset
 * when the server restarts, which is fine for a guard against runaway usage
 * (a stuck key, a script).
 *
 * `now` is injectable so the tests can move the clock instead of waiting.
 */
export type CopilotLimits = { perMinute: number; perDay: number };

export function createCopilotLimiter(limits: CopilotLimits, now: () => Date = () => new Date()) {
  const usage = new Map<string, { minuteStart: number; minuteCount: number; day: string; dayCount: number }>();

  /** Counts one request for the user; false when a cap is already reached. */
  return function allowRequest(userId: string): boolean {
    const date = now();
    const time = date.getTime();
    const day = date.toDateString();
    const entry = usage.get(userId);

    if (!entry || entry.day !== day) {
      usage.set(userId, { minuteStart: time, minuteCount: 1, day, dayCount: 1 });
      return true;
    }
    if (time - entry.minuteStart >= 60_000) {
      entry.minuteStart = time;
      entry.minuteCount = 0;
    }
    if (entry.minuteCount >= limits.perMinute || entry.dayCount >= limits.perDay) return false;

    entry.minuteCount++;
    entry.dayCount++;
    return true;
  };
}
