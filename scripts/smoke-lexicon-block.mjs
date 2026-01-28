const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const adminKey = process.env.ADMIN_TOKEN || '1';

const run = async () => {
  if (!process.env.ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
    console.warn('ADMIN_TOKEN missing in production; skipping lexicon block smoke test.');
    return;
  }
  const lexiconRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}`,
  );
  if (!lexiconRes.ok) {
    console.error('Failed to load lexicon', lexiconRes.status);
    process.exit(1);
  }
  const original = await lexiconRes.json();
  const lexicon = original.lexicon;
  const testRuleId = `smoke_block_${Date.now()}`;
  const term = `qa_lexicon_block_${Date.now()}`;

  lexicon.global = [
    ...lexicon.global,
    {
      id: testRuleId,
      reason_code: 'other',
      pattern: term,
      flags: 'i',
      severity: 'block',
    },
  ];

  const saveRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}&action=save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lexicon),
    },
  );
  if (!saveRes.ok) {
    console.error('Failed to save lexicon', saveRes.status);
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/api/missions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intention: `apprendre ${term}`, days: 14, locale: 'fr' }),
  });
  const status = response.status;
  const body = await response.json();

  const restore = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}&action=save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(original.lexicon),
    },
  );
  if (!restore.ok) {
    console.error('Failed to restore lexicon', restore.status);
    process.exit(1);
  }

  if (status !== 400 || !body?.blocked) {
    console.error('Expected blocked response, got', status, body);
    process.exit(1);
  }
  if (body?.reason_code !== 'other') {
    console.error('Expected reason_code "other", got', body?.reason_code);
    process.exit(1);
  }

  console.log('Lexicon block smoke test passed.');
};

run().catch((error) => {
  console.error('Lexicon block smoke test failed:', error);
  process.exit(1);
});
