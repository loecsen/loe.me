const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const run = async () => {
  const response = await fetch(`${baseUrl}/api/missions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intention: "je t'aime", days: 14, locale: 'fr' }),
  });
  const status = response.status;
  const body = await response.json();

  if (status >= 500) {
    console.error('Expected non-5xx response, got', status);
    process.exit(1);
  }

  const debugExpected = process.env.DEBUG === '1' || process.env.NODE_ENV !== 'production';
  const debugTrace = body?.debugTrace ?? body?.data?.debugTrace;
  if (debugExpected && !debugTrace) {
    console.error('Expected debugTrace in response but none found');
    process.exit(1);
  }
  if (!debugExpected && debugTrace) {
    console.error('Expected no debugTrace in production without DEBUG=1');
    process.exit(1);
  }

  console.log('Debug trace smoke test passed.');
};

run().catch((error) => {
  console.error('Debug trace smoke test failed:', error);
  process.exit(1);
});
