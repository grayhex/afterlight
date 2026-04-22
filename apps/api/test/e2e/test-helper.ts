import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { AuditService } from '../../src/audit/audit.service';

function asDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

class InMemoryPrisma {
  private seq = 1;
  users: any[] = [];
  vaults: any[] = [];
  roles: any[] = [];
  invitations: any[] = [];
  events: any[] = [];
  decisions: any[] = [];
  heartbeats: any[] = [];
  blocks: any[] = [];
  publicLinks: any[] = [];
  recipients: any[] = [];
  blockRecipients: any[] = [];
  notifications: any[] = [];

  private id(_prefix: string) { this.seq += 1; return randomUUID(); }

  user = {
    create: async (args: any) => {
      const row = { id: this.id('user'), role: 'Owner', locale: 'ru-RU', createdAt: new Date(), updatedAt: new Date(), ...args.data };
      this.users.push(row);
      return row;
    },
    upsert: async (args: any) => {
      const found = this.users.find((u) => u.email === args.where.email);
      if (found) return Object.assign(found, args.update || {});
      return this.user.create({ data: args.create });
    },
    findUnique: async (args: any) => {
      if (args.where.id) return this.users.find((u) => u.id === args.where.id) || null;
      if (args.where.email) return this.users.find((u) => u.email === args.where.email) || null;
      return null;
    },
  };

  vault = {
    create: async (args: any) => {
      const row = { id: this.id('vault'), status: 'Active', quorumThreshold: 2, maxVerifiers: 5, heartbeatTimeoutDays: 60, graceHours: 24, isDemo: false, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      this.vaults.push(row);
      return row;
    },
    findUnique: async (args: any) => this.vaults.find((v) => v.id === args.where.id) || null,
    findFirst: async (args: any) => {
      const where = args?.where || {};
      return this.vaults.find((v) => Object.entries(where).every(([k, val]) => (v as any)[k] === val)) || null;
    },
    findMany: async (args: any) => {
      const where = args?.where || {};
      return this.vaults.filter((v) => Object.entries(where).every(([k, val]) => (v as any)[k] === val));
    },
    update: async (args: any) => {
      const row = this.vaults.find((v) => v.id === args.where.id);
      if (!row) throw new Error('Vault not found');
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  vaultUserRole = {
    create: async (args: any) => {
      const row = { addedAt: new Date(), isPrimary: false, ...args.data };
      this.roles.push(row);
      return args.include?.user ? { ...row, user: this.users.find((u) => u.id === row.userId) } : row;
    },
    findMany: async (args: any) => {
      const where = args?.where || {};
      return this.roles.filter((r) => Object.entries(where).every(([k, v]) => {
        if ((v as any)?.in) return (v as any).in.includes((r as any)[k]);
        if ((v as any)?.role?.in) return (v as any).role.in.includes((r as any)[k]);
        return (r as any)[k] === v;
      })).map((r) => (args?.include?.user ? { ...r, user: this.users.find((u) => u.id === r.userId) } : r));
    },
    findFirst: async (args: any) => (await this.vaultUserRole.findMany(args))[0] || null,
    findUnique: async (args: any) => {
      const key = args.where.vaultId_userId;
      return this.roles.find((r) => r.vaultId === key.vaultId && r.userId === key.userId) || null;
    },
    update: async (args: any) => {
      const key = args.where.vaultId_userId;
      const row = this.roles.find((r) => r.vaultId === key.vaultId && r.userId === key.userId);
      if (!row) throw new Error('Role not found');
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: any) => {
      let count = 0;
      for (const row of this.roles) {
        if (Object.entries(args.where || {}).every(([k, v]) => (row as any)[k] === v)) {
          Object.assign(row, args.data); count += 1;
        }
      }
      return { count };
    },
  };

  vaultUserInvitation = { create: async (args: any) => { const row = { id: this.id('inv'), createdAt: new Date(), ...args.data }; this.invitations.push(row); return row; } };

  verificationEvent = {
    create: async (args: any) => { const row = { id: this.id('event'), confirmsCount: 0, deniesCount: 0, createdAt: new Date(), ...args.data }; this.events.push(row); return row; },
    findUnique: async (args: any) => {
      const row = this.events.find((e) => e.id === args.where.id) || null;
      if (!row) return null;
      return args.include?.vault ? { ...row, vault: this.vaults.find((v) => v.id === row.vaultId) } : row;
    },
    findFirst: async (args: any) => (await this.verificationEvent.findMany(args))[0] || null,
    findMany: async (args: any) => {
      const where = args?.where || {};
      let list = this.events.filter((e) => Object.entries(where).every(([k, v]) => {
        if ((v as any)?.in) return (v as any).in.includes((e as any)[k]);
        return (e as any)[k] === v;
      }));
      if (args?.orderBy?.createdAt === 'desc') list = list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      return list;
    },
    update: async (args: any) => { const row = this.events.find((e) => e.id === args.where.id); if (!row) throw new Error('Event not found'); Object.assign(row, args.data); return row; },
  };

  verificationDecision = {
    findFirst: async (args: any) => this.decisions.find((d) => Object.entries(args.where || {}).every(([k, v]) => (d as any)[k] === v)) || null,
    create: async (args: any) => { const row = { id: this.id('decision'), decidedAt: new Date(), ...args.data }; this.decisions.push(row); return row; },
    update: async (args: any) => { const row = this.decisions.find((d) => d.id === args.where.id); if (!row) throw new Error('Decision not found'); Object.assign(row, args.data); return row; },
    upsert: async (args: any) => {
      const key = args.where.verificationEventId_userId;
      const existing = this.decisions.find((d) => d.verificationEventId === key.verificationEventId && d.userId === key.userId);
      if (existing) return Object.assign(existing, args.update);
      return this.verificationDecision.create({ data: args.create });
    },
    count: async (args: any) => this.decisions.filter((d) => Object.entries(args.where || {}).every(([k, v]) => (d as any)[k] === v)).length,
    groupBy: async (args: any) => {
      const filtered = this.decisions.filter((d) => Object.entries(args.where || {}).every(([k, v]) => (d as any)[k] === v));
      const map = new Map<string, number>();
      for (const d of filtered) map.set(d.decision, (map.get(d.decision) || 0) + 1);
      return [...map.entries()].map(([decision, count]) => ({ decision, _count: { decision: count } }));
    },
  };

  heartbeat = {
    findUnique: async (args: any) => this.heartbeats.find((h) => h.vaultId === args.where.vaultId) || null,
    upsert: async (args: any) => {
      const existing = this.heartbeats.find((h) => h.vaultId === args.where.vaultId);
      if (existing) return Object.assign(existing, args.update);
      const row = { ...args.create };
      this.heartbeats.push(row);
      return row;
    },
    findMany: async (args: any) => args?.include?.vault ? this.heartbeats.map((h) => ({ ...h, vault: this.vaults.find((v) => v.id === h.vaultId) })) : this.heartbeats,
  };

  block = {
    create: async (args: any) => { const row = { id: this.id('block'), tags: [], isPublic: false, createdAt: new Date(), updatedAt: new Date(), ...args.data }; this.blocks.push(row); return row; },
    findUnique: async (args: any) => {
      const row = this.blocks.find((b) => b.id === args.where.id) || null;
      if (!row) return null;
      return args.include?.vault ? { ...row, vault: this.vaults.find((v) => v.id === row.vaultId) } : row;
    },
    update: async (args: any) => { const row = this.blocks.find((b) => b.id === args.where.id); if (!row) throw new Error('Block not found'); Object.assign(row, args.data, { updatedAt: new Date() }); return row; },
    findMany: async (args: any) => this.blocks.filter((b) => Object.entries(args.where || {}).every(([k, v]) => (b as any)[k] === v)),
  };

  publicLink = {
    findUnique: async (args: any) => this.publicLinks.find((p) => p.blockId === args.where.blockId) || null,
    findFirst: async (args: any) => this.publicLinks.find((p) => p.tokenHash === args.where.tokenHash) || null,
    upsert: async (args: any) => {
      const existing = this.publicLinks.find((p) => p.blockId === args.where.blockId);
      if (existing) return Object.assign(existing, args.update);
      const row = { id: this.id('plink'), ...args.create };
      this.publicLinks.push(row);
      return row;
    },
    update: async (args: any) => {
      const row = this.publicLinks.find((p) => (args.where.id ? p.id === args.where.id : p.blockId === args.where.blockId));
      if (!row) throw new Error('PublicLink not found');
      const patch = { ...args.data };
      if (patch.viewsCount?.increment) { row.viewsCount = (row.viewsCount || 0) + patch.viewsCount.increment; delete patch.viewsCount; }
      Object.assign(row, patch);
      return row;
    },
  };

  recipient = {
    upsert: async (args: any) => {
      const existing = this.recipients.find((r) => r.contact === args.where.contact);
      if (existing) return Object.assign(existing, args.update);
      const row = { id: this.id('recipient'), createdAt: new Date(), ...args.create };
      this.recipients.push(row);
      return row;
    },
    findUnique: async (args: any) => this.recipients.find((r) => r.id === args.where.id) || null,
    findMany: async () => this.recipients,
  };

  blockRecipient = {
    upsert: async (args: any) => {
      const key = args.where.blockId_recipientId;
      const existing = this.blockRecipients.find((br) => br.blockId === key.blockId && br.recipientId === key.recipientId);
      if (existing) return Object.assign(existing, args.update);
      const row = { createdAt: new Date(), ...args.create };
      this.blockRecipients.push(row);
      return args.include?.recipient ? { ...row, recipient: this.recipients.find((r) => r.id === row.recipientId) } : row;
    },
    findMany: async (args: any) => this.blockRecipients.filter((br) => br.blockId === args.where.blockId).map((br) => args.include?.recipient ? ({ ...br, recipient: this.recipients.find((r) => r.id === br.recipientId) }) : br),
  };

  notification = { create: async () => ({}), update: async () => ({}), findMany: async () => [] };
  auditLog = { create: async () => ({}) };

  async $transaction(arg: any) {
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') return arg(this);
    return arg;
  }
}

class NotificationsStub { async enqueueEmail() {} async flushEmailQueue() {} async sendVerifierInvitation() {} }
class AuditStub { async log() {} }

export function mapState(state: string): string {
  const map: Record<string, string> = { Submitted: 'pending', Confirming: 'pending', QuorumReached: 'pending', Grace: 'grace', Finalized: 'finalized', HeartbeatTimeout: 'rejected_by_heartbeat', Disputed: 'pending' };
  return map[state] ?? state.toLowerCase();
}

export async function bootstrapE2eApp() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || "http://localhost";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
  const prisma = new InMemoryPrisma();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(prisma as any)
    .overrideProvider(NotificationsService).useValue(new NotificationsStub())
    .overrideProvider(AuditService).useValue(new AuditStub())
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
  app.use((req: any, _res: any, next: any) => { req.user = { sub: req.header('x-user-id') || prisma.users[0]?.id || 'anonymous' }; next(); });
  await app.listen(0);
  const address = app.getHttpServer().address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (method: string, path: string, body?: unknown, userId?: string) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  const factory = {
    createUser: (attrs: any = {}) => prisma.user.create({ data: { email: `${prisma.users.length + 1}@test.local`, ...attrs } }),
    createVault: (userId: string, attrs: any = {}) => prisma.vault.create({ data: { userId, name: 'Vault', mkWrapped: 'mk', ...attrs } }),
    createVerifier: async (vaultId: string, attrs: any = {}) => {
      const user = await prisma.user.create({ data: { email: `${prisma.users.length + 1}.ver@test.local`, role: 'Verifier', ...(attrs.user || {}) } });
      const role = await prisma.vaultUserRole.create({ data: { vaultId, userId: user.id, role: 'Verifier', status: attrs.status ?? 'Active', isPrimary: false } });
      return { user, role };
    },
    createRecipient: (attrs: any = {}) => prisma.recipient.upsert({ where: { contact: attrs.contact ?? `${prisma.recipients.length + 1}@mail.test` }, update: {}, create: { contact: attrs.contact ?? `${prisma.recipients.length + 1}@mail.test`, pubkey: attrs.pubkey ?? null, verificationStatus: 'Invited' } }),
  };

  const time = {
    freeze: (value: string | Date) => { jest.useFakeTimers(); jest.setSystemTime(asDate(value)); },
    advanceHours: (hours: number) => { jest.setSystemTime(new Date(Date.now() + hours * 3600 * 1000)); },
    reset: () => jest.useRealTimers(),
  };

  return { app, moduleRef, prisma, request, factory, time };
}

export async function closeE2eApp(app: INestApplication, time: { reset: () => void }) {
  time.reset();
  await app.close();
}
