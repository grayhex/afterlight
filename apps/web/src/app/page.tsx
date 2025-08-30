import FooterLinks from '@/components/footer-links';
import { getLandingConfig } from '@/lib/landing';

export const dynamic = 'force-dynamic';

export default function Home() {
  const config = getLandingConfig();

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: config.bgColor }}
    >
      <h1
        className="absolute left-1/2 top-6 -translate-x-1/2 text-5xl font-bold"
        style={{ color: config.titleColor }}
      >
        {config.title}
      </h1>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-base" style={{ color: config.subtitleColor }}>
          {config.subtitle}
        </p>
        <p className="text-sm" style={{ color: config.descriptionColor }}>
          {config.description}
        </p>
      </div>
      <FooterLinks links={config.links} />
    </main>
  );
}
