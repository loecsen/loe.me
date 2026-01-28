import { buildImageCacheKey, getCachedImage, setCachedImage } from './imageCache';
import { clearInFlight, getInFlight, setInFlight } from './inflight';
import { getImageStyle } from './styles';

const cooldownByKey = new Map<string, number>();
let globalCooldownUntil = 0;
const COOLDOWN_MS = 60_000;

async function sha256(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildImageKey(missionId: string) {
  return sha256(`${missionId}`);
}

export async function buildPlanImageKey(intention: string) {
  return sha256(`${intention}`);
}

type ImageFetchResult = { imageUrl: string | null; imageDataUrl: string | null };

export async function requestMissionImage(
  key: string,
  prompt: string,
  size: '340x190' | '512x512' = '340x190',
  styleId?: string,
  meta?: { title?: string; summary?: string; userLang?: string; promptOverride?: string },
): Promise<ImageFetchResult | null> {
  const style = getImageStyle(styleId);
  const cacheKey = buildImageCacheKey(style, key);
  const now = Date.now();
  if (now < globalCooldownUntil) {
    return null;
  }
  const keyCooldown = cooldownByKey.get(cacheKey);
  if (keyCooldown && now < keyCooldown) {
    return null;
  }
  const cached = getCachedImage(cacheKey);
  if (cached) {
    return cached.startsWith('data:')
      ? { imageUrl: null, imageDataUrl: cached }
      : { imageUrl: cached, imageDataUrl: null };
  }
  const inflight = getInFlight(cacheKey);
  if (inflight) {
    return inflight;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          size,
          seedKey: key,
          styleId: style.id,
          title: meta?.title,
          summary: meta?.summary,
          userLang: meta?.userLang,
          promptOverride: meta?.promptOverride,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[images.generate] failed', response.status, errorText);
        if (response.status === 429) {
          const until = Date.now() + COOLDOWN_MS;
          globalCooldownUntil = Math.max(globalCooldownUntil, until);
          cooldownByKey.set(cacheKey, until);
        }
        return null;
      }
      const payload = await response.json();
      const imageUrl = payload?.imageUrl ?? null;
      const imageDataUrl = payload?.imageDataUrl ?? null;
      const resolved = imageDataUrl ?? imageUrl;
      if (resolved) {
        setCachedImage(cacheKey, resolved);
      }
      return { imageUrl, imageDataUrl };
    } catch {
      return null;
    } finally {
      clearInFlight(cacheKey);
    }
  })();

  setInFlight(cacheKey, fetchPromise);
  return fetchPromise;
}

export function getFreeQuota() {
  if (typeof window === 'undefined') {
    return 4;
  }
  const raw = window.localStorage.getItem('loe_plan_tier');
  if (raw === 'paid') {
    return Number.POSITIVE_INFINITY;
  }
  const envQuota = Number(process.env.NEXT_PUBLIC_OPENAI_IMAGE_MAX_PER_PLAN_FREE);
  return Number.isFinite(envQuota) && envQuota > 0 ? envQuota : 4;
}

