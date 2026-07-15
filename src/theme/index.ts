import { MD3DarkTheme, MD3LightTheme, configureFonts, useTheme, type MD3Theme } from 'react-native-paper';

// ── Tipografía ───────────────────────────────────────────────────────────
// El diseño usa Plus Jakarta Sans para texto y Space Grotesk para números.
// Los nombres deben coincidir con las claves cargadas por useFonts en _layout.
export const FONT_SANS = 'PlusJakartaSans_400Regular';
export const FONT_SANS_MEDIUM = 'PlusJakartaSans_500Medium';
export const FONT_SANS_SEMIBOLD = 'PlusJakartaSans_600SemiBold';
export const FONT_SANS_BOLD = 'PlusJakartaSans_700Bold';
export const FONT_SANS_EXTRABOLD = 'PlusJakartaSans_800ExtraBold';
export const FONT_MONO = 'SpaceGrotesk_700Bold';

// react-native-paper ignora fontWeight cuando la familia es una fuente custom:
// hay que apuntar a la variante concreta. Este mapa traduce los pesos que usa
// la app a la familia correspondiente.
export const fontFamilyForWeight = (weight?: string): string => {
  switch (weight) {
    case '800':
    case '900':
      return FONT_SANS_EXTRABOLD;
    case '700':
      return FONT_SANS_BOLD;
    case '600':
      return FONT_SANS_SEMIBOLD;
    case '500':
      return FONT_SANS_MEDIUM;
    default:
      return FONT_SANS;
  }
};

const appFonts = configureFonts({
  config: {
    fontFamily: FONT_SANS,
  },
});

// ── Marca ────────────────────────────────────────────────────────────────
// Azul institucional (se mantiene). Sumamos un acento cian vivo para CTAs,
// foco y links, y colores semánticos claros para estados.
export const BRAND_BLUE = '#052653';
export const BRAND_BLUE_SOFT = '#E7EEF6';
export const BRAND_BLUE_MID = '#6E87A7';
export const BRAND_GREEN = '#15803D';
export const BRAND_GREEN_SOFT = '#E7F6EC';
export const BRAND_GREEN_MID = '#BEE6C9';
export const BRAND_YELLOW = '#8A5A00';
export const BRAND_YELLOW_SOFT = '#FBEFD2';
export const BRAND_YELLOW_MID = '#F2D89A';

// Acento nuevo (cian)
export const BRAND_CYAN = '#06B6D4';
export const BRAND_CYAN_DARK = '#0891B2';
export const BRAND_CYAN_SOFT = '#E0F7FC';

type AppExtendedColors = {
  softBlue: string;
  softGreen: string;
  softYellow: string;
  softYellowStrong: string;
  onSoftYellow: string;
  softBlueStrong: string;
  softGreenStrong: string;
  tableHeaderBg: string;
  surfaceMuted: string;
  surfaceAlt: string;
  surfaceSoft: string;
  borderSoft: string;
  textMuted: string;
  titleOnSoft: string;
  dialogSurface: string;
  toastSuccessSurface: string;
  toastSuccessText: string;
  toastErrorSurface: string;
  toastErrorText: string;
  // Acento
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
};

export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & AppExtendedColors;
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  fonts: appFonts,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    background: '#F4F6F9',
    surface: '#FFFFFF',
    surfaceVariant: '#EAEFF5',
    primary: BRAND_BLUE,
    secondary: BRAND_CYAN,
    outline: '#CBD5E1',
    error: '#DC2626',
    softBlue: '#E2F4FB',
    softGreen: BRAND_GREEN_SOFT,
    softYellow: BRAND_YELLOW_SOFT,
    softYellowStrong: BRAND_YELLOW_MID,
    onSoftYellow: BRAND_YELLOW,
    softBlueStrong: '#B9E4F2',
    softGreenStrong: BRAND_GREEN_MID,
    tableHeaderBg: '#EAEFF5',
    surfaceMuted: '#F7F9FC',
    surfaceAlt: '#F8FAFC',
    surfaceSoft: '#F8FAFC',
    borderSoft: '#E4E9F0',
    textMuted: '#64748B',
    titleOnSoft: '#0F1B2D',
    dialogSurface: '#FFFFFF',
    toastSuccessSurface: '#EAF7EE',
    toastSuccessText: '#15803D',
    toastErrorSurface: '#FDECEC',
    toastErrorText: '#B91C1C',
    accent: BRAND_CYAN,
    accentStrong: BRAND_CYAN_DARK,
    accentSoft: BRAND_CYAN_SOFT,
    onAccent: '#02323D',
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  fonts: appFonts,
  roundness: 12,
  colors: {
    ...MD3DarkTheme.colors,
    background: '#0B1220',
    surface: '#131C2B',
    surfaceVariant: '#1E2A3D',
    primary: '#8FD8EE',
    secondary: '#5FD3EE',
    outline: '#3A4A5E',
    error: '#FFB4AB',
    softBlue: '#173044',
    softGreen: '#183527',
    softYellow: '#3D3212',
    softYellowStrong: '#6E5A22',
    onSoftYellow: '#F2D89A',
    softBlueStrong: '#2C4A63',
    softGreenStrong: '#2E5240',
    tableHeaderBg: '#25344A',
    surfaceMuted: '#1A2536',
    surfaceAlt: '#16202F',
    surfaceSoft: '#1B2739',
    borderSoft: '#2A3A4F',
    textMuted: '#9FB0C4',
    titleOnSoft: '#EAF2FB',
    dialogSurface: '#16202F',
    toastSuccessSurface: '#173226',
    toastSuccessText: '#C9EED4',
    toastErrorSurface: '#3A2126',
    toastErrorText: '#FFD9DE',
    accent: '#22C3E6',
    accentStrong: '#5FD3EE',
    accentSoft: '#12303B',
    onAccent: '#02323D',
  },
};

export const appTheme = lightTheme;

export const useAppTheme = () => useTheme<AppTheme>();
