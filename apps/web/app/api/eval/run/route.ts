/**
 * Run evaluation scenario(s). Dev-only.
 * POST body: { scenario_id?: string, run_all?: boolean }
 * If run_all: run all scenarios and store. If scenario_id: run one.
 */

import { NextResponse } from 'next/server';
import { EVAL_SCENARIOS } from '../../../lib/eval/scenarios';
import { runEvalScenario } from '../../../lib/eval/runner';
import * as evalStore from '../../../lib/db/evalStore.file';

export const dynamic = 'force-dynamic';

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request) {
  const forbidden = devOnly();
  if (forbidden) return forbidden;

  try {
    const body = (await request.json()) as { scenario_id?: string; run_all?: boolean };
    const scenarioId = typeof body?.scenario_id === 'string' ? body.scenario_id.trim() : undefined;
    const runAll = body?.run_all === true;
    const baseUrl = typeof request.url === 'string' ? new URL(request.url).origin : '';

    if (runAll) {
      const results: { scenario_id: string; eval_run_id: string }[] = [];
      for (const scenario of EVAL_SCENARIOS) {
        const result = await runEvalScenario({ scenario, baseUrl });
        await evalStore.upsertEvalRun(result);
        results.push({ scenario_id: scenario.id, eval_run_id: result.eval_run_id });
      }
      return NextResponse.json({ ok: true, count: results.length, runs: results });
    }

    if (scenarioId) {
      const scenario = EVAL_SCENARIOS.find((s) => s.id === scenarioId);
      if (!scenario) {
        return NextResponse.json({ error: 'scenario not found', scenario_id: scenarioId }, { status: 404 });
      }
      const result = await runEvalScenario({ scenario, baseUrl });
      await evalStore.upsertEvalRun(result);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'provide scenario_id or run_all: true' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
