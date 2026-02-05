'use client';

import { useEffect, useState } from 'react';
import styles from './PageLoader.module.css';

/**
 * Page loader overlay: "Stop scroll. Act." — displays 1.2s then fades out (0.5s).
 * Rollback: set ENABLE_PAGE_LOADER = false in page.tsx or remove <PageLoader />.
 */
export default function PageLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => {
      setMounted(false);
    }, 3200); // 2.5s display + 0.5s fade = 3s total
    return () => clearTimeout(t);
  }, []);

  if (!mounted) return null;

  return (
    <div className={styles.overlay} role="presentation" aria-hidden="true">
      <div className={styles.glow1} />
      <div className={styles.glow2} />
      <h1 className={styles.slogan}>Stop scroll. Act.</h1>
    </div>
  );
}
