# afterlight — web deployment configs

These files set up a simple SPA (React/Vite/etc.) front end built with **Node 20** and served by **Nginx** in Kubernetes.
- Build with GitHub Actions → GHCR image `ghcr.io/grayhex/afterlight-web`.
- Deploy to k3s namespace `afterlight` with TLS for `afterl.ru` and `www.afterl.ru` via cert-manager (issuer `letsencrypt-prod`).

If your bundler outputs to a folder other than `dist` (e.g., `build`), change the path in `Dockerfile.web`:
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
→ to
COPY --from=build /app/apps/web/build /usr/share/nginx/html

For API calls from the front end, point your base URL to `https://api.afterl.ru`.
