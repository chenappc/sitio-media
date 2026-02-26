const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "app", "**", "*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "components", "**", "*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Source Sans 3", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Merriweather", "Georgia", "serif"],
      },
      colors: {
        rojo: "#d62828",
        negro: "#111111",
      },
    },
  },
  plugins: [],
};
