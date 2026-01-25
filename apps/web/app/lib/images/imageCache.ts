export const IMAGE_CACHE_PREFIX = 'loe_img_';

export function buildImageCacheKey(
  style: { id: string; version: number },
  imageKey: string,
) {
  return `${IMAGE_CACHE_PREFIX}${style.id}_v${style.version}_${imageKey}`;
}

export function getCachedImage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(`${IMAGE_CACHE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function findCachedImageByKey(imageKey: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const keys = Object.keys(window.localStorage);
    const suffix = `_${imageKey}`;
    for (const key of keys) {
      if (key.startsWith(IMAGE_CACHE_PREFIX) && key.endsWith(suffix)) {
        const value = window.localStorage.getItem(key);
        if (value) {
          return value;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function setCachedImage(key: string, dataUrl: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(`${IMAGE_CACHE_PREFIX}${key}`, dataUrl);
  } catch {
    // ignore storage errors
  }
}

export function removeCachedImage(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(`${IMAGE_CACHE_PREFIX}${key}`);
  } catch {
    // ignore storage errors
  }
}

export function clearImageCache(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (key.startsWith('loe_img_')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}

