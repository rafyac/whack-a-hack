/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#e8e0cc',
        muted: '#a6b1aa',
        paper: '#182124',
        sand: '#202c2e',
        cobalt: '#f48150',
        coral: '#f48150',
        ticket: '#22312f',
        night: '#11191b',
        carnival: {
          purple: '#c2b3db',
          pink: '#ffac98',
          cyan: '#84b6af',
          lime: '#a9cba5',
          yellow: '#e2bc7c',
          indigo: '#1E1B4B',
          deep: '#0B0A26',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 24px rgba(236,72,153,0.45), 0 0 60px rgba(124,58,237,0.35)',
        glow: '0 0 16px rgba(6,182,212,0.55)',
      },
      backgroundImage: {
        'carnival-gradient':
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.45), transparent 45%), radial-gradient(circle at 80% 20%, rgba(236,72,153,0.40), transparent 50%), radial-gradient(circle at 50% 90%, rgba(6,182,212,0.35), transparent 55%), linear-gradient(180deg, #0B0A26 0%, #1E1B4B 100%)',
      },
      animation: {
        'wiggle': 'wiggle 0.4s ease-in-out',
        'pop': 'pop 0.25s ease-out',
      },
      keyframes: {
        wiggle: {
          '0%,100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
        pop: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
