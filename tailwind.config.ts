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
        // KB 브랜드 가이드 기준. 500·400 은 가이드 원색이므로 임의로 바꾸지 마라.
        kb: {
          50: "#FFFBEA",
          100: "#FFF3C4",
          200: "#FCE588",
          300: "#FADB5F",
          400: "#FFCC00", // KB Yellow Negative (Pantone 1235 C)
          500: "#FFBC00", // KB Yellow Positive (Pantone 130 C) — 메인 컬러
          600: "#E0A400",
          700: "#A97C00",
          800: "#7C5B00",
          900: "#3F3018",
        },
        // KB Gray 계열. 노랑과 같은 웜톤이라 브랜드 영역(워드마크·푸터)에만 쓰고,
        // 판정 결과처럼 정보 위계가 중요한 곳은 기존 slate(쿨톤)를 유지한다 — 섞으면 탁해진다.
        kbgray: {
          DEFAULT: "#60584C", // KB Gray (Pantone 404 C)
          dark: "#545045",    // KB Dark Gray (Pantone 411 C)
        },
      },
    },
  },
  plugins: [],
};
export default config;
