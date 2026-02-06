export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const buildShortId = (ritualId: string) =>
  ritualId.replace(/-/g, '').slice(0, 8);
