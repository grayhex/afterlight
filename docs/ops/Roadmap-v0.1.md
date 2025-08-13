# Дорожная карта — Afterlight v0.1

## Milestone: MVP Smoke-Ready (2 недели)
- API: `GET /healthz` (версия, commit sha).
- Dockerfile (multi-stage), GHCR publish.
- K8s manifests: Deployment/Service/Ingress/Secrets/ConfigMap.
- ENV-ключи и шаблоны.
- Email-отправка (SMTP) + базовые шаблоны.
- Staging в РФ-облаке (S3-провайдер подключён к серверу).
- Сквозной SmokeTest (см. `docs/ops/SmokeTest.md`).

## Milestone: MVP (2–4 недели после Smoke)
- Сущности: Vaults, Verifiers, VerificationEvents, Blocks, Recipients, PublicLinks, AuditLog.
- Потоки: создание сейфа; приглашение верификаторов (e-mail); инициация события; кворум 2/3; grace 24ч; финализация.
- Heartbeat login (365 дней).
- Публичные ссылки: TTL 24ч, CAPTCHA, noindex.
- Политики: Пользовательское соглашение, Политика конфиденциальности (RU, черновик вычитан юристом).
- Site afterl.ru: лендинг + формы (RU, деловой тон).

## Milestone: M1
- Auth-улучшения: 2FA (TOTP), сессии и устройства.
- Базовые метрики/аудит, графики в админке (если есть).
- Улучшение e-mail доставляемости (DKIM/SPF/DMARC).

## Milestone: M2
- Telegram-бот уведомлений (опционально SMS).
- Доказательства/модерация статусов (минимальная).

## Milestone: Фаза 3
- Поддержка-инициированное раскрытие (процедуры, KYC light).
