#!/usr/bin/env bash
# Smoke-проверка контейнеров: собирает образы, поднимает PostgreSQL + migrate + api + web из docker-compose.server.yml
# и проходит основной путь через web-прокси: health, регистрация, логин, защищённая страница, seed-админ.
# Запуск: scripts/smoke-compose.sh   (нужен Docker; БД и секреты одноразовые, том удаляется в конце)
set -euo pipefail

cd "$(dirname "$0")/.."
export COMPOSE_PROJECT_NAME=afterlight-smoke
export ENV_FILE="$(mktemp)"
export WEB_PORT="${WEB_PORT:-18080}"
COMPOSE=(docker compose -f docker-compose.server.yml -f docker-compose.smoke.yml)
MAILPIT="http://127.0.0.1:${MAILPIT_UI_PORT:-18025}"
BASE="http://127.0.0.1:${WEB_PORT}"
JAR="$(mktemp)"

# База — настоящий шаблон .env.example (проверяем, что по нему получается рабочий стек), поверх — одноразовые значения
# (в env_file при повторе ключа побеждает последний).
cp .env.example "$ENV_FILE"
cat >> "$ENV_FILE" <<ENV

JWT_SECRET=smoke-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
NODE_ENV=production
CORS_ALLOWED_ORIGINS=${BASE}
COOKIE_SECURE=false
WEB_BASE_URL=${BASE}
WEB_PORT=${WEB_PORT}
ADMIN_PASSWORD=smoke-admin-password
POSTGRES_DB=afterlight
POSTGRES_USER=afterlight
POSTGRES_PASSWORD=smoke-db-password
DATABASE_URL=postgresql://afterlight:smoke-db-password@db:5432/afterlight?schema=public
MAIL_FROM=AfterLight <no-reply@afterlight.org>
MAIL_SMTP_HOST=mailpit
MAIL_SMTP_PORT=1025
MAIL_SMTP_TLS=none
MAILPIT_UI_PORT=${MAILPIT_UI_PORT:-18025}
ENV

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "::group::compose logs"; "${COMPOSE[@]}" logs --no-color --tail=100 || true; echo "::endgroup::"
  fi
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_FILE" "$JAR"
  exit "$status"
}
trap cleanup EXIT

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() { # expect <ожидаемый-код> <описание> curl-аргументы...
  local want=$1 what=$2; shift 2
  local got; got=$(code "$@")
  [ "$got" = "$want" ] || fail "$what: ожидали HTTP $want, получили $got"
  echo "ok  $what ($got)"
}

# production без WEB_BASE_URL не стартует (ссылки в письмах не должны вести на localhost)
grep -qE '^WEB_BASE_URL=' .env.example || fail ".env.example не содержит WEB_BASE_URL"
! grep -qE '^API_INTERNAL_URL=' .env.example || fail ".env.example задаёт API_INTERNAL_URL: значение из .env перебьёт умолчание compose"

"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d db mailpit
"${COMPOSE[@]}" run --rm migrate
"${COMPOSE[@]}" up -d --wait api web

expect 200 "api через web-прокси /api/healthz" "$BASE/api/healthz"
expect 200 "api /readyz (БД доступна) через прокси" "$BASE/api/readyz"
expect 200 "главная страница" "$BASE/"
expect 401 "защищённый маршрут API без входа" "$BASE/api/vaults"
expect 307 "/cabinet без входа → редирект" "$BASE/cabinet"

EMAIL="smoke$RANDOM@test.local"
JSON=(-H 'content-type: application/json')
expect 201 "регистрация" -X POST "$BASE/api/auth/register" "${JSON[@]}" -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"phone\":\"+70000000000\",\"password\":\"smoke-pass-123\"}"
expect 201 "логин" -c "$JAR" -X POST "$BASE/api/auth/login" "${JSON[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass-123\"}"
grep -q $'\ttoken\t' "$JAR" || fail "cookie сессии не выставлена"
expect 403 "запрос с чужим Origin отклонён (CSRF)" -X POST "$BASE/api/auth/logout" -H 'origin: https://evil.example' -b "$JAR"
expect 200 "/auth/me по cookie" -b "$JAR" "$BASE/api/auth/me"
expect 200 "/cabinet по cookie (middleware передаёт cookie)" -b "$JAR" "$BASE/cabinet"
# mail_text <адрес> <фрагмент темы>: текст последнего письма из sandbox (ждёт до 30 с)
mail_text() {
  local id=""
  for _ in $(seq 1 30); do
    id=$(curl -fsS "$MAILPIT/api/v1/messages" | jq -r --arg e "$1" --arg s "$2" '[.messages[] | select(any(.To[]; .Address == $e)) | select(.Subject | contains($s))][0].ID // empty')
    [ -n "$id" ] && break
    sleep 1
  done
  [ -n "$id" ] || return 1
  curl -fsS "$MAILPIT/api/v1/message/$id" | jq -r '.Text'
}

# До подтверждения адреса чувствительные действия закрыты; ссылка из письма подтверждает адрес один раз
expect 403 "создание сейфа до подтверждения адреса" -b "$JAR" -X POST "$BASE/api/vaults" "${JSON[@]}" -d '{"name":"Smoke vault"}'
VERIFY_TOKEN=$(mail_text "$EMAIL" "подтвердите адрес" | grep -oE 'verify-email#token=[A-Za-z0-9_-]+' | head -1 | sed 's/.*token=//') || fail "письмо подтверждения не дошло до почтового sandbox"
[ -n "$VERIFY_TOKEN" ] || fail "в письме подтверждения нет токена"
expect 201 "подтверждение адреса по ссылке из письма" -X POST "$BASE/api/auth/verify-email" "${JSON[@]}" -d "{\"token\":\"$VERIFY_TOKEN\"}"
expect 410 "ссылка подтверждения одноразовая" -X POST "$BASE/api/auth/verify-email" "${JSON[@]}" -d "{\"token\":\"$VERIFY_TOKEN\"}"
expect 201 "создание сейфа после подтверждения" -b "$JAR" -X POST "$BASE/api/vaults" "${JSON[@]}" -d '{"name":"Smoke vault"}'

# Письмо восстановления доходит по SMTP до sandbox; пользователь без сейфа тоже получает его (здесь сейф есть, но не нужен)
expect 201 "forgot-password: известный адрес" -X POST "$BASE/api/auth/forgot-password" "${JSON[@]}" -d "{\"email\":\"$EMAIL\"}"
expect 201 "forgot-password: неизвестный адрес (ответ тот же)" -X POST "$BASE/api/auth/forgot-password" "${JSON[@]}" -d '{"email":"nobody-smoke@test.local"}'
RESET_TOKEN=$(mail_text "$EMAIL" "восстановление пароля" | grep -oE '[0-9a-f]{64}' | head -1) || fail "письмо восстановления не дошло до почтового sandbox"
[ -n "$RESET_TOKEN" ] || fail "в письме нет токена сброса"
[ "$(curl -fsS "$MAILPIT/api/v1/messages" | jq -r '[.messages[] | select(any(.To[]; .Address == "nobody-smoke@test.local"))] | length')" = "0" ] || fail "письмо ушло на неизвестный адрес"
echo "ok  письмо восстановления доставлено в sandbox"
expect 201 "reset-password по токену из письма" -X POST "$BASE/api/auth/reset-password" "${JSON[@]}" -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"smoke-pass-456\"}"
expect 401 "токен одноразовый" -X POST "$BASE/api/auth/reset-password" "${JSON[@]}" -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"smoke-pass-789\"}"
expect 201 "логин с новым паролем" -X POST "$BASE/api/auth/login" "${JSON[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass-456\"}"

"${COMPOSE[@]}" run --rm migrate npx prisma db seed
expect 201 "логин seed-админа" -c "$JAR" -X POST "$BASE/api/auth/login" "${JSON[@]}" -d '{"email":"admin@example.com","password":"smoke-admin-password"}'
expect 200 "админский маршрут /users" -b "$JAR" "$BASE/api/users"

echo "SMOKE OK"
