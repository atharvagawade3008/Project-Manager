/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a0b',
        surface: '#101012',
        'surface-elevated': '#19191d',
        'surface-card': '#121214',
        'surface-border': '#232327',

        // Neutral charcoal scale — the whole interface is built on this.
        slate: {
          50: '#f7f7f8',
          100: '#ededf0',
          200: '#d9d9de',
          300: '#b9b9c1',
          400: '#8e8e98',
          500: '#6e6e78',
          600: '#56565f',
          700: '#3f3f47',
          800: '#2a2a30',
          850: '#222227',
          900: '#1b1b1f',
          950: '#121215',
        },

        // Slate-blue kept only for informational accents.
        blue: {
          50: '#f0f3f8',
          100: '#dfe6f0',
          200: '#c3cfe0',
          300: '#a3b3c9',
          400: '#8595ad',
          500: '#6a7a92',
          600: '#556378',
          700: '#465364',
          800: '#3b4654',
          900: '#333c47',
          950: '#1c2229',
        },

        // The single accent: ember orange.
        cyan: {
          50: '#fff4ee',
          100: '#ffe6d9',
          200: '#ffc9ae',
          300: '#ffa981',
          400: '#ff8b5c',
          500: '#f96d3d',
          600: '#e85a2c',
          700: '#c44721',
          800: '#9c3a1d',
          900: '#7c311b',
          950: '#2c150e',
        },

        // Warm tangerine, used for secondary chart series.
        sky: {
          50: '#fff6ee',
          100: '#ffe9d6',
          200: '#ffd0ac',
          300: '#ffb37b',
          400: '#ff9a55',
          500: '#f68a3f',
          600: '#dd7130',
          700: '#b85926',
          800: '#914721',
          900: '#743b1e',
          950: '#2f1710',
        },

        // Muted clay, tertiary data.
        indigo: {
          50: '#fdf1ea',
          100: '#fbe1d3',
          200: '#f6c3ab',
          300: '#eda282',
          400: '#e08e5a',
          500: '#cd7440',
          600: '#b25e32',
          700: '#904b2b',
          800: '#743e27',
          900: '#5f3522',
          950: '#2e1a12',
        },

        primary: {
          50: '#fff4ee',
          100: '#ffe4d6',
          200: '#ffc6ab',
          300: '#ffb083',
          400: '#ff8c53',
          500: '#f96d3d',
          600: '#e0562a',
          700: '#b8431f',
          800: '#93381d',
          900: '#77301c',
          950: '#2b1409',
        },

        accent: '#f96d3d',
        navy: {
          900: '#131316',
          950: '#0c0c0e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        sans: ['Inter', 'General Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'General Sans', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -18px rgba(0,0,0,0.9)',
        lift: '0 18px 46px -22px rgba(0,0,0,0.95)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
