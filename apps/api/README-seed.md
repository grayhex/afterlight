# Prisma seed

To initialise the database locally:

1. Ensure a PostgreSQL instance is running and set `DATABASE_URL`.
2. Optionally set `ADMIN_PASSWORD` to override the default admin password (`admin`).
3. Run:

```sh
npx prisma migrate deploy
npx prisma db seed
```

All secrets must be provided through secret management (GitHub Secrets, Kubernetes Secrets, etc.) and never committed to the repository.
