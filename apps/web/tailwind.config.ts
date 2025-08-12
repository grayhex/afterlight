import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#e2e8f0",
        sky: "#38bdf8",
        leaf: "#34d399",
        rose: "#fb7185"
      },
      boxShadow: {
        soft: "0 6px 30px rgba(2,6,23,0.08)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    },
  },
  plugins: [],
} satisfies Config;
