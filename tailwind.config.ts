import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // KB 옐로우 계열 — 강조·포커스에만 제한적으로 사용
        kb: {
          50: "#FFFBEA",
          100: "#FFF3C4",
          200: "#FCE588",
          300: "#FADB5F",
          400: "#FFD400",
          500: "#FFBC00",
          600: "#E0A400",
          700: "#A97C00",
          800: "#7C5B00",
          900: "#3F3018",
        },
      },
    },
  },
  plugins: [],
};
export default config;
