import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-dark="true"]'],
  theme: {
    extend: {},
  },
  plugins: [
    // `mouse:` variant — rétablit le comportement desktop sur fenêtre réduite
    // (pointer: fine = souris/trackpad, pas un écran tactile)
    plugin(({ addVariant }) => {
      addVariant('mouse', '@media (pointer: fine)');
    }),
  ],
};

export default config;
