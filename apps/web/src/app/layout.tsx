import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getLandingConfig } from '@/lib/landing';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'AfterLight — разработка',
  description: 'Идёт разработка с помощью искусственного интеллекта',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getLandingConfig();
  return (
    <html lang="ru">
      <body
        className={`${inter.className} flex min-h-screen flex-col antialiased`}
        style={{ backgroundColor: config.bgColor }}
      >
        <Header bgColor={config.headerBgColor} textColor={config.headerTextColor} />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
