import colors from 'tailwindcss/colors.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0F1E36',
        emerald: { ...colors.emerald, DEFAULT: '#10B981' },
        amber: { ...colors.amber, DEFAULT: '#F59E0B' },
        canvas: '#F8FAFC',
        line: '#E2E8F0',
        secondary: '#475569',
        muted: '#94A3B8'
      },
      boxShadow: {
        card: '0 8px 24px rgba(15, 30, 54, 0.06)',
      },
    },
  },
  plugins: [],
};
