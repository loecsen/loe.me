# Dev note: Category-first filtering pipeline

**Goal:** Make CATEGORY a first-class concept, improve actionability/suggestions (multilingual), add realism soft-check only for LEARN/CREATE/WELLBEING, keep inline UX and Debug panel.

---

## 1. Where to implement (existing code audit)

| Area | File(s) | Key functions / changes |
|------|---------|-------------------------|
| **Category enum + types** | `apps/web/app/lib/actionability/types.ts` (or new `lib/category.ts`) | Add `Category` enum: LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE. Export for classify + missions + RitualRecord. |
| **Actionability gate** | `apps/web/app/lib/actionability.ts` | `runActionabilityV2`: optionally infer/return `category` in result or debug. `getDisplayLanguage`: improve Latin script (diacritics, FR/ES/EN hints); fallback uiLocale when uncertain. |
| **Classify API** | `apps/web/app/api/actionability/classify/route.ts` | Return `verdict: ACTIONABLE \| NEEDS_REPHRASE_INLINE \| BLOCKED`, `category`, use LLM `suggested_rephrase` when safe; post-filter normalized_intent + suggested_rephrase with lexicon → BLOCKED if trigger. Optional realism mini-check when category ∈ {LEARN, CREATE, WELLBEING} and ambition markers. |
| **Classifier prompt** | `apps/web/app/lib/prompts/actionabilityClassifier.ts` | Extend schema: `category`, `suggested_rephrase` (now used; same language as intent). Instruct LLM to output natural rephrase in intent language (no fixed "14 days" boilerplate). |
| **Suggestion safety** | `apps/web/app/lib/actionability/suggestion.ts` | Keep `shouldSuggestRephraseSync` and BLOCKED_SUBSTRINGS. Add `isSafeRephrase(text)` using same block list for post-filter. Optional: `buildSuggestionFromTemplate(displayLang, intent, timeframe_days)` if we keep fallback template. |
| **Missions generate** | `apps/web/app/api/missions/generate/route.ts` | Accept optional `category` in body; pass to plan/domain hint; push trace `category_gate` (meta.category); if category in {LEARN, CREATE, WELLBEING} and realism triggered, push `realism_gate_v2_soft`. Persist `category` in response so client can store in RitualRecord. |
| **RitualRecord / index** | `apps/web/app/lib/rituals/inProgress.ts` | Add `category?: Category` to `RitualIndexItem` and `RitualRecord`. |
| **Home UI** | `apps/web/app/page.tsx` | Handle BLOCKED (message "Nous ne pouvons…", no suggestion). Realism soft-check: when classify returns category ∈ {LEARN, CREATE, WELLBEING} and realism=unrealistic, show inline message + "Garder quand même" / "Ajuster" (apply adjustment then proceed). Store `debugTrace` in PENDING_RESULT and pass to mission page so it can persist to RitualRecord. |
| **Mission page** | `apps/web/app/mission/page.tsx` | When building record from PENDING_RESULT, include `debugTrace` and `category` from payload into RitualRecord / index item. |
| **Ritual [id] page** | `apps/web/app/ritual/[id]/page.tsx` | Persist `category` when updating record; ensure debugTrace (from generate response) is stored in record.debugMeta or equivalent for Debug panel. |
| **Debug panel** | `apps/web/app/components/DebugDecisionPanel.tsx` | Show `category` and realism outcome in trace (already shows gate/outcome/reason_code; ensure meta.category and realism_gate_v2_soft appear). |

---

## 2. Exact code edit plan

### Commit 1 — feat(category): add category types + trace plumbing

- **New or extend:** `apps/web/app/lib/actionability/types.ts` or `apps/web/app/lib/category.ts`
  - Export `Category` enum (LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE).
  - Export `CATEGORIES_REQUIRING_FEASIBILITY: Category[]` = [LEARN, CREATE, WELLBEING].
- **Extend:** `apps/web/app/lib/rituals/inProgress.ts`
  - Add `category?: string` (or `Category`) to `RitualIndexItem` and `RitualRecord`.
- **Extend:** `apps/web/app/lib/actionability/types.ts`
  - Add `category?: string` to `ActionabilityGateResult` debug or top-level if needed for trace.
- No UI yet; only types and ritual storage shape.

### Commit 2 — feat(classify): smarter rephrase + language + safety post-filter

- **Extend:** `apps/web/app/lib/prompts/actionabilityClassifier.ts`
  - Schema: add `category` (one of the 6). Change instruction: `suggested_rephrase` must be natural, same language as intent, no mandatory "in 14 days" unless user said it.
  - Parse `category` in `parseClassifierResponse`; validate against enum.
- **Extend:** `apps/web/app/lib/actionability/suggestion.ts`
  - Add `isSafeRephrase(text: string): boolean` (reuse BLOCKED_SUBSTRINGS + normalized check). Export for classify route.
- **Change:** `apps/web/app/api/actionability/classify/route.ts`
  - When lexicon blocks intent: return `verdict: 'BLOCKED'`, reason_code, suggested_rephrase: null.
  - After parsing LLM response: run lexicon guard on `parsed.normalized_intent` and `parsed.suggested_rephrase`; if either blocked → return BLOCKED, suggested_rephrase: null.
  - Use LLM `suggested_rephrase` when non-null and `isSafeRephrase(parsed.suggested_rephrase)`; else fallback to template only if we keep it, or null.
  - Return `category` in response.
- **Extend:** `apps/web/app/lib/actionability.ts`
  - Improve `getDisplayLanguage`: for Latin script, simple heuristics (e.g. common FR/ES words, diacritics); else fallback uiLocale.

### Commit 3 — feat(home): inline realism soft-check + keep/adjust UI

- **Extend:** Classify API (or separate mini-call) to optionally return realism: `realism?: { status: 'ok'|'stretch'|'unrealistic', why_short?: string, adjustments?: Array<{type, normalized_intent?, days?}> }` when category ∈ {LEARN, CREATE, WELLBEING} and ambition markers present. Prefer deterministic first (keywords + short timeframe); tiny LLM only if in doubt.
- **Change:** `apps/web/app/page.tsx`
  - If classify returns BLOCKED → set message to safetyInlineMessage ("Nous ne pouvons…"), no suggestion.
  - If classify returns NEEDS_REPHRASE_INLINE → message + suggested_rephrase (click to fill).
  - If classify returns ACTIONABLE and realism=unrealistic with adjustments → show inline realism message ("Ça risque d'être trop ambitieux…") + buttons "Garder quand même" / "Ajuster" (on Ajuster: apply first adjustment then call missions/generate).
  - Pass `category` and `debugTrace` in PENDING_REQUEST / PENDING_RESULT so mission page can persist them.
- **i18n:** Add keys for realism message and buttons (FR/EN at least).

### Commit 4 — feat(missions): accept category + persist + trace

- **Change:** `apps/web/app/api/missions/generate/route.ts`
  - Read optional `category` from body; push trace event `category_gate` with meta.category.
  - If category ∈ {LEARN, CREATE, WELLBEING} and existing realism gate triggers, push `realism_gate_v2_soft` with reason_code and meta.
  - Include `category` in response payload so client can store it.
- **Change:** `apps/web/app/mission/page.tsx`
  - When building record from PENDING_RESULT, set `record.category` and `record.debugMeta.debugTrace` (or equivalent) from payload.
- **Change:** `apps/web/app/ritual/[id]/page.tsx`
  - When receiving generate response, persist `category` and debug trace into record.

### Commit 5 — test: actionability + classify edge cases

- **Extend:** `apps/web/app/lib/actionability.test.ts`
  - Cases: pizza (NOT_ACTIONABLE_INLINE), faire pizza (ACTIONABLE or BORDERLINE→ACTIONABLE), manger pizza (BORDERLINE, better suggestion), apprendre chinois A2 90 jours (ACTIONABLE, LEARN), 你好 (NOT_ACTIONABLE_INLINE), 学习中文A2 90天 (ACTIONABLE, LEARN), "petite bite" (BLOCKED / safety_no_suggestion, no suggestion). Mock or unit-only; no network.

### Commit 6 (optional) — debug: persist trace from Home flow

- **Change:** Home: when storing PENDING_RESULT, include `debugTrace` from missions/generate response (or from classify if we store that too).
- **Change:** Mission page: when building RitualRecord from PENDING_RESULT, set `debugMeta.debugTrace` so ritual/[id] can show it in Debug panel.

---

## 3. File list (impacted)

- `apps/web/app/lib/actionability/types.ts` — reason_codes, GateResult, optional category
- `apps/web/app/lib/category.ts` — NEW: Category enum, CATEGORIES_REQUIRING_FEASIBILITY
- `apps/web/app/lib/actionability.ts` — getDisplayLanguage improvement, optional category in result
- `apps/web/app/lib/actionability/suggestion.ts` — isSafeRephrase, optional template with timeframe_days
- `apps/web/app/api/actionability/classify/route.ts` — BLOCKED verdict, category, post-filter, use LLM rephrase when safe
- `apps/web/app/lib/prompts/actionabilityClassifier.ts` — category in schema, suggested_rephrase instruction
- `apps/web/app/api/missions/generate/route.ts` — accept category, trace category_gate + realism_gate_v2_soft, return category
- `apps/web/app/lib/rituals/inProgress.ts` — category on RitualIndexItem + RitualRecord
- `apps/web/app/page.tsx` — BLOCKED handling, realism UI (message + Garder/Ajuster), pass category + debugTrace
- `apps/web/app/mission/page.tsx` — persist category + debugTrace from PENDING_RESULT into record
- `apps/web/app/ritual/[id]/page.tsx` — persist category; ensure debugTrace in record for Debug panel
- `apps/web/app/components/DebugDecisionPanel.tsx` — display category + realism in trace (structure already supports meta)
- `apps/web/app/lib/i18n.ts` — realism copy, BLOCKED message if not already
- `apps/web/app/lib/actionability.test.ts` — new/updated test cases
