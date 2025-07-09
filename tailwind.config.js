// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // ✅ THIS IS CRUCIAL
  theme: {
    extend: {},
  },
  plugins: [],
}
