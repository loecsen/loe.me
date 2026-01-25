import type { DomainPlaybook } from '../domains/registry';

type MissionStubPromptInput = {
  userGoal: string;
  days: number;
  userLang: string;
  playbook: DomainPlaybook;
};

export function buildMissionStubPrompt({
  userGoal,
  days,
  userLang,
  playbook,
}: MissionStubPromptInput) {
  const system = `You create mission stubs for a learning ritual.

Output language: ${userLang}.
Return strict JSON only with this shape:
{
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
      "effortType": "read" | "listen" | "speak" | "practice" | "review",
      "competencyId": "comp-1",
      "axis": "understand" | "do" | "perceive" | "consolidate",
      "estimatedMinutes": 5,
      "resources": [
        { "provider": "loecsen" | "userProvided", "title": "Resource", "url": "", "reason": "Why" }
      ],
      "imageSubject": "Short subject"
    }
  ]
}

Constraints:
- Use allowedEffortTypes from the playbook only.
- Resources: only loecsen or userProvided, 0–3 per mission.
- Titles must be unique and concrete.
- axis must be one of: understand | do | perceive | consolidate (never read/listen/speak).
- estimatedMinutes must be an integer between 5 and 10.
- dayIndex must be 1..Days (integer).
- order, levelIndex, stepIndex must be integers.
- Vary effortType across the first 4 stubs.
`;

  const user = `Goal: "${userGoal}".
Days: ${days}.
Playbook:
${JSON.stringify(playbook, null, 2)}
`;

  return { system, user };
}
