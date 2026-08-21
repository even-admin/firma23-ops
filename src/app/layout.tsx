import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { copy } from '@/copy/es-MX';
import './globals.css';

export const metadata: Metadata = {
  title: copy.app.name,
  description: 'Red operativa privada de FIRMA23.',
  // Private operating tool. Nothing here should ever be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es-MX" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-bg text-ink min-h-dvh antialiased">{children}</body>
    </html>
  );
}
