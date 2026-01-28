const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const run = async () => {
  const response = await fetch(`${baseUrl}/api/missions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intention: 'apprendre le piano', days: 14, locale: 'fr' }),
  });
  const status = response.status;
  const body = await response.json();

  if (status >= 400 && body?.blocked) {
    console.error('Expected non-blocked response, got', status, body);
    process.exit(1);
  }

  console.log('Lexicon ok smoke test passed.');
};

run().catch((error) => {
  console.error('Lexicon ok smoke test failed:', error);
  process.exit(1);
});
