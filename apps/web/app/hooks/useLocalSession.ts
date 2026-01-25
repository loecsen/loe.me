'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearSession, getSession, setSession, type LocalSession } from '../lib/auth/localSession';

export function useLocalSession() {
  const [session, setSessionState] = useState<LocalSession | null>(null);

  useEffect(() => {
    setSessionState(getSession());
  }, []);

  const signIn = useCallback((email: string) => {
    const next = setSession(email);
    setSessionState(next);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const reset = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  return { session, signIn, signOut, reset };
}

