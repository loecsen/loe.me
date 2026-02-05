/**
 * Dev DB root. All dev DB files live under PourLaMaquette/db.
 * Only lib/db and API routes use this; no business component imports PourLaMaquette.
 */

import path from 'node:path';
import fs from 'node:fs';

export function getDbRoot(): string {
  const cwd = typeof process !== 'undefined' ? process.cwd() : '';
  const fromWeb = path.join(cwd, 'app', 'PourLaMaquette', 'db');
  const fromRoot = path.join(cwd, 'apps', 'web', 'app', 'PourLaMaquette', 'db');
  if (typeof fs !== 'undefined' && fs.existsSync(path.join(cwd, 'app'))) return fromWeb;
  return fromRoot;
}

export function getDbTablesPath(): string {
  return path.join(getDbRoot(), 'tables');
}

export function getDbIndexesPath(): string {
  return path.join(getDbRoot(), 'indexes');
}

/** Community rituals seed dir (PourLaMaquette/community-rituals). */
export function getCommunityRitualsDir(): string {
  return path.join(path.dirname(getDbRoot()), 'community-rituals');
}
