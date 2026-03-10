import { MD3LightTheme } from 'react-native-paper';

export const appTheme = {
  ...MD3LightTheme,
  roundness: 7,
  colors: {
    ...MD3LightTheme.colors,
    background: '#F3F5F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E6EBF1',
    primary: '#0B6E4F',
    secondary: '#3478F6',
    outline: '#BCC6D1',
    error: '#C62828',
  },
};
