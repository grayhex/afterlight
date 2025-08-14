export const metadata = { title: 'AfterLight', description: 'MVP playground & wireframes' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head />
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
