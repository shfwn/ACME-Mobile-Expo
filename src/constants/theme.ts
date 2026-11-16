/**
 * ACME Mobile Design System & Theme Tokens
 * Harmonized with ACME Workspace Web Brand Identity
 */

import { Platform } from 'react-native';

export const BrandColors = {
  // Brand Primaries
  primary: '#38507A',
  primaryDark: '#283B5C',
  primaryLight: '#4E6C9E',
  periwinkle: '#6C7EC2',
  periwinkleLight: '#7B8BC7',
  periwinkleBg: '#EEF2FF',

  // Status & Priority Colors
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#3B82F6',
  low: '#10B981',

  // Semantic UI
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  // Pastel Category Accents (from Web Brand Reference)
  pastels: {
    yellow: {
      bg: '#FFF8E1',
      badge: '#FFE28A',
      border: '#F6D268',
      text: '#8A6700',
    },
    pink: {
      bg: '#FFF0F3',
      badge: '#F5A8B8',
      border: '#F08B9F',
      text: '#9C2A44',
    },
    mint: {
      bg: '#E8FAF5',
      badge: '#8CE5D0',
      border: '#6CD9C0',
      text: '#166E58',
    },
    periwinkle: {
      bg: '#F0F3FF',
      badge: '#C7D2FE',
      border: '#93A4EC',
      text: '#283674',
    },
  },
} as const;

/**
 * Token khusus halaman to-do.
 *
 * Dasar: netral hangat-sedikit (slate) agar teks tidak menyilaukan di layar
 * terang, dengan satu aksen untuk aksi. Warna kategori HANYA dipakai sebagai
 * dot pengenal, bukan latar kartu.
 */
export const TodoColors = {
  canvas: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F4F7',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',

  title: '#101828',
  body: '#475467',
  muted: '#667085',
  faint: '#98A2B3',

  accent: '#38507A',
  accentSoft: '#EDF1F8',
  success: '#127A5B',
  successSoft: '#E7F5EF',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
} as const;

/**
 * Warna pengenal kategori. Dirancang sama-sama gelap (L* ±55) supaya tidak ada
 * satu pun yang menonjol, dan aman untuk buta warna merah-hijau.
 */
export const CategoryDotColors: Readonly<Record<string, string>> = {
  Kerja: '#3E63A8',
  Pribadi: '#7A5AA8',
  Fokus: '#1F7A6B',
  Penting: '#A8563E',
};

export const CATEGORY_DOT_FALLBACK = '#667085';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    background: '#FFFFFF',
    backgroundElement: '#F8FAFC',
    backgroundSelected: '#EEF2F6',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    card: '#FFFFFF',
    primary: BrandColors.primary,
    tint: BrandColors.primary,
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    background: '#090D16',
    backgroundElement: '#131B2A',
    backgroundSelected: '#1C283F',
    border: '#1E293B',
    borderLight: '#172033',
    card: '#101726',
    primary: BrandColors.periwinkle,
    tint: BrandColors.periwinkle,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 44, android: 68 }) ?? 56;
export const MaxContentWidth = 800;
