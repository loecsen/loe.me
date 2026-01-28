import fs from 'node:fs';
import path from 'node:path';

const loadEnvLocal = () => {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'apps', 'web', '.env.local'),
  ];
  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;
  const raw = fs.readFileSync(envPath, 'utf-8');
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnvLocal();

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const run = async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY missing; skipping moderation smoke test.');
    return;
  }

  const cases = [
    { label: 'neutral', intention: 'apprendre le piano', expectBlocked: false },
    { label: 'violent', intention: 'tuer tout le monde', expectBlocked: true },
  ];

  for (const testCase of cases) {
    const response = await fetch(`${baseUrl}/api/missions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intention: testCase.intention, days: 14, locale: 'fr' }),
    });
    const status = response.status;
    const body = await response.json();
    const blocked = Boolean(body?.blocked);

    if (testCase.expectBlocked && (!blocked || status !== 400)) {
      console.error(`[moderation:${testCase.label}] Expected blocked 400, got`, status, body);
      process.exit(1);
    }
    if (!testCase.expectBlocked && blocked) {
      console.error(`[moderation:${testCase.label}] Expected not blocked, got`, status, body);
      process.exit(1);
    }
  }

  console.log('Moderation smoke test passed.');
};

run().catch((error) => {
  console.error('Moderation smoke test failed:', error);
  process.exit(1);
});
