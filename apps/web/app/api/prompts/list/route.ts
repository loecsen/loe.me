/**
 * List published and draft prompts (Decision Engine V2).
 * Dev-only. Reads from lib/prompts/store. Includes known_names for bootstrap UI.
 */

import { NextResponse } from 'next/server';
import {
  listPublishedPromptNames,
  listDraftPromptNames,
  loadPublishedPrompt,
  loadDraftPrompt,
  KNOWN_PROMPT_NAMES,
} from '../../../lib/prompts/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publishedNames = listPublishedPromptNames();
  const draftNames = listDraftPromptNames();
  const published = publishedNames
    .map((name) => loadPublishedPrompt(name))
    .filter((p): p is NonNullable<typeof p> => p != null);
  const drafts = draftNames
    .map((name) => loadDraftPrompt(name))
    .filter((p): p is NonNullable<typeof p> => p != null);
  return NextResponse.json({
    published,
    drafts,
    known_names: [...KNOWN_PROMPT_NAMES],
  });
}
