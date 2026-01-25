const inflight = new Map<string, Promise<{ imageUrl: string | null; imageDataUrl: string | null } | null>>();

export function getInFlight(key: string) {
  return inflight.get(key);
}

export function setInFlight(
  key: string,
  promise: Promise<{ imageUrl: string | null; imageDataUrl: string | null } | null>,
) {
  inflight.set(key, promise);
}

export function clearInFlight(key: string) {
  inflight.delete(key);
}

