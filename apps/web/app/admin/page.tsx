'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './admin-home.module.css';

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

export default function AdminHomePage() {
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
    <div className={styles.wrap}>
      <h1 className={styles.title}>Admin</h1>
      <p className={styles.subtitle}>
        Choisir une section dans le menu à gauche, ou ci-dessous.
      </p>
      <ul className={styles.list}>
        {ADMIN_SECTIONS.map(({ path, label }) => (
          <li key={path}>
            <Link href={path} className={styles.link}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
