import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cafe: {
          bg: "#FAF6F0",
          text: "#3E2C1C",
          accent: "#C4724E",
          card: "#FFF8F0",
          button: "#5C3D2E",
          success: "#6B8E5A",
          danger: "#C25550",
        },
      },
      fontFamily: {
        serif: ["Noto Serif JP", "serif"],
        sans: ["Zen Maru Gothic", "sans-serif"],
      },
      borderRadius: {
        cafe: "12px",
        "cafe-lg": "16px",
      },
      boxShadow: {
        cafe: "0 2px 8px rgba(62,44,28,0.08)",
        "cafe-lg": "0 4px 16px rgba(62,44,28,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
