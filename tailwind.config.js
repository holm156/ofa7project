/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Crimson theme
        primary: '#dc143c', // Crimson
        primaryHover: '#b90f30', // Darker Crimson
        primaryDark: '#8b0000', // Dark Red
        secondary: '#06b6d4', // Cyan-500 for secondary tags
        // Backgrounds (Deep Crimson/Black)
        background: '#000000', // Pitch black
        surface: 'rgba(255, 255, 255, 0.03)', // Translucent surface for glassmorphism
        surfacePill: 'rgba(255, 255, 255, 0.05)',
        surfacePillHover: 'rgba(255, 255, 255, 0.1)',
        surfaceHighlight: 'rgba(255, 255, 255, 0.08)',
        surfaceDarker: 'rgba(0, 0, 0, 0.5)',
        
        // Text
        text: '#f8fafc', // Slate-50
        textMuted: '#94a3b8', // Slate-400
      },
      backgroundImage: {
        'dusk-gradient': 'linear-gradient(to right, #dc143c, #8b0000)', // Crimson to Dark Red
        'aurora-glow': 'radial-gradient(circle at 50% -20%, #8b0000, transparent 60%)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'sans-serif'], 
      },
    },
  },
  plugins: [],
};