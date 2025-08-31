# Prisma seed

To initialise the database locally:

1. Ensure a PostgreSQL instance is running and set `DATABASE_URL`.
2. Optionally set `ADMIN_PASSWORD` to override the default admin password (`admin`).
3. Build the project so the seed script is compiled:

```sh
npm run build
```

4. Apply migrations and seed:

```sh
npx prisma migrate deploy
npx prisma db seed
```

All secrets must be provided through secret management (GitHub Secrets, Kubernetes Secrets, etc.) and never committed to the repository.
