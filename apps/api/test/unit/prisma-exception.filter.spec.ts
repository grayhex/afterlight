import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../../src/common/prisma-exception.filter.js';

describe('PrismaExceptionFilter', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  const run = (code: string, meta?: Record<string, unknown>, message = 'Invalid `prisma.user.findUnique()` invocation: SELECT secret FROM "user" WHERE email = a@b.c') => {
    const error = new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test', meta });
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host: any = { switchToHttp: () => ({ getResponse: () => res }) };
    new PrismaExceptionFilter().catch(error, host);
    return res;
  };

  it('maps the client-caused codes to 4xx with a generic body that carries no database text', () => {
    const cases: Array<[string, number]> = [['P2025', 404], ['P2002', 409], ['P2003', 409], ['P2007', 400], ['P2023', 400]];
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    for (const [code, status] of cases) {
      const res = run(code);
      expect([code, res.status.mock.calls[0][0]]).toEqual([code, status]);
      const body = JSON.stringify(res.json.mock.calls[0][0]);
      expect(body).not.toMatch(/prisma|SELECT|secret|a@b\.c|invocation/i);
    }
    expect(errorSpy).not.toHaveBeenCalled(); // ожидаемые ошибки клиента не засоряют журнал сбоев
  });

  it('answers an unmapped database error with a generic 500 and logs it with the code and model only', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = run('P2024', { modelName: 'Vault' });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0][0]);
    expect(logged).toContain('P2024');
    expect(logged).toContain('Vault');
    expect(logged).not.toMatch(/SELECT|secret|a@b\.c|invocation/i);
  });

  it('logs "unknown" when the error carries no model', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    run('P1001');
    expect(String(errorSpy.mock.calls[0][0])).toContain('model=unknown');
  });
});
