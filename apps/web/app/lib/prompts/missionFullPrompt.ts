import type { DomainPlaybook } from '../domains/registry';
import type { MissionStub } from '@loe/core';

type MissionFullPromptInput = {
  userGoal: string;
  days: number;
  userLang: string;
  playbook: DomainPlaybook;
  mission: MissionStub;
  validationMode: 'automatic' | 'self_report' | 'presence';
  ritualMode: 'progression' | 'practice' | 'maintenance';
  domainId?: string;
};

export const MISSION_FULL_PROMPT_VERSION = 'mission_full_v1.1';

const domainBlockHints: Record<string, string> = {
  language:
    'Prefer short dialogue, listening cues, and quick quiz checks. Avoid long explanations.',
  wellbeing_meditation:
    'Prefer breathing/journaling prompts and reflective checklists. No heavy quizzes.',
  fitness_sport:
    'Prefer drills + self-checklists. No heavy quizzes; focus on form cues.',
  tech_coding:
    'Prefer hands-on practice steps and short checklists. Avoid long theory blocks.',
  music_practice:
    'Prefer practice drills and listening checks. Avoid long text-heavy blocks.',
  academics_exam:
    'Prefer quiz + short recall prompts. Keep summaries short.',
  personal_productivity:
    'Prefer checklists and reflection prompts. Keep steps short and actionable.',
};

const validationHints: Record<string, string> = {
  automatic:
    'Include at least one quiz or clearly checkable output.',
  self_report:
    'Use checklist + reflection. Allow optional proof line (e.g., note or link).',
  presence:
    'Use a simple ritual checklist. Avoid grading or scores.',
};

export function buildMissionFullPrompt({
  userGoal,
  days,
  userLang,
  playbook,
  mission,
  validationMode,
  ritualMode,
  domainId,
}: MissionFullPromptInput) {
  const system = `You create the content blocks for a single mission.

Output language: ${userLang}.
Return strict JSON only with this shape:
{
  "blocks": [
    { "type": "text", "text": "..." },
    { "type": "checklist", "items": ["...", "..."] },
    { "type": "quiz", "question": "...", "choices": ["...", "..."], "correctIndex": 0 }
  ]
}

Constraints:
- 2 to 4 blocks max.
- Calm, clear, premium tone.
- No technical jargon, no mention of AI.
- Keep blocks concrete and short.
- Use only text/checklist/quiz blocks (no media).
- Follow validation mode: ${validationHints[validationMode] ?? validationHints.automatic}
- Ritual mode: ${ritualMode} (practice/maintenance should feel repeatable and low-friction).
- Domain guidance: ${domainBlockHints[playbook.id] ?? playbook.profile.intent}
- Resources are handled at stub level; do not add resources here.
- Do not repeat any sentence from the mission summary.
- Keep summary distinct from any other stub summaries.
`;

  const user = `Goal: "${userGoal}".
Days: ${days}.
DomainId: ${domainId ?? playbook.id}.
Domain playbook:
${JSON.stringify(playbook, null, 2)}
Mission stub:
${JSON.stringify(mission, null, 2)}
`;

  return { system, user, version: MISSION_FULL_PROMPT_VERSION };
}
