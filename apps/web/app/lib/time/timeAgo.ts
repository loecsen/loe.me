const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
];

export const timeAgoFR = (value: string | null | undefined) => {
  if (!value) return 'il y a un instant';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'il y a un instant';
  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);
  const safeDiff = Math.max(diffSeconds, 1);
  for (const [unit, secondsInUnit] of units) {
    if (safeDiff >= secondsInUnit || unit === 'second') {
      const amount = Math.round(safeDiff / secondsInUnit);
      const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
      return rtf.format(-amount, unit);
    }
  }
  return 'il y a un instant';
};
