import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          ink: "#070b08",
          panel: "#101610",
          line: "#2a3828",
          mist: "#c5d2c2",
          amber: "#e6a31a",
          moss: "#6fbf73",
          infer: "#c084fc",
          observe: "#fb923c",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-ibm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        instrument: "0 12px 40px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
