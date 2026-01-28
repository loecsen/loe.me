const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

const runCase = async (label, payload, expect) => {
  const response = await fetch(`${baseUrl}/api/missions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  const result = { status: response.status, data };
  const ok = expect(result);
  console.log(`\n[${label}]`, ok ? 'OK' : 'FAIL');
  console.log(JSON.stringify(result, null, 2));
  return ok;
};

const main = async () => {
  let allOk = true;
  allOk =
    (await runCase(
      'clarify-vague',
      { intention: 'réussir ma vie', days: 14, locale: 'fr' },
      (res) => res.status === 200 && res.data?.data?.needsClarification === true,
    )) && allOk;

  allOk =
    (await runCase(
      'skill-performance',
      { intention: 'apprendre guitare', days: 14, locale: 'fr' },
      (res) =>
        res.status === 200 &&
        (res.data?.data?.path?.domainId === 'skill_performance' ||
          res.data?.error === 'missing_api_key'),
    )) && allOk;

  allOk =
    (await runCase(
      'wellbeing-mind',
      { intention: 'méditer 10 min', days: 14, locale: 'fr' },
      (res) =>
        res.status === 200 &&
        (res.data?.data?.path?.domainId === 'wellbeing_mind' ||
          res.data?.error === 'missing_api_key'),
    )) && allOk;

  if (!allOk) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
