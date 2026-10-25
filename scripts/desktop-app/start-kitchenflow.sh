#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="/Users/admin/Desktop/iShop"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$HOME/.bun/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$PROJECT_ROOT"

if ! docker info >/dev/null 2>&1; then
  open -a Docker
  for _ in {1..60}; do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

docker info >/dev/null 2>&1 || {
  echo "Docker Desktop не запущен."
  exit 1
}

docker compose --env-file backend/.env up -d --wait postgres
bun run --cwd backend prisma:deploy

if ! curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
  nohup bun run dev:backend </dev/null >/tmp/kitchenflow-backend.log 2>&1 &
fi

if ! curl -fsS http://127.0.0.1:5173/login >/dev/null 2>&1; then
  nohup bun run dev:webapp -- --host 127.0.0.1 --port 5173 </dev/null >/tmp/kitchenflow-webapp.log 2>&1 &
fi

for _ in {1..60}; do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:5173/login >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Сервисы не ответили за 60 секунд."
echo "Backend:"
tail -n 20 /tmp/kitchenflow-backend.log 2>/dev/null || true
echo "Webapp:"
tail -n 20 /tmp/kitchenflow-webapp.log 2>/dev/null || true
exit 1
