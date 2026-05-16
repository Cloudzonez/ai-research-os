/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f7f3e9",
        jade: "#0f766e",
        cobalt: "#315a9d",
        amberline: "#bc7b26",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(15, 23, 42, 0.18)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans SC",
          "Microsoft YaHei",
          "PingFang SC",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
