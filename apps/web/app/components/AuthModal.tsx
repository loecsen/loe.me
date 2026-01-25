'use client';

import { useState } from 'react';

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  onReset: () => void;
};

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function AuthModal({ open, onClose, onSubmit, onReset }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    onSubmit(email.trim());
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel modal-panel-sm">
        <div className="modal-header">
          <div>
            <span className="modal-label">Account</span>
            <h2>Sign in</h2>
          </div>
          <button className="text-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-content">
          <label className="input-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@loe.me"
          />
          {error && <p className="auth-message">{error}</p>}
          <p className="auth-hint">No password for now — V1 prototype.</p>
        </div>

        <div className="modal-footer">
          <button className="text-button" onClick={onReset}>
            Reset local session
          </button>
          <button className="primary-button" onClick={handleSubmit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

