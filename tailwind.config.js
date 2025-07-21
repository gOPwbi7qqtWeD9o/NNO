/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['Fira Code', 'Monaco', 'Cascadia Code', 'Ubuntu Mono', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#0a0a0a',
          text: '#cc9966',
          amber: '#d4a574',
          rust: '#b8956a',
          dim: '#8c7456',
          bright: '#e6c088',
          dark: '#665544',
        }
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
