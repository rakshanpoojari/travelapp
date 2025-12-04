/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        sky: {
          100: '#e0f2fe',
          500: '#0ea5e9',
          700: '#0369a1',
        },
        indigo: {
          600: '#4f46e5',
        },
        blue: {
          100: '#dbeafe',
          600: '#2563eb',
        },
        gray: {
          50: '#f9fafb',
          200: '#e5e7eb',
          300: '#d1d5db',
          700: '#374151',
        },
        red: {
          500: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
