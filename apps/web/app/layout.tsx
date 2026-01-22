import type { ReactNode } from 'react';
import Link from 'next/link';
import { Container } from '@loe/ui';

import './globals.css';

export const metadata = {
  title: 'Loe.me Mission Engine V1',
  description: 'Calm, premium mission engine scaffolding.',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <Container className="header-inner">
              <div className="brand">
                <span className="brand-dot" />
                <span>Mission Engine V1</span>
              </div>
              <nav className="nav">
                <Link className="nav-link" href="/">
                  Accueil
                </Link>
                <Link className="nav-link" href="/mission">
                  Mission
                </Link>
                <Link className="nav-link" href="/demo">
                  Demo
                </Link>
              </nav>
            </Container>
          </header>
          <main className="app-main">
            <Container>{children}</Container>
          </main>
        </div>
      </body>
    </html>
  );
}
