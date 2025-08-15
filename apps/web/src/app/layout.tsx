import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AfterLight — разработка',
  description: 'Идёт разработка с помощью искусственного интеллекта',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-neutral-900 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
