export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function WireframesLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return <main className="container">{children}</main>;
}
