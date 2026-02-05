/**
 * Prompt store for Decision Engine V2.
 * Published: lib/prompts/published/<name>.json
 * Drafts (dev-only): PourLaMaquette/prompts-drafts/<name>.json
 */

import path from 'node:path';
import fs from 'node:fs';

export type PromptEntry = {
  name: string;
  version: string;
  purpose_en: string;
  token_budget_target?: number;
  safety_notes_en?: string;
  system?: string;
  user_template: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
};

function getAppRoot(): string {
  const cwd = typeof process !== 'undefined' ? process.cwd() : '';
  const fromWeb = path.join(cwd, 'app');
  const fromRoot = path.join(cwd, 'apps', 'web', 'app');
  if (typeof fs !== 'undefined' && fs.existsSync(path.join(cwd, 'app'))) return fromWeb;
  return fromRoot;
}

function getPublishedDir(): string {
  return path.join(getAppRoot(), 'lib', 'prompts', 'published');
}

function getDraftsDir(): string {
  return path.join(getAppRoot(), 'PourLaMaquette', 'prompts-drafts');
}

function readJsonFile(filePath: string): PromptEntry | null {
  try {
    if (typeof fs === 'undefined' || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as PromptEntry;
  } catch {
    return null;
  }
}

/**
 * Load published prompt by name (no extension).
 * Reads lib/prompts/published/<name>.json
 */
export function loadPublishedPrompt(name: string): PromptEntry | null {
  const filePath = path.join(getPublishedDir(), `${name}.json`);
  return readJsonFile(filePath);
}

/**
 * Load draft prompt by name (dev-only).
 * Reads PourLaMaquette/prompts-drafts/<name>.json
 */
export function loadDraftPrompt(name: string): PromptEntry | null {
  const filePath = path.join(getDraftsDir(), `${name}.json`);
  return readJsonFile(filePath);
}

/**
 * Get prompt: published preferred; if allowDraft and no published, use draft.
 */
export function getPrompt(name: string, options?: { allowDraft?: boolean }): PromptEntry | null {
  const published = loadPublishedPrompt(name);
  if (published?.user_template) return published;
  if (options?.allowDraft) return loadDraftPrompt(name);
  return published ?? null;
}

/** List published prompt names (no extension). */
export function listPublishedPromptNames(): string[] {
  const dir = getPublishedDir();
  if (typeof fs === 'undefined' || !fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/** List draft prompt names (dev-only). */
export function listDraftPromptNames(): string[] {
  const dir = getDraftsDir();
  if (typeof fs === 'undefined' || !fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/** Write draft prompt (dev-only). Creates drafts dir if needed. */
export function writeDraftPrompt(name: string, entry: PromptEntry): void {
  const dir = getDraftsDir();
  if (typeof fs === 'undefined') return;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  } catch {
    throw new Error(`Failed to write draft prompt: ${name}`);
  }
}

/** Write published prompt (dev-only). Single source: lib/prompts/published/<name>.json. */
export function writePublishedPrompt(name: string, entry: PromptEntry): void {
  const dir = getPublishedDir();
  if (typeof fs === 'undefined') return;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  } catch {
    throw new Error(`Failed to write published prompt: ${name}`);
  }
}

/** Known prompt names for pipeline (single source: published JSON, no duplicates). */
export const KNOWN_PROMPT_NAMES = [
  'actionability_classifier_v1',
  'controllability_check_v1',
  'equivalence_judge_v1',
  'safety_judge_v1',
  'intent_reformulation_v1',
  'intent_reformulation_v2',
  'objectives_preview_v1',
  'clarify_chips_v1',
  'idea_routines_generator_v1',
  'category_router_v1',
  'tone_aspiration_v1',
  'realism_judge_v1',
  'category_analysis_v1_LEARN',
  'category_analysis_v1_CREATE',
  'category_analysis_v1_PERFORM',
  'category_analysis_v1_WELLBEING',
  'category_analysis_v1_SOCIAL',
  'category_analysis_v1_CHALLENGE',
  'audience_safety_classifier_v1',
  'tone_classifier_v1',
] as const;
