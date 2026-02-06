'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminErrorsPage() {
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
      <header className={styles.header}>
        <h1 className={styles.title}>Errors</h1>
        <p className={styles.subtitle}>
          Centralisation des erreurs observées côté mission et génération. Dev-only.
        </p>
        <p>
          <Link href="/" className={styles.link}>
            ← Retour à l’accueil
          </Link>
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Logs mission (front)</h2>
        <div className={styles.block}>
          <p>
            Les logs frontend sont disponibles dans la console du navigateur avec le tag <code>[Mission]</code>.
          </p>
          <p>
            Ils apparaissent lors d’un retour <code>pending</code>, d’une réponse invalide ou d’une génération verrouillée.
          </p>
        </div>
      </section>
    </div>
  );
}
