/**
 * Шаблоны писем. Письма не содержат plaintext блоков, ключей расшифрования и лишних персональных данных
 * (имён, названий сейфов); одноразовые токены передаются во фрагменте ссылки (#), а не в query.
 */
export interface EmailContent {
  subject: string;
  text: string;
}

export function webBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  // без localhost-подстановки в production: validateEnv требует WEB_BASE_URL при старте
  return (env.WEB_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

/** Момент времени в письме: одинаково читается в любом часовом поясе, без секунд. */
export function formatUtc(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getUTCDate())}.${p(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())} UTC`;
}

/** Письма о состоянии процесса: отдельный текст владельцу и верификаторам. Без названий сейфов, имён и содержимого. */
export interface EventMessages {
  owner: EmailContent;
  verifiers: EmailContent;
}

const cabinet = () => `${webBaseUrl()}/cabinet`;

export const eventMessages = {
  started(): EventMessages {
    return {
      owner: {
        subject: 'AfterLight: начат процесс раскрытия',
        text:
          'По вашему сейфу начат процесс раскрытия. Если это ошибка, войдите в аккаунт или нажмите «Я жив» — процесс будет отменён.\n' +
          `Кабинет: ${cabinet()}`,
      },
      verifiers: {
        subject: 'AfterLight: начат процесс верификации',
        text: `Начат процесс верификации по сейфу, где вы доверитель. Войдите в кабинет и примите решение: ${cabinet()}`,
      },
    };
  },
  disputed(): EventMessages {
    return {
      owner: {
        subject: 'AfterLight: спор подтверждений',
        text:
          'Доверители подали противоположные решения. Процесс заморожен на 24 часа; раскрытие в это время невозможно, по истечении блокировки процесс закрывается без раскрытия.\n' +
          `Кабинет: ${cabinet()}`,
      },
      verifiers: {
        subject: 'AfterLight: спор подтверждений',
        text: 'Подтверждения противоречат друг другу. Процесс заморожен на 24 часа; раскрытие в это время невозможно.',
      },
    };
  },
  grace(until: Date): EventMessages {
    const when = formatUtc(until);
    return {
      owner: {
        subject: 'AfterLight: кворум достигнут',
        text:
          `Кворум подтверждений достигнут. Раскрытие не ранее ${when}. Чтобы отменить процесс до этого момента, войдите в аккаунт или нажмите «Я жив».\n` +
          `Кабинет: ${cabinet()}`,
      },
      verifiers: {
        subject: 'AfterLight: кворум достигнут',
        text: `Кворум подтверждений достигнут. Раскрытие не ранее ${when}; до этого момента владелец может отменить процесс.`,
      },
    };
  },
  finalized(): EventMessages {
    // Передача содержимого получателю — отдельный шаг (#152); письмо не обещает того, чего система ещё не делает.
    return {
      owner: {
        subject: 'AfterLight: процесс завершён',
        text: 'Процесс раскрытия завершён: статус сейфа изменён. Передача содержимого получателю выполняется отдельным шагом, и о нём получатель уведомляется отдельно.',
      },
      verifiers: {
        subject: 'AfterLight: процесс завершён',
        text: 'Процесс раскрытия завершён: решения больше не требуются. Содержимое сейфа вам не передаётся.',
      },
    };
  },
  rejected(): EventMessages {
    return {
      owner: {
        subject: 'AfterLight: процесс закрыт',
        text: 'Блокировка спора истекла, процесс закрыт без раскрытия. Новый процесс потребует нового запуска.',
      },
      verifiers: {
        subject: 'AfterLight: процесс закрыт',
        text: 'Блокировка спора истекла, процесс закрыт без раскрытия. Решения больше не требуются.',
      },
    };
  },
  cancelled(): EventMessages {
    return {
      owner: {
        subject: 'AfterLight: процесс раскрытия отменён',
        text: 'Процесс раскрытия отменён: вы подтвердили, что с вами всё в порядке.',
      },
      verifiers: {
        subject: 'AfterLight: процесс раскрытия отменён',
        text: 'Владелец сейфа подтвердил активность: процесс отменён, решения не требуются.',
      },
    };
  },
};

export const templates = {
  verifierInvitation(token: string): EmailContent {
    return {
      subject: 'AfterLight: приглашение доверителя',
      text: `Вас пригласили стать доверителем. Войдите под этим адресом и откройте ссылку: ${webBaseUrl()}/invite#token=${token}`,
    };
  },
  emailVerification(token: string): EmailContent {
    return {
      subject: 'AfterLight: подтвердите адрес электронной почты',
      text:
        `Подтвердите адрес, чтобы пользоваться сервисом: ${webBaseUrl()}/verify-email#token=${token}\n` +
        'Ссылка действует 24 часа. Если вы не регистрировались, проигнорируйте письмо.',
    };
  },
  passwordReset(token: string): EmailContent {
    return {
      subject: 'Afterlight: восстановление пароля',
      text:
        `Задайте новый пароль по ссылке (действует 1 час): ${webBaseUrl()}/reset-password#token=${token}\n` +
        'Если вы не запрашивали сброс, проигнорируйте письмо. Сброс пароля не восстанавливает содержимое сейфа: ключи шифрования по почте не восстанавливаются.',
    };
  },
};
