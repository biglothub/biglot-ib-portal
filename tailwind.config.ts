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
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' }
        },
        'dropdown-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'progress-bar': 'progress-bar 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'dropdown-in': 'dropdown-in 0.15s ease-out'
      },
      colors: {
        dark: {
          bg: 'var(--c-bg)',
          surface: 'var(--c-surface)',
          border: 'var(--c-border)',
          hover: 'var(--c-hover)',
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
