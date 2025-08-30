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
      keyframes: {
        'card-fade': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'icon-pop': {
          '0%': { opacity: 0, transform: 'scale(0.8)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'card-fade': 'card-fade 0.6s ease both',
        'icon-pop': 'icon-pop 0.3s ease both',
      },
    },
  },
  plugins: [],
} satisfies Config;
