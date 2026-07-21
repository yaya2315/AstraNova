import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#000000',
          900: '#04080F',
          800: '#080F1A',
          700: '#0C1525',
          600: '#111E30',
        },
        accent: {
          purple:  '#7B61FF',
          cyan:    '#00F0FF',
          gold:    '#F0C060',
          rose:    '#F472B6',
          emerald: '#34D399',
          indigo:  '#818CF8',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        serif:   ['Outfit', 'sans-serif'],
      },
      animation: {
        'spin-slow':   'spin 20s linear infinite',
        'spin-slower': 'spin 40s linear infinite',
        'float':       'float 7s ease-in-out infinite',
        'glow':        'glow 3s ease-in-out infinite alternate',
        'shimmer':     'shimmer 3s ease-in-out infinite',
        'orbit':       'orbit 8s linear infinite',
        'fade-in-up':  'fadeInUp 0.9s ease-out forwards',
        'auroraWave':  'auroraWave 25s ease-in-out infinite',
        'pulse-glow':  'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        glow: {
          from: { boxShadow: '0 0 15px rgba(110,231,255,0.15)' },
          to:   { boxShadow: '0 0 40px rgba(110,231,255,0.35)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '1' },
        },
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        auroraWave: {
          '0%, 100%': { transform: 'translateY(0px) skewY(2deg)', opacity: '0.06' },
          '25%':      { transform: 'translateY(-80px) skewY(-1deg)', opacity: '0.12' },
          '50%':      { transform: 'translateY(-120px) skewY(3deg)', opacity: '0.08' },
          '75%':      { transform: 'translateY(-60px) skewY(-2deg)', opacity: '0.14' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 6px rgba(110,231,255,0.3)' },
          '50%':      { boxShadow: '0 0 18px rgba(110,231,255,0.6), 0 0 40px rgba(110,231,255,0.15)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
