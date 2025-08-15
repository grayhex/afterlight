import { NextResponse } from 'next/server';
import {
  getLandingConfig,
  saveLandingConfig,
  type LandingConfig,
} from '@/lib/landing';

export function GET() {
  const config = getLandingConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LandingConfig>;
  const current = getLandingConfig();
  const newConfig: LandingConfig = {
    title: body.title ?? current.title,
    subtitle: body.subtitle ?? current.subtitle,
    description: body.description ?? current.description,
    bgColor: body.bgColor ?? current.bgColor,
    titleColor: body.titleColor ?? current.titleColor,
    subtitleColor: body.subtitleColor ?? current.subtitleColor,
    descriptionColor: body.descriptionColor ?? current.descriptionColor,
    links: {
      telegram: body.links?.telegram ?? current.links.telegram,
      github: body.links?.github ?? current.links.github,
      dev: body.links?.dev ?? current.links.dev,
    },
  };
  await saveLandingConfig(newConfig);
  return NextResponse.json(newConfig);
}
