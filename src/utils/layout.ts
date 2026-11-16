import { useWindowDimensions } from 'react-native';

/** Lebar konten maksimum, sama dengan konstanta web di `constants/theme`. */
export const CONTENT_MAX_WIDTH = 800;

export interface LayoutTier {
  /** hp kecil (< 360dp), mis. iPhone SE / Android low-end */
  isCompact: boolean;
  /** tablet / layar lebar (>= 768dp) */
  isWide: boolean;
  /** padding horizontal yang disarankan untuk kontainer utama */
  gutter: number;
  /** jumlah kolom untuk grid kartu (mis. beban kerja) */
  columns: 1 | 2 | 3;
}

/**
 * Aturan tata letak lintas ukuran layar.
 *
 * Dipisah dari komponen supaya ambangnya bisa diuji tanpa merender apa pun.
 */
export function resolveLayoutTier(width: number): LayoutTier {
  const isCompact = width < 360;
  const isWide = width >= 768;

  return {
    isCompact,
    isWide,
    gutter: isCompact ? 12 : isWide ? 32 : 16,
    columns: isWide ? (width >= 1080 ? 3 : 2) : 1,
  };
}

export function useResponsiveLayout(): LayoutTier & { width: number } {
  const { width } = useWindowDimensions();
  return { width, ...resolveLayoutTier(width) };
}
