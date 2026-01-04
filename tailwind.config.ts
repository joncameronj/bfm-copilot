import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.05em',
      },
      colors: {
        brand: {
          blue: '#1E42FC',
          cyan: '#01BEF9',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1E42FC 0%, #01BEF9 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'shimmer-border': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'icon-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.2' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        'shimmer-border': 'shimmer-border 3s linear infinite',
        'icon-pulse': 'icon-pulse 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
