import { useEffect } from 'react';
export default function Index() {
  useEffect(() => { if (typeof window !== 'undefined') window.location.replace('/playground'); }, []);
  return null;
}
