import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        card: 'var(--color-card)',
        accent: 'var(--color-accent)',
        text: 'var(--color-text)',
      },
    },
  },
  plugins: [],
} satisfies Config;
