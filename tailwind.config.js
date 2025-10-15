/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #667eea 0%, #3AE09A 25%, #3b82f6 50%, #8b5cf6 75%, #ec4899 100%)',
      },
      colors: {
        themeGreen: '#3AE09A',
        themeDark: '#3b3b3b',
        btnPrimary: '#8129D9',
        btnPrimaryAlt: '#5D18A2',
        themeYellow: '#F1BC00',
        themeYellowLight: '#FFF1BF',
      },
      width: {
        'clamp': 'clamp(15rem, 20rem, 25rem)',
      },
      animation: {
        'gradient-flow': 'gradient-flow 8s ease infinite',
        'mesh-gradient': 'gradient-shift 15s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'scale-pulse': 'scale-pulse 2s ease-in-out infinite',
        'success-bounce': 'success-bounce 0.6s ease-out',
        'error-shake': 'error-shake 0.4s ease-out',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
