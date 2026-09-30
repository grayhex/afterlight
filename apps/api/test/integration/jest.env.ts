// В integration-тестах значения по умолчанию не подставляются: нужна настоящая БД.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost';
