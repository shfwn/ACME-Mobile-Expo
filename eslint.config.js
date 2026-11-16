// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Skrip perkakas skill, bukan kode aplikasi — Node global-nya bukan
      // lingkungan yang lint ini konfigurasi (Buffer, __dirname, dsb).
      '.agents/**',
      '.claude/**',
    ],
  },
]);
