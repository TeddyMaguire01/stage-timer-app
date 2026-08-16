import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      colors: {
        timer: {
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
        },
        brand: {
          pink: "#FF3D8A",
          "pink-hover": "#FF5FA0",
          purple: "#8B5CF6",
          blue: "#3B82F6",
        },
      },
      keyframes: {
        flash: {
          "0%, 100%": { backgroundColor: "#000000" },
          "50%": { backgroundColor: "#7f1d1d" },
        },
      },
      animation: {
        flash: "flash 1s steps(1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
