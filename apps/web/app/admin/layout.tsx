'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styles from './layout.module.css';

const ADMIN_SECTIONS: { path: string; label: string }[] = [
  { path: '/admin/routine-generation', label: 'Génération de la routine' },
  { path: '/admin/errors', label: 'Errors' },
  { path: '/admin/idea-routines', label: 'Suggestions rituels' },
  { path: '/admin/prompts', label: 'Admin Prompts' },
  { path: '/admin/llm', label: 'LLM Playground' },
  { path: '/admin/domains', label: 'Domains' },
  { path: '/admin/knowledge', label: 'Knowledge (dev DB)' },
  { path: '/admin/lexicon', label: 'Language Packs' },
  { path: '/admin/messages', label: 'Messages (scénarios)' },
  { path: '/admin/eval', label: 'Eval Harness' },
  { path: '/admin/rules', label: 'Admin rules' },
  { path: '/admin/safety', label: 'Admin safety' },
  { path: '/admin/images', label: 'Images' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      router.replace('/');
    }
  }, [router]);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.sidebarTitle}>
            Admin
          </Link>
        </div>
        <nav className={styles.nav} aria-label="Admin sections">
          <Link
            href="/"
            className={styles.navItem}
          >
            ← Accueil
          </Link>
          {ADMIN_SECTIONS.map(({ path, label }) => (
            <Link
              key={path}
              href={path}
              className={`${styles.navItem} ${pathname === path ? styles.navItemActive : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
