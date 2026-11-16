/**
 * Token Tailwind diselaraskan dengan `src/constants/theme.ts` (BrandColors).
 * Nilai di bawah adalah salinan resmi palet ACME Workspace, bukan tebakan.
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#38507A',
          dark: '#283B5C',
          light: '#4E6C9E',
          periwinkle: '#6C7EC2',
          'periwinkle-light': '#7B8BC7',
          'periwinkle-bg': '#EEF2FF',
        },
        pastel: {
          yellow: '#FFE28A',
          coral: '#F5A8B8',
          mint: '#8CE5D0',
        },
      },
    },
  },
  plugins: [],
};
