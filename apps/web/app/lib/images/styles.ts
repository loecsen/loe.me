import registry from './styleRegistry.json';

export type ImageStyle = { id: string; version: number; prompt: string };

const registryStyles = registry.styles as ImageStyle[];

export const IMAGE_STYLES: Record<string, ImageStyle> = registryStyles.reduce(
  (acc, style) => {
    acc[style.id] = style;
    return acc;
  },
  {} as Record<string, ImageStyle>,
);

export const DEFAULT_IMAGE_STYLE_ID = registry.defaultStyleId;

export function getImageStyle(styleId?: string): ImageStyle {
  if (styleId && IMAGE_STYLES[styleId]) {
    return IMAGE_STYLES[styleId];
  }
  return IMAGE_STYLES[DEFAULT_IMAGE_STYLE_ID];
}

export function hasImageStyle(styleId?: string): boolean {
  return Boolean(styleId && IMAGE_STYLES[styleId]);
}

export function getImageStyleSnapshot(
  styleId?: string,
  version?: number,
  prompt?: string,
): ImageStyle {
  if (styleId && IMAGE_STYLES[styleId]) {
    return IMAGE_STYLES[styleId];
  }
  if (styleId) {
    return {
      id: styleId,
      version: typeof version === 'number' ? version : 1,
      prompt: typeof prompt === 'string' ? prompt : getImageStyle().prompt,
    };
  }
  return getImageStyle();
}
