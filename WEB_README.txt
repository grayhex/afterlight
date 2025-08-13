# afterlight — web deployment (SPA vs SSR)

Выберите вариант:
- **SPA (static, Vite/CRA/Nuxt static/Next export)**: используйте `Dockerfile.web`, workflow `docker-web.yml` и манифест `k8s/deploy-web.yaml` (Nginx:80).
- **SSR (Next.js runtime)**: используйте `Dockerfile.next`, workflow `docker-web-ssr.yml` и манифест `k8s/deploy-web-ssr.yaml` (Node:3000).

## Редеплой на сервере (оба варианта)
```bash
# первый деплой/обновление манифестов
kubectl -n afterlight apply -f k8s/deploy-web.yaml        # SPA
# или
kubectl -n afterlight apply -f k8s/deploy-web-ssr.yaml    # SSR

kubectl -n afterlight rollout status deploy/afterlight-web

# быстрый редеплой на последний :main
kubectl -n afterlight rollout restart deploy/afterlight-web

# «по-взрослому» — зафиксироваться на конкретном артефакте
SHA=<FULL_GITHUB_SHA>
kubectl -n afterlight set image deploy/afterlight-web   web=ghcr.io/grayhex/afterlight-web:${SHA}
kubectl -n afterlight rollout status deploy/afterlight-web
```

Не забудьте в коде фронта указывать base URL API: `https://api.afterl.ru`.
Если ваш бандлер кладёт сборку в нестандартную папку — поправьте шаг нормализации в `Dockerfile.web`.
