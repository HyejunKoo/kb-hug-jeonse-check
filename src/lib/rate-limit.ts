// src/lib/rate-limit.ts — 서버 프로세스 내 메모리 기반 고정 윈도우 레이트리밋
// 서버리스 인스턴스가 여러 개면 인스턴스별로 따로 집계되어 완전한 전역 제한은 아니지만,
// 유료 외부 API(OCR 등) 호출을 무료 제공량 내로 억제하는 용도로는 충분하다.
interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

export interface RateLimitResult { ok: boolean; retryAfterSec: number }

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** 버킷이 과도하게 쌓이는 것(메모리 누수)을 막기 위해 만료된 항목을 정리 */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  buckets.forEach((b, k) => {
    if (now >= b.resetAt) buckets.delete(k);
  });
}
