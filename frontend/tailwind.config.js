/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bangladesh-green': '#006A4E',
        'bangladesh-red': '#F42A41',
      },
      fontFamily: {
        'bangla': ['Noto Sans Bengali', 'sans-serif'],
      }
    },
  },
  plugins: [],
}