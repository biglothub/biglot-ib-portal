import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: 'class',

  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Thai',
          'Inter',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      keyframes: {
        'progress-bar': {
          '0%': { width: '0%', opacity: '1' },
          '50%': { width: '70%', opacity: '1' },
          '90%': { width: '95%', opacity: '1' },
          '100%': { width: '95%', opacity: '1' }
        }
      },
      animation: {
        'progress-bar': 'progress-bar 2s ease-in-out infinite'
      },
      colors: {
        dark: {
          bg: '#0a0a0a',
          surface: '#141414',
          border: '#262626',
          hover: '#1a1a1a',
        },
        brand: {
          primary: '#C9A84C',
          50:  '#FDF8E8',
          100: '#F9EDCC',
          200: '#F0D98A',
          300: '#E8C84D',
          400: '#D4AF37',
          500: '#C9A84C',
          600: '#B8962E',
          700: '#8B7635',
        },
        success: '#22c55e',
        warning: '#f97316',
        danger: '#ef4444',
      }
    }
  },

  plugins: []
} as Config;
