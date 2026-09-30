// Проект — ESM (Nest 12 поставляется только как ESM). Запуск: NODE_OPTIONS=--experimental-vm-modules (см. npm-скрипты).
// Два проекта. unit — изолированные тесты с моками. integration — HTTP-запросы к настоящему приложению
// (те же guard'ы и pipes, что в runtime) поверх настоящего PostgreSQL; нужен DATABASE_URL к мигрированной БД.
const esm = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' }] },
};

export default {
  testTimeout: 30000,
  projects: [
    {
      ...esm,
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      setupFiles: ['<rootDir>/test/unit/jest.env.ts'],
    },
    {
      ...esm,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      setupFiles: ['<rootDir>/test/integration/jest.env.ts'],
    },
  ],
};
