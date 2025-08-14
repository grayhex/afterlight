export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function PlaygroundLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return <>{children}</>;
}
