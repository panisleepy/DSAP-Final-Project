import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandBlue: "#a7c7ff",
        brandPink: "#ffd6e7",
        brandText: "#1f1f1f",
      },
      boxShadow: {
        card: "0 10px 40px -25px rgba(167, 199, 255, 0.8)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "soft-pop": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "60%": { transform: "scale(1.02)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "soft-pop": "soft-pop 0.28s ease-out",
      },
      backgroundImage: {
        "murmur-card":
          "linear-gradient(145deg, rgba(167,199,255,0.38), rgba(255,214,231,0.42))",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;


