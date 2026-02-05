/**
 * Bootstrap stubs for draft prompts (Decision Engine V2).
 * Used by Admin Prompts "Create draft" when a prompt name has no published/draft yet.
 */

import type { PromptEntry } from './store';
import { KNOWN_PROMPT_NAMES } from './store';

const STUBS: Record<string, Omit<PromptEntry, 'name'>> = {
  equivalence_judge_v1: {
    version: '1.0.0',
    purpose_en: 'Decide if two intents are the same request for cache reuse. Used when similarity score is in [0.70, 0.90].',
    token_budget_target: 80,
    safety_notes_en: 'No user content in output; only boolean and reason.',
    system: 'You are a judge. Output valid JSON only.',
    user_template: 'Are these two user intents the same request? Intent A: {{intent_a}}. Intent B: {{intent_b}}. Reply with JSON: {"same_request": boolean, "confidence": 0-1, "reason_en": string}',
    input_schema: { intent_a: 'string', intent_b: 'string' },
    output_schema: { same_request: 'boolean', confidence: 'number', reason_en: 'string' },
  },
  safety_judge_v1: {
    version: '1.0.0',
    purpose_en: 'Decide if user intent is safe to show suggestions. Used when deterministic hard-block is uncertain.',
    token_budget_target: 100,
    safety_notes_en: 'Output verdict only; no user content in response.',
    system: 'You are a safety judge. Output valid JSON only. Verdict: allow, block, or uncertain.',
    user_template: 'Is this user intent safe to suggest actionable goals? Intent: "{{intent}}". Reply with JSON: {"verdict": "allow"|"block"|"uncertain", "reason_code": string, "rationale_en": string}',
    input_schema: { intent: 'string' },
    output_schema: { verdict: 'string', reason_code: 'string', rationale_en: 'string' },
  },
  category_router_v1: {
    version: '1.0.0',
    purpose_en: 'Route user intent to one category: LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE.',
    token_budget_target: 80,
    safety_notes_en: 'No user content in output; category and rationale only.',
    system: 'You are a classifier. Output valid JSON only. Choose exactly one category.',
    user_template: 'Which category fits this goal? Intent: "{{intent}}". Categories: LEARN, CREATE, PERFORM, WELLBEING, SOCIAL, CHALLENGE. Reply with JSON: {"category": string, "subcategory": string|null, "confidence": 0-1, "rationale_en": string}',
    input_schema: { intent: 'string' },
    output_schema: { category: 'string', subcategory: 'string|null', confidence: 'number', rationale_en: 'string' },
  },
  tone_aspiration_v1: {
    version: '1.0.0',
    purpose_en: 'Detect tone and whether user needs ambition confirmation (life goal / role aspiration).',
    token_budget_target: 60,
    safety_notes_en: 'No user content in output; tone and boolean only.',
    system: 'You are a tone classifier. Output valid JSON only.',
    user_template: 'Intent: "{{intent}}". Tone: serious, aspirational, playful, or joke? Does this sound like a big life goal that needs confirmation? Reply with JSON: {"tone": string, "requires_confirmation": boolean, "rationale_en": string}',
    input_schema: { intent: 'string' },
    output_schema: { tone: 'string', requires_confirmation: 'boolean', rationale_en: 'string' },
  },
  realism_judge_v1: {
    version: '1.0.0',
    purpose_en: 'Assess feasibility of goal in given days. Used for LEARN/CREATE/WELLBEING when category requires feasibility.',
    token_budget_target: 120,
    safety_notes_en: 'Output short why_short in user locale; no harmful advice.',
    system: 'You are a feasibility judge. Output valid JSON only. Be concise.',
    user_template: 'Goal: "{{intent}}". Days: {{days}}. UI locale: {{ui_locale}}. Is this ok, stretch, or unrealistic? If unrealistic, suggest 1-3 adjustments (label, next_intent, next_days). Reply with JSON: {"realism": "ok"|"stretch"|"unrealistic", "why_short": string, "adjustments": [{"label": string, "next_intent": string, "next_days": number}]|null}',
    input_schema: { intent: 'string', days: 'number', ui_locale: 'string' },
    output_schema: { realism: 'string', why_short: 'string', adjustments: 'array|null' },
  },
  objectives_preview_v1: {
    version: '1.0.0',
    purpose_en: 'Preview 1-3 precise objectives for the confirmation screen, in intent language.',
    token_budget_target: 120,
    safety_notes_en: 'Output only short objectives; no harmful content.',
    system:
      'You output a JSON object with an array of 1-3 short objectives the user will achieve, in the SAME language as the intent. Each objective is one short phrase.',
    user_template:
      'Intent: "{{intent}}". Language: {{intent_lang}}. Days: {{days}}. Give 1-3 precise objectives (short phrases) the user will reach. Same language as intent. Reply with JSON: {"objectives": [string]}',
    input_schema: { intent: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { objectives: 'array' },
  },
  clarify_chips_v1: {
    version: '1.0.0',
    purpose_en: 'Generate a strict clarify-chips contract (context + comfort) for the inline refine UI.',
    token_budget_target: 220,
    safety_notes_en: 'Output only short localized labels; no guidance or disclaimers.',
    system:
      'You output ONLY valid JSON matching the required contract. Labels in intent language. Keys are short ASCII slugs.',
    user_template:
      'Intent (redacted): "{{intent}}". Domain: {{domain}}. Intent language: {{intent_lang}}. UI locale: {{ui_locale}}. Days: {{days}}. Task: infer template_key and build sections for context and comfort (type "single"), each with up to 4 options + default. Reply with JSON: {"template_key": string, "prompt_version": "clarify_chips_v1", "lang": string, "days": number, "sections": [{"id": "context"|"comfort","label": string,"type":"single","options":[{"key": string,"label": string}],"default": string}]}',
    input_schema: { intent: 'string', intent_lang: 'string', ui_locale: 'string', days: 'number', domain: 'string' },
    output_schema: {
      template_key: 'string',
      prompt_version: 'string',
      lang: 'string',
      days: 'number',
      sections: 'array',
    },
  },
  category_analysis_v1_LEARN: {
    version: '1.0.0',
    purpose_en: 'Analyze LEARN intent: actionable, needs_clarification, angles (2-4) in intent language.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be controllable learning goals.',
    system: 'You are an analyst for learning goals. Output valid JSON only. Angles: 2-4 chips.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Is this actionable? If unclear, set needs_clarification and clarify_question. If actionable, give 2-4 angles (label, next_intent). Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
  category_analysis_v1_CREATE: {
    version: '1.0.0',
    purpose_en: 'Analyze CREATE intent: actionable, needs_clarification, angles (2-4) in intent language.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be controllable creation goals.',
    system: 'You are an analyst for creation/expression goals. Output valid JSON only.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
  category_analysis_v1_PERFORM: {
    version: '1.0.0',
    purpose_en: 'Analyze PERFORM intent: actionable, needs_clarification, angles (2-4) in intent language.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be controllable performance goals.',
    system: 'You are an analyst for performance/progress goals. Output valid JSON only.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
  category_analysis_v1_WELLBEING: {
    version: '1.0.0',
    purpose_en: 'Analyze WELLBEING intent: actionable, needs_clarification, angles (2-4). Supportive, controllable; no manipulation.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be supportive and controllable; never suggest manipulation.',
    system: 'You are an analyst for wellbeing goals. Output valid JSON only. Angles: supportive and controllable.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
  category_analysis_v1_SOCIAL: {
    version: '1.0.0',
    purpose_en: 'Analyze SOCIAL intent: actionable, needs_clarification, angles (2-4) in intent language.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be controllable social goals.',
    system: 'You are an analyst for social/collective goals. Output valid JSON only.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
  category_analysis_v1_CHALLENGE: {
    version: '1.0.0',
    purpose_en: 'Analyze CHALLENGE intent: actionable, needs_clarification, angles (2-4) in intent language.',
    token_budget_target: 180,
    safety_notes_en: 'Angles must be controllable challenge goals.',
    system: 'You are an analyst for challenge/transformation goals. Output valid JSON only.',
    user_template: 'Intent: "{{intent}}". UI locale: {{ui_locale}}. Intent language: {{intent_lang}}. Days: {{days}}. Reply with JSON: {"actionable": boolean, "needs_clarification": boolean, "clarify_question": string|null, "angles": [{"label": string, "next_intent": string}]|null, "suggested_rewrites": [{"label": string, "next_intent": string}]|null, "notes_en": string}',
    input_schema: { intent: 'string', ui_locale: 'string', intent_lang: 'string', days: 'number' },
    output_schema: { actionable: 'boolean', needs_clarification: 'boolean', clarify_question: 'string|null', angles: 'array|null', suggested_rewrites: 'array|null', notes_en: 'string' },
  },
};

export function getBootstrapStub(name: string): PromptEntry | null {
  const stub = STUBS[name];
  if (!stub) return null;
  return { name, ...stub };
}

export function isKnownPromptName(name: string): name is (typeof KNOWN_PROMPT_NAMES)[number] {
  return (KNOWN_PROMPT_NAMES as readonly string[]).includes(name);
}
