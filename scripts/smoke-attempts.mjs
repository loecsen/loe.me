const base = process.env.BASE_URL ?? 'http://localhost:3001';

async function post(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function run() {
  const gen = await post(`${base}/api/missions/generate`, {
    intention: 'Greek A1 in 14 days',
    days: 14,
    locale: 'fr',
  });
  if (!gen.json?.data) {
    console.error('generate failed', gen.status, gen.text.slice(0, 400));
    process.exit(1);
  }
  const data = gen.json.data;
  const stub1 = data.missionStubs?.[0];
  const stub2 = data.missionStubs?.[1];
  if (!stub1 || !stub2) {
    console.error('missing stubs');
    process.exit(1);
  }

  const fail = await post(`${base}/api/missions/progress`, {
    ritualId: data.ritualId,
    missionId: stub1.id,
    stepId: stub1.stepId,
    outcome: 'fail',
  });
  if (!fail.json?.ok) {
    console.error('progress fail failed', fail.status, fail.text.slice(0, 400));
    process.exit(1);
  }

  const retry = await post(`${base}/api/missions/next`, {
    ritualId: data.ritualId,
    stepId: stub1.stepId,
    mode: 'auto',
    requestedStepId: stub1.stepId,
  });
  const retryMission = retry.json?.data?.mission;
  if (!retryMission || retryMission.stepId !== stub1.stepId || !retryMission.id.includes('__a')) {
    console.error('retry mission not attempt', retry.status, retry.text.slice(0, 400));
    process.exit(1);
  }

  const success = await post(`${base}/api/missions/progress`, {
    ritualId: data.ritualId,
    missionId: retryMission.id,
    stepId: retryMission.stepId,
    outcome: 'success',
  });
  if (!success.json?.ok) {
    console.error('progress success failed', success.status, success.text.slice(0, 400));
    process.exit(1);
  }

  const next = await post(`${base}/api/missions/next`, {
    ritualId: data.ritualId,
    stepId: stub2.stepId,
    mode: 'auto',
    requestedStepId: stub2.stepId,
  });
  const nextMission = next.json?.data?.mission;
  if (!nextMission || nextMission.stepId !== stub2.stepId) {
    console.error('next step not reached', next.status, next.text.slice(0, 400));
    process.exit(1);
  }

  console.log('OK', {
    ritualId: data.ritualId,
    attemptMissionId: retryMission.id,
    nextMissionId: nextMission.id,
  });
}

run().catch((error) => {
  console.error('smoke failed', error);
  process.exit(1);
});
