// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation';

// Серверный редирект с корня на раздел вайрфреймов.
export default function Home() {
  redirect('/wireframes');
}
