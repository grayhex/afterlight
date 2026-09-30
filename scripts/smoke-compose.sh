#!/usr/bin/env bash
# Smoke-проверка контейнеров: собирает образы, поднимает PostgreSQL + migrate + api + web из docker-compose.server.yml
# и проходит основной путь через web-прокси: health, регистрация, логин, защищённая страница, seed-админ.
# Запуск: scripts/smoke-compose.sh   (нужен Docker; БД и секреты одноразовые, том удаляется в конце)
set -euo pipefail

cd "$(dirname "$0")/.."
export COMPOSE_PROJECT_NAME=afterlight-smoke
export ENV_FILE="$(mktemp)"
export WEB_PORT="${WEB_PORT:-18080}"
COMPOSE=(docker compose -f docker-compose.server.yml)
BASE="http://127.0.0.1:${WEB_PORT}"
JAR="$(mktemp)"

cat > "$ENV_FILE" <<ENV
JWT_SECRET=smoke-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
NODE_ENV=production
CORS_ALLOWED_ORIGINS=${BASE}
COOKIE_SECURE=false
WEB_BASE_URL=${BASE}
ADMIN_PASSWORD=smoke-admin-password
POSTGRES_DB=afterlight
POSTGRES_USER=afterlight
POSTGRES_PASSWORD=smoke-db-password
DATABASE_URL=postgresql://afterlight:smoke-db-password@db:5432/afterlight?schema=public
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

"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d db
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
expect 200 "/auth/me по cookie" -b "$JAR" "$BASE/api/auth/me"
expect 200 "/cabinet по cookie (middleware передаёт cookie)" -b "$JAR" "$BASE/cabinet"
expect 201 "создание сейфа" -b "$JAR" -X POST "$BASE/api/vaults" "${JSON[@]}" -d '{"name":"Smoke vault"}'

"${COMPOSE[@]}" run --rm migrate npx prisma db seed
expect 201 "логин seed-админа" -c "$JAR" -X POST "$BASE/api/auth/login" "${JSON[@]}" -d '{"email":"admin@example.com","password":"smoke-admin-password"}'
expect 200 "админский маршрут /users" -b "$JAR" "$BASE/api/users"

echo "SMOKE OK"
