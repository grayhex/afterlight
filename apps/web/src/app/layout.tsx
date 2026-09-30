import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getLandingConfig } from '@/lib/landing';
import localFont from 'next/font/local';

// Questrial (SIL OFL 1.1), подмножество latin: лежит в репозитории, а не скачивается с fonts.googleapis.com
// при сборке — сборка воспроизводима без доступа к Google и не зависит от его доступности.
const headingFont = localFont({
  src: '../../public/fonts/Questrial-Regular-latin.woff2',
  weight: '400',
  variable: '--font-heading',
});

const bodyFont = localFont({
  src: '../../public/fonts/MadeforText-Regular.woff2',
  weight: '400',
  variable: '--font-body',
});

const numericFont = localFont({
  src: '../../public/fonts/DINNextLight.woff2',
  weight: '300',
  variable: '--font-numeric',
});

export const metadata: Metadata = {
  title: 'AfterLight — разработка',
  description: 'Идёт разработка с помощью искусственного интеллекта',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getLandingConfig();
  return (
    <html lang="ru" className="scroll-smooth">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} ${numericFont.variable} flex min-h-screen flex-col antialiased font-body`}
      >
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer links={config.links} />
      </body>
    </html>
  );
}
