import { NextResponse } from 'next/server';
import { loadCommunityRitualsByLocale, groupByCategory } from '../../lib/communityRituals/loadSeed';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ui_locale = searchParams.get('ui_locale') ?? 'en';
  const rituals = await loadCommunityRitualsByLocale(ui_locale);
  const byCategory = groupByCategory(rituals);
  const categories = Array.from(byCategory.entries()).map(([category, items]) => ({
    category,
    items,
  }));
  return NextResponse.json({ rituals, categories });
}
