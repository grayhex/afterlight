import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createHash } from 'crypto';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

/** Жизненный цикл аккаунта: регистрация, подтверждение адреса, закрытые до него действия, онбординг приглашённого. */
describe('account lifecycle (real PostgreSQL, real SMTP sandbox)', () => {
  let ctx: Ctx;
  let t0: Date;
  const secs = (n: number) => new Date(t0.getTime() + n * 1000);

  beforeEach(async () => {
    ctx = await bootstrapApp();
    t0 = new Date();
    ctx.clock.setNow(t0);
  });
  afterEach(async () => { await closeApp(ctx); });

  const register = (over: Record<string, unknown> = {}) =>
    ctx.request('POST', '/auth/register', { name: 'Test', email: 'new.user@test.local', phone: '+70000000000', password: 'correct horse', ...over });
  const login = (email = 'new.user@test.local', password = 'correct horse') => ctx.request('POST', '/auth/login', { email, password });
  const verifyToken = (email: string) =>
    ctx.mail.to(email).map((m) => m.text.match(/\/verify-email#token=([A-Za-z0-9_-]+)/)?.[1]).filter((t): t is string => !!t);
  /** Токен сессии: тестовый helper подписывает его тем же сервисом, что и вход */
  const tokenOf = async (email: string) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { email } });
    return user.id;
  };

  describe('registration and email verification', () => {
    it('creates an unverified account, mails a 24 h link, and the link verifies it once', async () => {
      const res = await register();
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(String), email: 'new.user@test.local', role: 'Owner', email_verified: false });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);

      const tokens = verifyToken('new.user@test.local');
      expect(tokens).toHaveLength(1);
      const mail = ctx.mail.to('new.user@test.local')[0];
      expect(mail.subject).toBe('AfterLight: подтвердите адрес электронной почты');
      expect(mail.text).not.toMatch(/example\.(com|org|net)/);

      const row = await ctx.db.emailVerificationToken.findFirstOrThrow();
      expect(row.tokenHash).toBe(createHash('sha256').update(tokens[0]).digest('hex')); // в БД только хэш
      expect(row.expiresAt.getTime() - t0.getTime()).toBeGreaterThan(23 * 3600 * 1000);

      expect((await ctx.request('POST', '/auth/verify-email', { token: tokens[0] })).status).toBe(201);
      expect((await ctx.db.user.findUniqueOrThrow({ where: { email: 'new.user@test.local' } })).emailVerifiedAt).not.toBeNull();
      // одноразовая ссылка
      expect((await ctx.request('POST', '/auth/verify-email', { token: tokens[0] })).status).toBe(410);
      expect(await ctx.db.emailVerificationToken.count()).toBe(0);
      // письмо после отправки не хранит тело с токеном
      const stored = await ctx.db.notification.findFirstOrThrow({ where: { toContact: 'new.user@test.local' } });
      expect(JSON.stringify(stored.payload)).not.toContain(tokens[0]);
    });

    it('rejects an unknown, malformed, expired or already-replaced token', async () => {
      await register();
      const [token] = verifyToken('new.user@test.local');
      expect((await ctx.request('POST', '/auth/verify-email', { token: 'x'.repeat(43) })).status).toBe(410);
      expect((await ctx.request('POST', '/auth/verify-email', { token: 'short' })).status).toBe(400);
      expect((await ctx.request('POST', '/auth/verify-email', {})).status).toBe(400);

      ctx.clock.setNow(secs(25 * 3600)); // ссылка живёт 24 часа
      expect((await ctx.request('POST', '/auth/verify-email', { token })).status).toBe(410);
      expect((await ctx.db.user.findUniqueOrThrow({ where: { email: 'new.user@test.local' } })).emailVerifiedAt).toBeNull();
    });

    it('a token cannot verify another account', async () => {
      await register({ email: 'first@test.local' });
      await register({ email: 'second@test.local' });
      const [first] = verifyToken('first@test.local');
      expect((await ctx.request('POST', '/auth/verify-email', { token: first })).status).toBe(201);
      expect((await ctx.db.user.findUniqueOrThrow({ where: { email: 'first@test.local' } })).emailVerifiedAt).not.toBeNull();
      expect((await ctx.db.user.findUniqueOrThrow({ where: { email: 'second@test.local' } })).emailVerifiedAt).toBeNull();
    });

    it('normalizes the address: login works with another letter case and a duplicate in another case is refused', async () => {
      expect((await register({ email: 'Mixed.Case@Test.Local' })).body.email).toBe('mixed.case@test.local');
      expect((await login('MIXED.case@test.LOCAL')).status).toBe(201);
      expect((await register({ email: 'mixed.CASE@test.local' })).status).toBe(409);
      expect(await ctx.db.user.count()).toBe(1);
    });

    it('requires a real password: 8+ characters', async () => {
      expect((await register({ password: 'short' })).status).toBe(400);
      expect((await register({ password: undefined })).status).toBe(400);
      expect(await ctx.db.user.count()).toBe(0);
    });

    it('/auth/me and login report whether the address is verified', async () => {
      await register();
      const loggedIn = await login();
      expect(loggedIn.body).toMatchObject({ email_verified: false });
      const id = await tokenOf('new.user@test.local');
      expect((await ctx.request('GET', '/auth/me', undefined, id)).body).toMatchObject({ email_verified: false });
      await ctx.request('POST', '/auth/verify-email', { token: verifyToken('new.user@test.local')[0] });
      expect((await ctx.request('GET', '/auth/me', undefined, id)).body).toMatchObject({ email_verified: true });
    });
  });

  describe('canonical addresses on every write path', () => {
    it('admin POST/PATCH /users store the normalized address, so login and reset find the account', async () => {
      const admin = await ctx.factory.createUser({ email: 'admin.canon@test.local', role: 'Admin' });
      const created = await ctx.request('POST', '/users', { email: 'Mixed.Case@Test.Local', role: 'Owner' }, admin.id);
      expect(created.status).toBe(201);
      expect(created.body.email).toBe('mixed.case@test.local');
      expect(created.body.emailVerifiedAt).toBeNull();

      const patched = await ctx.request('PATCH', `/users/${created.body.id}`, { email: 'Other.Mixed@Test.LOCAL' }, admin.id);
      expect(patched.status).toBe(200);
      expect(patched.body.email).toBe('other.mixed@test.local');
      expect((await ctx.db.user.findUniqueOrThrow({ where: { id: created.body.id } })).email).toBe('other.mixed@test.local');
    });
  });

  describe('an administrator changing an address', () => {
    it('drops the verification and every token issued for the old address; a case-only change keeps both', async () => {
      const admin = await ctx.factory.createUser({ role: 'Admin' });
      await register({ email: 'moving@test.local' });
      const id = await tokenOf('moving@test.local');
      const [oldLink] = verifyToken('moving@test.local');
      await ctx.request('POST', '/auth/verify-email', { token: oldLink });
      expect((await ctx.db.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt).not.toBeNull();

      // регистр не считается сменой адреса
      expect((await ctx.request('PATCH', `/users/${id}`, { email: 'Moving@Test.Local' }, admin.id)).status).toBe(200);
      expect((await ctx.db.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt).not.toBeNull();

      // письма на прежний адрес ещё в пути: ссылка подтверждения и сброс пароля
      await ctx.db.user.update({ where: { id }, data: { emailVerifiedAt: null } });
      await ctx.request('POST', '/auth/resend-verification', undefined, id);
      ctx.clock.setNow(secs(61));
      await ctx.request('POST', '/auth/forgot-password', { email: 'moving@test.local' });
      const staleVerify = verifyToken('moving@test.local').at(-1) as string;
      const staleReset = ctx.mail.to('moving@test.local').map((m) => m.text.match(/: ([0-9a-f]{64})/)?.[1]).filter(Boolean).at(-1) as string;
      await ctx.request('POST', '/auth/verify-email', { token: staleVerify }); // подтверждён: проверим сброс при смене
      expect((await ctx.db.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt).not.toBeNull();

      const moved = await ctx.request('PATCH', `/users/${id}`, { email: 'moved@test.local' }, admin.id);
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({ email: 'moved@test.local', emailVerifiedAt: null });
      expect(await ctx.db.emailVerificationToken.count({ where: { userId: id } })).toBe(0);
      expect(await ctx.db.passwordResetToken.count({ where: { userId: id } })).toBe(0);
      // токен из письма на прежний адрес больше не сбрасывает пароль нового
      expect((await ctx.request('POST', '/auth/reset-password', { token: staleReset, password: 'attacker-chosen-1' })).status).toBe(401);
    });
  });

  describe('resending the confirmation mail', () => {
    it('sends a new link, which replaces the older one; a cooldown and an hourly cap apply; a verified user is a no-op', async () => {
      await register();
      const id = await tokenOf('new.user@test.local');
      const [first] = verifyToken('new.user@test.local');

      expect((await ctx.request('POST', '/auth/resend-verification', undefined, id)).status).toBe(201);
      expect(verifyToken('new.user@test.local')).toHaveLength(1); // пауза 60 с: второе письмо ещё не создано

      ctx.clock.setNow(secs(61));
      await ctx.request('POST', '/auth/resend-verification', undefined, id);
      const tokens = verifyToken('new.user@test.local');
      expect(tokens).toHaveLength(2);
      expect((await ctx.request('POST', '/auth/verify-email', { token: first })).status).toBe(410); // старая ссылка заменена
      expect((await ctx.request('POST', '/auth/verify-email', { token: tokens[1] })).status).toBe(201);

      // уже подтверждён: ничего не отправляется
      ctx.clock.setNow(secs(200));
      await ctx.request('POST', '/auth/resend-verification', undefined, id);
      expect(verifyToken('new.user@test.local')).toHaveLength(2);
    });

    it('needs a session and the hourly cap holds', async () => {
      expect((await ctx.request('POST', '/auth/resend-verification')).status).toBe(401);
      await register({ email: 'cap@test.local' });
      const id = await tokenOf('cap@test.local');
      for (let i = 1; i <= 6; i++) {
        ctx.clock.setNow(secs(61 * i));
        await ctx.request('POST', '/auth/resend-verification', undefined, id);
      }
      expect(verifyToken('cap@test.local')).toHaveLength(5); // регистрация + 4 повтора, дальше потолок
    });
  });

  describe('sensitive actions are closed until the address is verified', () => {
    it('an unverified account cannot create a vault, start an event or vote, then can after verification', async () => {
      await register({ email: 'unverified@test.local' });
      const id = await tokenOf('unverified@test.local');
      const blocked = await ctx.request('POST', '/vaults', { name: 'My vault' }, id);
      expect(blocked.status).toBe(403);
      expect(blocked.body.message).toBe('Email address is not verified');
      expect(await ctx.db.vault.count()).toBe(0);

      await ctx.request('POST', '/auth/verify-email', { token: verifyToken('unverified@test.local')[0] });
      expect((await ctx.request('POST', '/vaults', { name: 'My vault' }, id)).status).toBe(201);
    });

    it('guards both start/vote APIs and the invitation acceptance for an unverified user', async () => {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      const v1 = await ctx.factory.createVerifier(vault.id);
      await ctx.factory.createVerifier(vault.id);
      await ctx.db.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: null } });
      expect((await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id)).status).toBe(403);
      expect((await ctx.request('POST', '/verification-events', { vault_id: vault.id }, owner.id)).status).toBe(403);
      await ctx.db.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: new Date() } });
      const started = await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
      expect(started.status).toBe(201);

      await ctx.db.user.update({ where: { id: v1.user.id }, data: { emailVerifiedAt: null } });
      expect((await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, v1.user.id)).status).toBe(403);
      expect((await ctx.request('POST', `/verification-events/${started.body.id}/confirm`, {}, v1.user.id)).status).toBe(403);
      expect((await ctx.request('POST', `/verification-events/${started.body.id}/deny`, {}, v1.user.id)).status).toBe(403);
      expect(await ctx.db.verificationDecision.count()).toBe(0);

      const invitee = await ctx.factory.createUser({ email: 'late.invitee@test.local', emailVerifiedAt: null });
      await ctx.request('POST', '/verification-events/' + started.body.id + '/cancel', undefined, owner.id);
      await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email: invitee.email }, owner.id);
      const token = (await ctx.invitationTokens(invitee.email))[0];
      expect((await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id)).status).toBe(403);
      expect((await ctx.db.vaultUserInvitation.findFirstOrThrow({ where: { email: invitee.email } })).acceptedAt).toBeNull(); // не сгорело
    });

    it('a deleted account loses access to a guarded route (401, not a stale 403/200)', async () => {
      await register({ email: 'gone@test.local' });
      const id = await tokenOf('gone@test.local');
      await ctx.db.user.delete({ where: { id } });
      expect((await ctx.request('POST', '/vaults', { name: 'x' }, id)).status).toBe(401);
    });
  });

  describe('onboarding of an invited person without an account', () => {
    async function invited(email = 'newcomer@test.local') {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      await ctx.factory.createVerifier(vault.id);
      await ctx.factory.createVerifier(vault.id);
      expect((await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email }, owner.id)).status).toBe(201);
      const token = (await ctx.invitationTokens(email))[0];
      return { owner, vault, token };
    }

    it('the token shows which address it is for and whether an account exists, without a session', async () => {
      const { token } = await invited();
      const before = await ctx.request('POST', '/verifiers/invitations/preview', { token });
      expect(before.status).toBe(201);
      expect(before.body).toEqual({ email: 'newcomer@test.local', expires_at: expect.any(String), has_account: false });
      await register({ email: 'newcomer@test.local' });
      expect((await ctx.request('POST', '/verifiers/invitations/preview', { token })).body.has_account).toBe(true);
      expect((await ctx.request('POST', '/verifiers/invitations/preview', { token: 'x'.repeat(43) })).status).toBe(410);
    });

    it('registers with the token (address proven by the mailbox), logs in, accepts, and then can vote - no manual DB edits', async () => {
      const { owner, vault, token } = await invited();
      const reg = await register({ email: 'Newcomer@Test.Local', invitation_token: token });
      expect(reg.status).toBe(201);
      expect(reg.body.email_verified).toBe(true);
      expect(verifyToken('newcomer@test.local')).toHaveLength(0); // отдельное письмо подтверждения не нужно
      expect(await ctx.db.emailVerificationToken.count()).toBe(0);
      // сама регистрация приглашение не расходует
      expect((await ctx.db.vaultUserInvitation.findFirstOrThrow({ where: { email: 'newcomer@test.local' } })).acceptedAt).toBeNull();

      expect((await login('newcomer@test.local')).status).toBe(201);
      const id = await tokenOf('newcomer@test.local');
      const accepted = await ctx.request('POST', '/verifiers/invitations/accept', { token }, id);
      expect(accepted.status).toBe(201);
      expect(accepted.body).toMatchObject({ role: 'Verifier', status: 'Active' });

      const started = await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
      expect(started.status).toBe(201);
      expect((await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, id)).status).toBe(201);
    });

    it('a token for another address, or a revoked/expired/garbage one, gives only an ordinary unverified registration', async () => {
      const { token } = await invited('someone.else@test.local');
      const other = await register({ email: 'not.the.addressee@test.local', invitation_token: token });
      expect(other.body.email_verified).toBe(false);
      expect(verifyToken('not.the.addressee@test.local')).toHaveLength(1);

      const garbage = await register({ email: 'g@test.local', invitation_token: 'x'.repeat(43) });
      expect(garbage.status).toBe(201);
      expect(garbage.body.email_verified).toBe(false);

      await ctx.db.vaultUserInvitation.updateMany({ data: { revokedAt: new Date() } });
      const revoked = await register({ email: 'someone.else@test.local', invitation_token: token });
      expect(revoked.body.email_verified).toBe(false);
    });
  });
});
