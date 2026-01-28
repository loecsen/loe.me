const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const adminKey = process.env.ADMIN_TOKEN || '1';

const run = async () => {
  if (!process.env.ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
    console.warn('ADMIN_TOKEN missing in production; skipping admin save smoke test.');
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
  const original = payload.lexicon;
  const testRuleId = `smoke_save_${Date.now()}`;

  const updated = {
    ...original,
    global: [
      ...original.global,
      {
        id: testRuleId,
        reason_code: 'other',
        pattern: `smoke_save_${Date.now()}`,
        flags: 'i',
        severity: 'block',
      },
    ],
  };

  const saveRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}&action=save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    },
  );
  if (!saveRes.ok) {
    console.error('Failed to save lexicon', saveRes.status);
    process.exit(1);
  }

  const reloadRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}`,
  );
  if (!reloadRes.ok) {
    console.error('Failed to reload lexicon', reloadRes.status);
    process.exit(1);
  }
  const reloadPayload = await reloadRes.json();
  const found = reloadPayload.lexicon.global.some((rule) => rule.id === testRuleId);

  const restoreRes = await fetch(
    `${baseUrl}/api/admin/safety/lexicon?key=${encodeURIComponent(adminKey)}&action=save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(original),
    },
  );
  if (!restoreRes.ok) {
    console.error('Failed to restore lexicon', restoreRes.status);
    process.exit(1);
  }

  if (!found) {
    console.error('Expected saved rule to be present after reload.');
    process.exit(1);
  }

  console.log('Admin save and reload smoke test passed.');
};

run().catch((error) => {
  console.error('Admin save and reload smoke test failed:', error);
  process.exit(1);
});
