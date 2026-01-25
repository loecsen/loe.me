'use client';

import { useEffect, useRef, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isReady, setIsReady] = useState(false);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(initialRef.current);
      }
    } catch {
      setValue(initialRef.current);
    } finally {
      setIsReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isReady) {
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore write errors
    }
  }, [isReady, key, value]);

  return [value, setValue, isReady] as const;
}
