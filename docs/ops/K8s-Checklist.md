> **Предложение (D9 в [`docs/mvp-contract.md`](../mvp-contract.md), не принято владельцем):** считать k3s-манифесты непервостепенным путём, а основным — Docker Compose (`docs/deploy.md`). До подтверждения D9 текущий способ развёртывания не меняется.

# K8s Checklist

- [ ] Namespace, Secrets, ConfigMap
- [ ] Deployment (+ probes), Service
- [ ] Ingress + TLS
- [ ] Autoscaling (минимум HPA=1..2)
- [ ] Логи/мониторинг (liveness/readiness, базовые метрики)
