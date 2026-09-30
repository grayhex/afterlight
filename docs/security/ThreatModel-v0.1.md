> Первичная модель (STRIDE-лайт). Границы доверия и модель ключей MVP — в [`docs/mvp-contract.md`](../mvp-contract.md), разделы 6–7.

# Threat Model v0.1 (STRIDE-лайт)

- Spoofing: компрометированные e-mail; меры — подтверждение e-mail, DKIM/SPF/DMARC, ограничение повторных попыток.
- Tampering: целостность метаданных и логов; меры — сигнатуры, контроль версий, неизменяемые логи.
- Repudiation: аудит действий (без секретов), фиксация согласий/версий политик.
- Information Disclosure: клиентское шифрование контента, минимизация метаданных, TTL ссылок, CAPTCHA.
- DoS: rate limits, CAPTCHA на публичных ссылках, защита SMTP.
- Elevation of Privilege: ролевые модели, проверка кворума, проверка границ (HB/TTL/grace).
