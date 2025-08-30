import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getLandingConfig } from '@/lib/landing';
import { Questrial } from 'next/font/google';
import localFont from 'next/font/local';

const headingFont = Questrial({
  subsets: ['latin'],
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
    <html lang="ru">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} ${numericFont.variable} flex min-h-screen flex-col antialiased font-body`}
        style={{ backgroundColor: config.bgColor }}
      >
        <Header bgColor={config.headerBgColor} textColor={config.headerTextColor} />
        <main className="flex-grow">{children}</main>
        <Footer links={config.links} />
      </body>
    </html>
  );
}
