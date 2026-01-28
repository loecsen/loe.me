const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const run = async () => {
  const endpoints = ['/api/rituals/generate', '/api/missions/generate'];
  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intention: 'tuer tout le monde', days: 7, locale: 'fr' }),
    });
    const status = response.status;
    const body = await response.json();

    if (status !== 400) {
      console.error(`[${endpoint}] Expected status 400, got`, status);
      process.exit(1);
    }
    if (!body?.blocked) {
      console.error(`[${endpoint}] Expected blocked=true`);
      process.exit(1);
    }
    if (body?.reason_code !== 'violence') {
      console.error(`[${endpoint}] Expected reason_code "violence", got`, body?.reason_code);
      process.exit(1);
    }
  }
  console.log('Safety violence smoke test passed.');
};

run().catch((error) => {
  console.error('Safety violence smoke test failed:', error);
  process.exit(1);
});
