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
      // Страница сброса по ссылке появится вместе с жизненным циклом аккаунта (#151, часть 2): пока токен вводится вручную
      text:
        `Токен для сброса пароля (действует 1 час): ${token}\n` +
        'Если вы не запрашивали сброс, проигнорируйте письмо. Сброс пароля не восстанавливает содержимое сейфа: ключи шифрования по почте не восстанавливаются.',
    };
  },
};
