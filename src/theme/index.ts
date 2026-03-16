import { MD3LightTheme } from 'react-native-paper';

export const BRAND_BLUE = '#052653';
export const BRAND_BLUE_SOFT = '#EAF0F7';
export const BRAND_BLUE_MID = '#6E87A7';
export const BRAND_GREEN = '#43663D';
export const BRAND_GREEN_SOFT = '#EDF3EA';
export const BRAND_GREEN_MID = '#C9DDB7';

export const appTheme = {
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
  },
};
