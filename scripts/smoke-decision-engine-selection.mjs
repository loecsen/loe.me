#!/usr/bin/env node
/**
 * Smoke: Decision engine selection on Home.
 * - Sans flags → moteur = V2 (USE_V2 true).
 * - FORCE_LEGACY=1 → moteur = legacy (USE_V2 false).
 * - FORCE_V2=1 → moteur = V2 (USE_V2 true).
 * - isRenderableDecisionResult: V2 outcomes renderable vs non-renderable (fallback only when non-renderable).
 * No server: tests selection and renderability logic in isolation.
 */

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// Mirror Home selection logic (page.tsx): V2 by default, overrides FORCE_LEGACY / FORCE_V2
function getUseV2(env = process.env) {
  if (env.NEXT_PUBLIC_FORCE_LEGACY === '1') return false;
  if (env.NEXT_PUBLIC_FORCE_V2 === '1') return true;
  return true; // default V2
}

// Mirror isRenderableDecisionResult (page.tsx): at least one UI output
function isRenderableDecisionResult(result) {
  if (!result || typeof result.outcome !== 'string') return false;
  const o = result.outcome;
  if (
    o === 'BLOCKED_SAFETY' ||
    o === 'PROCEED_TO_GENERATE' ||
    o === 'ASK_CLARIFICATION' ||
    o === 'CONFIRM_AMBITION' ||
    o === 'ASK_USER_CHOOSE_CATEGORY' ||
    o === 'REALISM_ADJUST'
  )
    return true;
  if (o === 'SHOW_ANGLES') return ((result.payload?.angles ?? [])?.length ?? 0) >= 1;
  return false;
}

// 1) Sans flags → moteur = V2
const useV2NoFlags = getUseV2({});
assert(useV2NoFlags === true, 'Sans flags → USE_V2 doit être true (moteur V2)');
console.log('  ✓ Sans flags → moteur = V2');

// 2) FORCE_LEGACY=1 → moteur = legacy
const useV2ForceLegacy = getUseV2({ NEXT_PUBLIC_FORCE_LEGACY: '1' });
assert(useV2ForceLegacy === false, 'FORCE_LEGACY=1 → USE_V2 doit être false (moteur legacy)');
console.log('  ✓ FORCE_LEGACY=1 → moteur = legacy');

// 3) FORCE_V2=1 → moteur = V2
const useV2ForceV2 = getUseV2({ NEXT_PUBLIC_FORCE_V2: '1' });
assert(useV2ForceV2 === true, 'FORCE_V2=1 → USE_V2 doit être true');
console.log('  ✓ FORCE_V2=1 → moteur = V2');

// 4) V2 non-renderable → fallback (isRenderable = false)
assert(isRenderableDecisionResult(null) === false, 'null → non renderable');
assert(isRenderableDecisionResult({}) === false, '{} → non renderable');
assert(isRenderableDecisionResult({ outcome: 'UNKNOWN' }) === false, 'outcome inconnu → non renderable');
assert(
  isRenderableDecisionResult({ outcome: 'SHOW_ANGLES', payload: {} }) === false,
  'SHOW_ANGLES sans angles → non renderable'
);
assert(
  isRenderableDecisionResult({ outcome: 'SHOW_ANGLES', payload: { angles: [] } }) === false,
  'SHOW_ANGLES angles[] → non renderable'
);
console.log('  ✓ V2 non-renderable (null, unknown, SHOW_ANGLES sans angles) → fallback attendu');

// 5) V2 renderable → pas de fallback
assert(isRenderableDecisionResult({ outcome: 'BLOCKED_SAFETY' }) === true, 'BLOCKED_SAFETY → renderable');
assert(isRenderableDecisionResult({ outcome: 'PROCEED_TO_GENERATE', payload: {} }) === true, 'PROCEED_TO_GENERATE → renderable');
assert(isRenderableDecisionResult({ outcome: 'ASK_CLARIFICATION', payload: {} }) === true, 'ASK_CLARIFICATION → renderable');
assert(isRenderableDecisionResult({ outcome: 'CONFIRM_AMBITION', payload: {} }) === true, 'CONFIRM_AMBITION → renderable');
assert(isRenderableDecisionResult({ outcome: 'ASK_USER_CHOOSE_CATEGORY', payload: {} }) === true, 'ASK_USER_CHOOSE_CATEGORY → renderable');
assert(isRenderableDecisionResult({ outcome: 'REALISM_ADJUST', payload: {} }) === true, 'REALISM_ADJUST → renderable');
assert(
  isRenderableDecisionResult({ outcome: 'SHOW_ANGLES', payload: { angles: [{ label: 'x', next_intent: 'y' }] } }) === true,
  'SHOW_ANGLES avec angles ≥1 → renderable'
);
console.log('  ✓ V2 renderable (blocked, clarification, angles, ambition, realism, proceed) → pas de fallback');

console.log('\nSmoke decision engine selection: all passed.');
