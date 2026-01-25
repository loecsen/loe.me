import { DEFAULT_IMAGE_STYLE_ID } from './styles';

const STORAGE_KEY = 'loe_image_style_id';
export function getSelectedStyleId(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_IMAGE_STYLE_ID;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_IMAGE_STYLE_ID;
  } catch {
    return DEFAULT_IMAGE_STYLE_ID;
  }
}

export function setSelectedStyleId(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}
