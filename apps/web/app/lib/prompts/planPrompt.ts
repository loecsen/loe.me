import type { DomainPlaybook } from '../domains/registry';

type PlanPromptInput = {
  userGoal: string;
  originalGoal?: string;
  days: number;
  userLang: string;
  playbooks: DomainPlaybook[];
  domainLock: {
    domainId: string;
    domainProfile: string;
    domainPlaybookVersion: string;
  };
  goalHint?: string;
  contextHint?: string;
  validationPreference?: string;
};

export const PLAN_PROMPT_VERSION = 'plan_v1.1';

export function buildPlanPrompt({
  userGoal,
  originalGoal,
  days,
  userLang,
  playbooks,
  domainLock,
  goalHint,
  contextHint,
  validationPreference,
}: PlanPromptInput) {
  const catalog = playbooks.map((playbook) => ({
    id: playbook.id,
    label: playbook.label,
    version: playbook.version,
    profile: playbook.profile,
    allowedEffortTypes: playbook.allowedEffortTypes,
    weights: playbook.weights,
    rules: playbook.rules,
    remediationRules: playbook.remediationRules,
    resourcePolicy: playbook.resourcePolicy,
  }));

  const system = `You create a learning ritual for Loe.me.

Output language: ${userLang}.

DOMAIN LOCK (must copy exactly into path):
- domainId: "${domainLock.domainId}"
- domainProfile: "${domainLock.domainProfile}"
- domainPlaybookVersion: "${domainLock.domainPlaybookVersion}"

Your response must be strict JSON only (no extra text), with this shape:
{
  "path": {
    "id": "string",
    "pathTitle": "Learning path title",
    "pathSummary": "1 concrete sentence",
    "pathDescription": "2–4 sentences, concrete, lovable, realistic",
    "feasibilityNote": "ambitious/realistic + adaptation (2 sentences)",
    "domainId": "string (REQUIRED)",
    "domainProfile": "string (REQUIRED)",
    "domainPlaybookVersion": "string (REQUIRED)",
    "ritualMode": "progression" | "practice" | "maintenance",
    "validationMode": "automatic" | "self_report" | "presence",
    "gatingMode": "strict" | "soft" | "none",
    "competencies": [
      { "id": "comp-1", "title": "Skill", "description": "What this skill covers" }
    ],
    "resourcePolicy": {
      "mode": "prefer_cached" | "search_if_missing" | "manual_only",
      "allowEnglishFallback": true,
      "maxExternalLinksPerMission": 3
    },
    "budgetHints": {
      "maxTokensPerMission": 420,
      "maxSearchCallsPerMission": 1,
      "imageGenerationMode": "top_k",
      "topKImages": 4
    },
    "levels": [
      {
        "id": "level-1",
        "title": "Level title",
        "steps": [
          {
            "id": "step-1-1",
            "title": "Step title",
            "competencyId": "comp-1",
            "axis": "understand" | "do" | "perceive" | "consolidate",
            "effortType": "read" | "listen" | "speak" | "practice" | "review",
            "durationMin": 5,
            "required": true,
            "missionId": "mission-1-1"
          }
        ]
      }
    ]
  },
  "missionStubs": [
    {
      "id": "mission-1-1",
      "stepId": "step-1-1",
      "dayIndex": 1,
      "order": 1,
      "levelIndex": 1,
      "stepIndex": 1,
      "title": "Mission title",
      "summary": "Short summary",
      "uniqueAngle": "One clause that makes this mission distinct",
      "actionVerb": "Single verb that starts the mission",
      "effortType": "read" | "listen" | "speak" | "practice" | "review",
      "competencyId": "comp-1",
      "axis": "understand" | "do" | "perceive" | "consolidate",
      "estimatedMinutes": 5,
      "resources": [
        {
          "provider": "loecsen" | "userProvided",
          "title": "Resource title",
          "url": "",
          "reason": "Why this helps"
        }
      ],
      "imageSubject": "Short subject"
    }
  ]
}

Constraints:
- You MUST copy the DOMAIN LOCK values exactly into path.domainId, path.domainProfile, path.domainPlaybookVersion.
- Choose domainId from the domain catalog.
- domainProfile should summarize the chosen playbook profile.
- domainPlaybookVersion must match the chosen playbook version.
- axis must be strictly one of: "understand" | "do" | "perceive" | "consolidate".
- effortType carries "read/listen/speak/quiz/practice" (do NOT put these in axis).
- If the goal is already clarified, DO NOT output needsClarification=true.
- Mapping rules:
  - Language learning → domainId "language"
  - Tennis, running, gym, swimming, workout → "fitness_sport"
  - Meditation, stress, sleep, calm → "wellbeing_mind"
  - Practical skill (guitar, piano, chess, drawing, coding) → "skill_performance"
  - Coding, programming → "tech_coding"
  - Music practice → "music_practice"
  - Otherwise → "personal_productivity"
- Domain guidance:
  - skill_performance: micro-drills, clear gestures, quick self-checks, no heavy theory.
  - wellbeing_mind: breathing, grounding, short journaling, calm routines, no heavy quiz.
- pathSummary: 1 sentence, concrete, no quotes, include the marker [[WM_PLAN_V1]], avoid vague terms (no “rituel doux”).
- pathTitle must include the exact target skill and level/timeframe (e.g., "Greek A1 in 14 days", "Chinese beginner tones", "Tennis serve").
- Never reuse pathSummary as any mission summary.
- pathDescription: 2–4 sentences: what you will do, how, why realistic (lovable vibe).
- feasibilityNote: state ambitious/realistic + adaptation in 2 sentences.
- 4 to 5 steps per level.
- Mission titles must be unique and concrete (no “Mission 1”).
- Include 0–3 resources per stub; only provider loecsen or userProvided; url can be empty.
- Every stub must include uniqueAngle and actionVerb.
- No repeated sentence across stubs.
- estimatedMinutes must be an integer between 5 and 10.
- dayIndex must be 1..Days (integer).
- order, levelIndex, stepIndex must be integers.
- Vary effortType across the first 4 stubs.
- Do not use web search.

Minimal example:
{
  "path": {
    "id": "path-1",
    "pathTitle": "Sample title",
    "pathSummary": "Concrete summary [[WM_PLAN_V1]]",
    "pathDescription": "Two sentences. Clear and realistic.",
    "feasibilityNote": "Realistic: short time, small scope. Adapted: focus on core skills.",
    "domainId": "language",
    "domainProfile": "Language acquisition",
    "domainPlaybookVersion": "1",
    "ritualMode": "progression",
    "validationMode": "automatic",
    "gatingMode": "soft",
    "competencies": [{ "id": "comp-1", "title": "Basics", "description": "Core foundations" }],
    "resourcePolicy": { "mode": "prefer_cached", "allowEnglishFallback": true, "maxExternalLinksPerMission": 3 },
    "budgetHints": { "maxTokensPerMission": 420, "maxSearchCallsPerMission": 1, "imageGenerationMode": "top_k", "topKImages": 4 },
    "levels": [
      {
        "id": "level-1",
        "title": "Level 1",
        "steps": [
          {
            "id": "step-1-1",
            "title": "Understand basics",
            "competencyId": "comp-1",
            "axis": "understand",
            "effortType": "read",
            "durationMin": 5,
            "required": true,
            "missionId": "mission-1-1"
          }
        ]
      }
    ]
  },
  "missionStubs": [
    {
      "id": "mission-1-1",
      "stepId": "step-1-1",
      "dayIndex": 1,
      "order": 1,
      "levelIndex": 1,
      "stepIndex": 1,
      "title": "Read core sounds",
      "summary": "Identify the five key sounds in simple words.",
      "uniqueAngle": "Focus on sound families",
      "actionVerb": "Identify",
      "effortType": "read",
      "competencyId": "comp-1",
      "axis": "understand",
      "estimatedMinutes": 5,
      "resources": [{ "provider": "loecsen", "title": "Basic sounds", "url": "", "reason": "Short drill" }],
      "imageSubject": "Reading basics"
    }
  ]
}
`;

  const user = `Goal: "${userGoal}"${originalGoal ? ` (clarified from: "${originalGoal}")` : ''}.
Days: ${days}.
Goal hint: ${goalHint ?? 'none'}.
Context hint: ${contextHint ?? 'none'}.
Validation preference: ${validationPreference ?? 'none'}.
Domain catalog JSON:
${JSON.stringify(catalog, null, 2)}
`;

  return { system, user, version: PLAN_PROMPT_VERSION };
}
