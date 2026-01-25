import { NextResponse } from 'next/server';
import { getLocaleFromAcceptLanguage, normalizeLocale } from '../../../lib/i18n';

type ProposalState = 'realistic' | 'ambitious';

const summaryByLocale: Record<string, string> = {
  en: 'A gentle, clear, and steady ritual.',
  fr: 'Un rituel doux, clair et régulier.',
  es: 'Un ritual suave, claro y constante.',
  de: 'Ein sanftes, klares und regelmäßiges Ritual.',
  it: 'Un rituale dolce, chiaro e regolare.',
};

const suggestionByLocale: Record<string, string> = {
  en: 'Extend the duration to 14 days for a calmer pace.',
  fr: 'Allonger la durée à 14 jours pour un rythme plus apaisé.',
  es: 'Amplía la duración a 14 días para un ritmo más tranquilo.',
  de: 'Verlängere auf 14 Tage für ein ruhigeres Tempo.',
  it: 'Allunga la durata a 14 giorni per un ritmo più calmo.',
};

function createMockProposal(intention: string, days: number, locale: string) {
  const levels = days <= 14 ? 2 : days <= 30 ? 3 : 4;
  const rhythm =
    locale === 'fr'
      ? days <= 14
        ? '3 missions / semaine'
        : '2 missions / semaine'
      : locale === 'es'
        ? days <= 14
          ? '3 misiones / semana'
          : '2 misiones / semana'
        : locale === 'de'
          ? days <= 14
            ? '3 Missionen / Woche'
            : '2 Missionen / Woche'
          : locale === 'it'
            ? days <= 14
              ? '3 missioni / settimana'
              : '2 missioni / settimana'
            : days <= 14
              ? '3 missions / week'
              : '2 missions / week';
  const duration =
    locale === 'fr'
      ? `${days} jours`
      : locale === 'es'
        ? `${days} días`
        : locale === 'de'
          ? `${days} Tage`
          : locale === 'it'
            ? `${days} giorni`
            : `${days} days`;
  const trimmed = intention.trim();
  const baseSummary = trimmed
    ? locale === 'fr'
      ? `Un rituel doux pour avancer vers "${trimmed}".`
      : locale === 'es'
        ? `Un ritual suave para avanzar hacia "${trimmed}".`
        : locale === 'de'
          ? `Ein sanftes Ritual, um auf "${trimmed}" hinzuarbeiten.`
          : locale === 'it'
            ? `Un rituale dolce per avanzare verso "${trimmed}".`
            : `A gentle ritual to move toward "${trimmed}".`
    : summaryByLocale[locale] ?? summaryByLocale.en;

  let state: ProposalState = 'realistic';
  let suggestion: string | undefined;

  if (days <= 7) {
    state = 'ambitious';
    suggestion = suggestionByLocale[locale] ?? suggestionByLocale.en;
  }

  return {
    levels,
    rhythm,
    duration,
    state,
    summary: baseSummary,
    suggestion,
  };
}

export async function POST(request: Request) {
  const { intention, days, locale } = (await request.json()) as {
    intention: string;
    days: number;
    locale?: string;
  };

  const headerLocale = getLocaleFromAcceptLanguage(request.headers.get('accept-language'));
  const resolvedLocale = normalizeLocale(locale ?? headerLocale);
  const proposal = createMockProposal(intention, days, resolvedLocale);
  return NextResponse.json({ data: proposal });
}
