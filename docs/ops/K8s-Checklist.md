> **АРХИВ.** Владелец признал k3s избыточным (D9 в [`docs/mvp-contract.md`](../mvp-contract.md), 2026-10-01): единственный поддерживаемый путь запуска — Docker Compose (`docs/deploy.md`). Манифесты сохранены для истории, не поддерживаются и не проверяются в CI.

# K8s Checklist

- [ ] Namespace, Secrets, ConfigMap
- [ ] Deployment (+ probes), Service
- [ ] Ingress + TLS
- [ ] Autoscaling (минимум HPA=1..2)
- [ ] Логи/мониторинг (liveness/readiness, базовые метрики)
