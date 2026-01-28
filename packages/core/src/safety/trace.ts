export type TraceEvent = {
  gate: string;
  outcome: 'ok' | 'blocked' | 'needs_clarification';
  reason_code?: string;
  meta?: Record<string, unknown>;
  at: string;
};

export function pushTrace(
  trace: TraceEvent[] | undefined,
  event: Omit<TraceEvent, 'at'> & { at?: string },
): void {
  if (!trace) return;
  trace.push({
    ...event,
    at: event.at ?? new Date().toISOString(),
  });
}
