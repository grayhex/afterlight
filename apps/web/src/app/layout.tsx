import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AfterLight',
  description: 'Цифровой сейф на случай непредвиденного',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      {/* Классы Tailwind + фолбэк из globals.css гарантируют читаемость */}
      <body className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
