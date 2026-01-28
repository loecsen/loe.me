const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const adminKey = process.env.ADMIN_TOKEN || '1';

const run = async () => {
  if (!process.env.ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
    console.warn('ADMIN_TOKEN missing in production; skipping admin validate smoke test.');
    return;
  }
  const lexiconRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}`,
  );
  if (!lexiconRes.ok) {
    console.error('Failed to load lexicon', lexiconRes.status);
    process.exit(1);
  }
  const payload = await lexiconRes.json();
  const lexicon = payload.lexicon;
  if (!lexicon.global?.length) {
    console.error('Lexicon has no global rules to mutate');
    process.exit(1);
  }
  lexicon.global[0] = { ...lexicon.global[0], pattern: '[' };

  const response = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}&action=validate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lexicon),
    },
  );
  if (response.status !== 400) {
    console.error('Expected 400 for invalid regex, got', response.status);
    process.exit(1);
  }
  const body = await response.json();
  if (body?.error !== 'invalid_lexicon') {
    console.error('Expected invalid_lexicon error, got', body?.error);
    process.exit(1);
  }

  console.log('Admin validate invalid regex smoke test passed.');
};

run().catch((error) => {
  console.error('Admin validate invalid regex smoke test failed:', error);
  process.exit(1);
});
