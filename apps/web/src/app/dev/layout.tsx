import type { Metadata } from 'next';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { getLandingConfig } from '@/lib/landing';

export const metadata: Metadata = {
  title: 'Dev Area',
};

export const dynamic = 'force-dynamic';

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const config = getLandingConfig();
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: config.bgColor }}
    >
      <Header
        bgColor={config.headerBgColor}
        textColor={config.headerTextColor}
      />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}