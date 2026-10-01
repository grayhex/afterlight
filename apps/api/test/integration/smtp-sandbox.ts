import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { AddressInfo } from 'net';

export interface SandboxMessage {
  to: string[];
  subject: string;
  text: string;
}

export type SandboxMode = 'accept' | 'reject-permanent' | 'reject-temporary' | 'stall';

/**
 * Настоящий SMTP-сервер в процессе теста: письма доходят по протоколу SMTP через тот же nodemailer-транспорт,
 * что и в runtime (это и есть «почтовый sandbox» integration-контура). Можно имитировать недоступность сервера
 * (stop/start на том же порту), отказы: постоянный (550) и временный (451), и «зависание»: соединение принято,
 * но сервер не отвечает (stall).
 */
export class SmtpSandbox {
  messages: SandboxMessage[] = [];
  mode: SandboxMode = 'accept';
  /** Текст в ответе сервера при отказе: имитирует сервер/фильтр, который повторяет в ответе данные письма */
  rejectText = 'mailbox unavailable';
  port = 0;
  private server: SMTPServer | null = null;

  private build(): SMTPServer {
    return new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS', 'AUTH'],
      logger: false,
      onConnect: (_session, cb) => {
        if (this.mode === 'stall') return; // не отвечаем: клиент должен упереться в свой таймаут
        cb();
      },
      onRcptTo: (address, _session, cb) => {
        if (this.mode === 'reject-permanent') return cb(Object.assign(new Error(`550 ${this.rejectText}`), { responseCode: 550 }));
        if (this.mode === 'reject-temporary') return cb(Object.assign(new Error(`451 ${this.rejectText}`), { responseCode: 451 }));
        cb();
      },
      onData: (stream, session, cb) => {
        simpleParser(stream)
          .then((mail) => {
            this.messages.push({
              to: session.envelope.rcptTo.map((r) => r.address),
              subject: mail.subject ?? '',
              text: mail.text ?? '',
            });
            cb();
          })
          .catch(cb);
      },
    });
  }

  async start(): Promise<void> {
    this.server = this.build();
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.port, '127.0.0.1', () => resolve());
    });
    this.port = (this.server.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    const s = this.server;
    this.server = null;
    if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
  }

  to(address: string): SandboxMessage[] {
    return this.messages.filter((m) => m.to.includes(address));
  }
}
