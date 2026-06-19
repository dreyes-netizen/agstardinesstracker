import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ground:   '#EDF0F4',
        navy:     '#1A2332',
        'app-text': '#1E2330',
        amber:    '#E8900A',
        'app-blue': '#2155CD',
        'nte-red':  '#C8320A',
        'safe-green': '#1A7A4A',
        muted:    '#6B7A90',
        border:   '#CDD4DC',
      },
      fontFamily: {
        mono: ["'Cascadia Code'", "'Fira Mono'", 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
