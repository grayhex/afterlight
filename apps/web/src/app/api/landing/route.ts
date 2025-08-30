import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from '@/lib/password';
import {
  getLandingConfig,
  saveLandingConfig,
  type LandingConfig,
} from '@/lib/landing';

const prisma = new PrismaClient();

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth) {
    console.log('Authorization header missing');
    return false;
  }
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    console.log('Authorization header is not Basic or missing credentials');
    return false;
  }
  let decoded: string;
  try {
    decoded =
      typeof atob === 'function'
        ? atob(encoded)
        : Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    console.log('Failed to decode credentials');
    return false;
  }
  const [login, password] = decoded.split(':');
  if (!login || !password) {
    console.log('Missing login or password');
    return false;
  }
  const admin = await prisma.user.findUnique({ where: { email: login } });
  if (!admin) {
    console.log('User not found');
    return false;
  }
  if (admin.role !== 'Admin') {
    console.log('User is not an admin');
    return false;
  }
  if (!admin.passwordHash) {
    console.log('User has no password hash');
    return false;
  }
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) console.log('Password hash mismatch');
  return valid;
}

export async function HEAD(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  const config = getLandingConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  const body = (await request.json()) as Partial<LandingConfig>;
  const current = getLandingConfig();
  const newConfig: LandingConfig = {
    title: body.title ?? current.title,
    subtitle: body.subtitle ?? current.subtitle,
    description: body.description ?? current.description,
    bgColor: body.bgColor ?? current.bgColor,
    headerBgColor: body.headerBgColor ?? current.headerBgColor,
    headerTextColor: body.headerTextColor ?? current.headerTextColor,
    titleColor: body.titleColor ?? current.titleColor,
    subtitleColor: body.subtitleColor ?? current.subtitleColor,
    descriptionColor: body.descriptionColor ?? current.descriptionColor,
    buttonPrimaryBgColor:
      body.buttonPrimaryBgColor ?? current.buttonPrimaryBgColor,
    buttonPrimaryTextColor:
      body.buttonPrimaryTextColor ?? current.buttonPrimaryTextColor,
    buttonSecondaryBorderColor:
      body.buttonSecondaryBorderColor ?? current.buttonSecondaryBorderColor,
    buttonSecondaryTextColor:
      body.buttonSecondaryTextColor ?? current.buttonSecondaryTextColor,
    links: {
      telegram: body.links?.telegram ?? current.links.telegram,
      github: body.links?.github ?? current.links.github,
      dev: body.links?.dev ?? current.links.dev,
      policies: body.links?.policies ?? current.links.policies,
      contacts: body.links?.contacts ?? current.links.contacts,
    },
  };
  await saveLandingConfig(newConfig);
  return NextResponse.json(newConfig);
}
