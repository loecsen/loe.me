'use client';

import { useState } from 'react';
import type { TraceEvent } from '@loe/core';

type DebugDecisionPanelProps = {
  trace: TraceEvent[];
  status: 'OK' | 'ACTIONABLE' | 'NOT_ACTIONABLE_INLINE' | 'BORDERLINE' | 'BLOCKED';
};

function statusSlug(s: string): string {
  return s.toLowerCase().replace(/_/g, '-');
}

export default function DebugDecisionPanel({ trace, status }: DebugDecisionPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <strong>Debug</strong>
        <span className={`debug-pill debug-pill-${statusSlug(status)}`}>{status}</span>
        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {expanded && (
        <div className="debug-panel-body">
          {trace.length === 0 ? (
            <div className="debug-panel-empty">No trace events.</div>
          ) : (
            <ul>
              {trace.map((event, index) => (
                <li key={`${event.gate}-${index}`}>
                  <div className="debug-panel-row">
                    <span className="debug-gate">{event.gate}</span>
                    <span className="debug-outcome">{event.outcome}</span>
                    {event.reason_code ? (
                      <span className="debug-reason">{event.reason_code}</span>
                    ) : null}
                  </div>
                  {event.meta ? (
                    <pre>{JSON.stringify(event.meta, null, 2).slice(0, 600)}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
