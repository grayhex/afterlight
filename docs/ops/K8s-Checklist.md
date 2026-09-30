> **Статус: непервостепенный путь.** Основной путь запуска — Docker Compose (`docs/deploy.md`). Манифесты `k8s/` сохранены как экспериментальные (предложение D9 в [`docs/mvp-contract.md`](../mvp-contract.md): не удалять, но не считать основной инструкцией).

# K8s Checklist

- [ ] Namespace, Secrets, ConfigMap
- [ ] Deployment (+ probes), Service
- [ ] Ingress + TLS
- [ ] Autoscaling (минимум HPA=1..2)
- [ ] Логи/мониторинг (liveness/readiness, базовые метрики)
