/**
 * Small in-process rate limiter.
 *
 * Baton runs as one long-lived Node process on Railway, so a Map is enough to
 * stop password guessing and signup floods. It is deliberately not a security
 * boundary for a multi-instance deployment; move it to Redis if that changes.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function consume(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function reset(key: string): void {
  buckets.delete(key);
}

// Keep the map from growing without bound in a long-running process.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000) as unknown as { unref?: () => void };
sweeper.unref?.();
