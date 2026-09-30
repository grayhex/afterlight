import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Новое строгое правило React Compiler-эры. Нынешний кабинет грузит данные в эффектах;
      // переработка кабинета — задача #153, до неё правило остаётся предупреждением, а не блокером CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/api.ts']),
]);
