import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: "#0a0e1a",
        panel: "#12172a",
        panel2: "#1a2138",
        accent: "#ff8a00",
        accent2: "#00c2ff",
        border: "#2a3352",
      },
    },
  },
  plugins: [],
};

export default config;
