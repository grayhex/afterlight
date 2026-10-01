import { Injectable } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { loadMailConfig, MailConfig } from './mail.config.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/** Ошибка отправки с классификацией: permanent — повтор бессмысленен (адрес отвергнут), иначе — повторяем с backoff. */
export class MailSendError extends Error {
  constructor(message: string, readonly permanent: boolean, readonly code?: string) {
    super(message);
  }
}

export abstract class MailTransport {
  /** Возвращается только после того, как сервер принял сообщение (250). Иначе бросает MailSendError. */
  abstract send(mail: OutgoingMail): Promise<void>;
}

/** Диагностика без тела письма и без секретов: код + первая строка ответа сервера, не длиннее 300 символов. */
function describe(err: any): string {
  const code = err?.responseCode ?? err?.code ?? err?.name ?? 'ERROR';
  const msg = String(err?.response ?? err?.message ?? '').split('\n')[0].trim();
  return `${code}: ${msg}`.slice(0, 300);
}

export function classifyMailError(err: any): MailSendError {
  const responseCode = Number(err?.responseCode);
  let permanent: boolean;
  if (responseCode >= 400 && responseCode < 500) permanent = false; // временный отказ сервера (в т.ч. при EENVELOPE): повторяем
  else if (responseCode >= 500 && responseCode < 600) permanent = err?.code !== 'EAUTH'; // 5xx — окончательно, кроме ошибок входа (чинится настройкой)
  else permanent = err?.code === 'EENVELOPE' || err?.code === 'EMESSAGE'; // некорректный адрес/сообщение без ответа сервера
  return new MailSendError(describe(err), permanent, err?.code);
}

@Injectable()
export class SmtpMailTransport extends MailTransport {
  private readonly config: MailConfig;
  private readonly transporter: Transporter;

  constructor() {
    super();
    this.config = loadMailConfig();
    const c = this.config;
    this.transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      requireTLS: !c.secure && c.tls === 'required',
      ignoreTLS: !c.secure && c.tls === 'none',
      auth: c.user ? { user: c.user, pass: c.pass } : undefined,
      connectionTimeout: c.sendTimeoutMs,
      greetingTimeout: c.sendTimeoutMs,
      socketTimeout: c.sendTimeoutMs,
    });
  }

  async send(mail: OutgoingMail): Promise<void> {
    try {
      const info = await this.transporter.sendMail({ from: this.config.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
      if (!info.accepted?.length || info.rejected?.length) {
        throw new MailSendError(`recipient rejected: ${info.response ?? ''}`.slice(0, 300), true, 'EREJECTED');
      }
    } catch (e) {
      throw e instanceof MailSendError ? e : classifyMailError(e);
    }
  }
}
