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

/**
 * Диагностика только из нормализованных кодов: «SMTP 550 (EENVELOPE)» или «ETIMEDOUT». Свободный текст ответа сервера
 * (response/message) не сохраняется и не логируется: он контролируется сервером или фильтром и может содержать адрес
 * получателя, фрагмент письма или токен.
 */
function describe(err: any): string {
  const responseCode = Number(err?.responseCode);
  const code = typeof err?.code === 'string' ? err.code.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) : '';
  if (Number.isInteger(responseCode) && responseCode > 0) return `SMTP ${responseCode}${code ? ` (${code})` : ''}`;
  if (code) return code;
  const name = typeof err?.name === 'string' ? err.name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) : '';
  return name || 'ERROR';
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
        throw new MailSendError('SMTP recipient rejected (EREJECTED)', true, 'EREJECTED');
      }
    } catch (e) {
      throw e instanceof MailSendError ? e : classifyMailError(e);
    }
  }
}
