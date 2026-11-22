/**
 * Failed-login lockout per client (in memory, reset on restart): after
 * `maxFailures` wrong attempts inside `windowMs`, further attempts are refused
 * until the oldest of them leaves the window. A successful login clears it.
 */
export function createLoginThrottle({ maxFailures, windowMs }: { maxFailures: number; windowMs: number }) {
  const failures = new Map<string, number[]>();
  const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((t) => now - t < windowMs);

  return {
    /** Seconds until this client may try again, or 0 when it may try now. */
    retryAfter(key: string, now = Date.now()): number {
      const list = recent(key, now);
      if (list.length) failures.set(key, list);
      else failures.delete(key);
      if (list.length < maxFailures) return 0;
      return Math.ceil((list[0] + windowMs - now) / 1000);
    },
    fail(key: string, now = Date.now()) {
      const list = recent(key, now);
      list.push(now);
      failures.set(key, list);
      // Keep memory bounded if someone sprays from many addresses.
      if (failures.size > 10_000) failures.delete(failures.keys().next().value as string);
    },
    succeed(key: string) {
      failures.delete(key);
    },
  };
}
