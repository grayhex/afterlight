import LandingContent from "@/components/landing-content";
import { getLandingConfig } from "@/lib/landing";

export const dynamic = 'force-dynamic';

export default function Home() {
  const config = getLandingConfig();
  return <LandingContent links={config.links} />;
}

