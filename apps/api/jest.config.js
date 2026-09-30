// Два проекта. unit — изолированные тесты с моками. integration — HTTP-запросы к настоящему приложению
// (те же guard'ы и pipes, что в runtime) поверх настоящего PostgreSQL; нужен DATABASE_URL к мигрированной БД.
module.exports = {
  testTimeout: 30000,
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      setupFiles: ['<rootDir>/test/unit/jest.env.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      setupFiles: ['<rootDir>/test/integration/jest.env.ts'],
    },
  ],
};
