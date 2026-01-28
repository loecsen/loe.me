/**
 * Design tokens — source of truth: tokens.json
 * Exported for TS usage; CSS variables are in styles.css (synced with this structure).
 */
import raw from './tokens.json';

export type Tokens = typeof raw;

export const tokens: Tokens = raw;

export const colors = raw.colors;
export const spacing = raw.spacing;
export const radius = raw.radius;
export const shadows = raw.shadows;
export const typography = raw.typography;
