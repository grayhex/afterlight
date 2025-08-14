export const revalidate = false;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export default function WireframesLayout({ children }: { children: React.ReactNode }) {
  return children as any;
}
