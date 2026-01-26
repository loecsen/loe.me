const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const run = async () => {
  const response = await fetch(`${baseUrl}/api/missions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intention: 'tuer tout le monde', days: 7, locale: 'fr' }),
  });
  const status = response.status;
  const body = await response.json();

  if (status !== 403) {
    console.error('Expected status 403, got', status);
    process.exit(1);
  }
  if (body?.error !== 'blocked') {
    console.error('Expected error "blocked", got', body?.error);
    process.exit(1);
  }
  if (body?.reason_code !== 'violence') {
    console.error('Expected reason_code "violence", got', body?.reason_code);
    process.exit(1);
  }
  console.log('Safety violence smoke test passed.');
};

run().catch((error) => {
  console.error('Safety violence smoke test failed:', error);
  process.exit(1);
});
