// Значения по умолчанию для тестов: сервисы читают их при создании.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
