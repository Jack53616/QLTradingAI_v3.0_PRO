/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#080808',
        accent: '#7c3aed',
        soft: 'rgba(124, 58, 237, 0.2)'
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 25px rgba(124, 58, 237, 0.45)'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
