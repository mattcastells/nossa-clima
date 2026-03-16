import { MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

export const BRAND_BLUE = '#052653';
export const BRAND_BLUE_SOFT = '#EAF0F7';
export const BRAND_BLUE_MID = '#6E87A7';
export const BRAND_GREEN = '#43663D';
export const BRAND_GREEN_SOFT = '#EDF3EA';
export const BRAND_GREEN_MID = '#C9DDB7';
export const BRAND_YELLOW = '#8C6C1E';
export const BRAND_YELLOW_SOFT = '#F6F1DC';
export const BRAND_YELLOW_MID = '#E7D8A4';

type AppExtendedColors = {
  softBlue: string;
  softGreen: string;
  softYellow: string;
  softBlueStrong: string;
  softGreenStrong: string;
  softYellowStrong: string;
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
};

export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & AppExtendedColors;
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  roundness: 7,
  colors: {
    ...MD3LightTheme.colors,
    background: '#F3F5F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E6EBF1',
    primary: BRAND_BLUE,
    secondary: '#3478F6',
    outline: '#BCC6D1',
    error: '#C62828',
    softBlue: '#E2ECF8',
    softGreen: '#E4EDE0',
    softYellow: '#F6F1DC',
    softBlueStrong: '#CCDDF0',
    softGreenStrong: '#D1E0CA',
    softYellowStrong: '#E7D8A4',
    surfaceMuted: '#F6F8FB',
    surfaceAlt: '#F7FAFD',
    surfaceSoft: '#F9FBFC',
    borderSoft: '#DCE4EC',
    textMuted: '#5F6A76',
    titleOnSoft: '#13263F',
    dialogSurface: '#F8F3FB',
    toastSuccessSurface: '#EAF4E6',
    toastSuccessText: '#2F5A2B',
    toastErrorSurface: '#FBEAEC',
    toastErrorText: '#92293C',
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  roundness: 7,
  colors: {
    ...MD3DarkTheme.colors,
    background: '#0F141A',
    surface: '#151C24',
    surfaceVariant: '#202A34',
    primary: '#A9C4EA',
    secondary: '#8EB8FF',
    outline: '#506171',
    error: '#FFB4AB',
    softBlue: '#2B4058',
    softGreen: '#344A39',
    softYellow: '#4B4225',
    softBlueStrong: '#3B5572',
    softGreenStrong: '#486252',
    softYellowStrong: '#665832',
    surfaceMuted: '#22303E',
    surfaceAlt: '#1B2631',
    surfaceSoft: '#23313F',
    borderSoft: '#425261',
    textMuted: '#B1BECC',
    titleOnSoft: '#F1F6FC',
    dialogSurface: '#1B2430',
    toastSuccessSurface: '#223426',
    toastSuccessText: '#D6EECF',
    toastErrorSurface: '#43252B',
    toastErrorText: '#FFD9DE',
  },
};

export const appTheme = lightTheme;

export const useAppTheme = () => useTheme<AppTheme>();
