import path from 'node:path';
import { promises as fs } from 'node:fs';
import { appendNdjson, writeJsonAtomic, getDataPath } from '../storage/fsStore';
import { DOMAIN_PLAYBOOKS, type DomainPlaybook, type EffortType } from './registry';

export type DomainOverrides = {
  playbooks: DomainPlaybook[];
};

const overridesPath = getDataPath('domains', 'overrides.json');

export async function loadOverrides(): Promise<DomainOverrides> {
  try {
    const raw = await fs.readFile(overridesPath, 'utf-8');
    return JSON.parse(raw) as DomainOverrides;
  } catch {
    return { playbooks: [] };
  }
}

export function validatePlaybooks(playbooks: DomainPlaybook[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  playbooks.forEach((playbook) => {
    if (!playbook.id || ids.has(playbook.id)) {
      errors.push(`duplicate_or_missing_id:${playbook.id}`);
    }
    ids.add(playbook.id);
    if (!playbook.allowedEffortTypes || playbook.allowedEffortTypes.length === 0) {
      errors.push(`allowedEffortTypes_empty:${playbook.id}`);
    }
    const allowed = new Set(playbook.allowedEffortTypes);
    Object.keys(playbook.weights ?? {}).forEach((key) => {
      if (!allowed.has(key as EffortType)) {
        errors.push(`weights_outside_allowed:${playbook.id}:${key}`);
      }
    });
    if (playbook.resourcePolicy.maxResources < 0 || playbook.resourcePolicy.maxResources > 5) {
      errors.push(`maxResources_invalid:${playbook.id}`);
    }
  });
  return { ok: errors.length === 0, errors };
}

export function resolvePlaybooks(overrides: DomainOverrides) {
  const registry = DOMAIN_PLAYBOOKS;
  const overrideMap = new Map(overrides.playbooks.map((playbook) => [playbook.id, playbook]));
  const resolved = registry.map((playbook) => overrideMap.get(playbook.id) ?? playbook);
  return { registry, overrides, resolved };
}

export async function saveOverrides(overrides: DomainOverrides) {
  await writeJsonAtomic(overridesPath, overrides);
  await appendNdjson(getDataPath('index', 'domains.ndjson'), {
    action: 'save',
    savedAt: new Date().toISOString(),
    playbooksCount: overrides.playbooks.length,
  });
}

export async function resetOverrides() {
  await writeJsonAtomic(overridesPath, { playbooks: [] });
  await appendNdjson(getDataPath('index', 'domains.ndjson'), {
    action: 'reset',
    savedAt: new Date().toISOString(),
  });
}
