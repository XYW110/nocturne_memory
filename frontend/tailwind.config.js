/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nocturne: {
          bg: {
            primary: "#07070D",
            secondary: "#0A0A12",
            tertiary: "#0C0C16",
            hover: "#0F0F1A",
          },
          border: {
            DEFAULT: "rgba(30,41,59,0.5)",
            light: "rgba(51,65,85,0.4)",
            strong: "rgba(51,65,85,0.6)",
          },
          text: {
            primary: "#E2E8F0",
            secondary: "#94A3B8",
            muted: "#64748B",
          },
        },
      },
    },
  },
  plugins: [],
};
