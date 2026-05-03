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
          bg: 'rgb(var(--c-bg-rgb) / <alpha-value>)',
          surface: 'rgb(var(--c-surface-rgb) / <alpha-value>)',
          'surface-2': 'rgb(var(--c-surface-2-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--c-bg-elevated-rgb) / <alpha-value>)',
          border: 'rgb(var(--c-border-rgb) / <alpha-value>)',
          hover: 'rgb(var(--c-hover-rgb) / <alpha-value>)',
        },
        brand: {
          primary: 'rgb(var(--c-brand-rgb) / <alpha-value>)',
          50:  '#FDF8E8',
          100: '#F9EDCC',
          200: '#F0D98A',
          300: '#E8C84D',
          400: 'rgb(var(--c-brand-soft-rgb) / <alpha-value>)',
          500: 'rgb(var(--c-brand-rgb) / <alpha-value>)',
          600: 'rgb(var(--c-brand-rgb) / <alpha-value>)',
          700: 'rgb(var(--c-brand-deep-rgb) / <alpha-value>)',
        },
        app: {
          text: 'var(--c-text-primary)',
          strong: 'var(--c-text-strong)',
          secondary: 'var(--c-text-secondary)',
          muted: 'var(--c-text-muted)',
          panel: 'rgb(var(--c-surface-rgb) / <alpha-value>)',
        },
        success: 'rgb(var(--c-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--c-warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--c-danger-rgb) / <alpha-value>)',
      }
    }
  },

  plugins: []
} as Config;
