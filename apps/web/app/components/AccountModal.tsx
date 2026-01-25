'use client';

import type { LocalSession } from '../lib/auth/localSession';

type AccountModalProps = {
  open: boolean;
  onClose: () => void;
  session: LocalSession | null;
};

export default function AccountModal({ open, onClose, session }: AccountModalProps) {
  if (!open) {
    return null;
  }

  const createdAt = session?.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : '—';
  const lastLoginAt = session?.lastLoginAt
    ? new Date(session.lastLoginAt).toLocaleString()
    : '—';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-panel-sm">
        <div className="modal-header">
          <div>
            <span className="modal-label">Account</span>
            <h2>Session</h2>
          </div>
          <button className="text-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-content">
          <div>
            <span className="input-label">Email</span>
            <div>{session?.email ?? '—'}</div>
          </div>
          <div>
            <span className="input-label">Created</span>
            <div>{createdAt}</div>
          </div>
          <div>
            <span className="input-label">Last login</span>
            <div>{lastLoginAt}</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

