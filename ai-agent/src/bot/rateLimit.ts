const WINDOW_MS = 60_000;
const MAX_MESSAGES = 12;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Rate limit sederhana in-memory: maksimum 12 pesan per menit per chat. */
export function isRateLimited(chatId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(chatId);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(chatId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_MESSAGES;
}

export function resetRateLimit(): void {
  buckets.clear();
}
