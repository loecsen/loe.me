const SESSION_KEY = 'loe_session_v1';

export type LocalSession = {
  email: string;
  createdAt: string;
  lastLoginAt: string;
};

export function getSession(): LocalSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

export function setSession(email: string): LocalSession {
  const now = new Date().toISOString();
  const session: LocalSession = {
    email,
    createdAt: now,
    lastLoginAt: now,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

