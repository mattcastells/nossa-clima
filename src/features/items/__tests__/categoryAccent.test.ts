import { describe, expect, it } from 'vitest';

import { getCategoryAccent } from '../categoryAccent';
import type { AppTheme } from '@/theme';

// Theme mínimo: importar el real arrastra react-native-paper, que no corre en vitest.
const theme = {
  colors: {
    surfaceVariant: '#EAEFF5',
    textMuted: '#64748B',
    softGreen: '#E7F6EC',
    toastSuccessText: '#15803D',
    accentSoft: '#E0F7FC',
    accentStrong: '#0891B2',
    softYellow: '#FBEFD2',
    onSoftYellow: '#8A5A00',
    softBlue: '#E2F4FB',
    primary: '#052653',
  },
} as unknown as AppTheme;

describe('getCategoryAccent', () => {
  it('usa gris neutro cuando no hay categoria', () => {
    const neutral = { backgroundColor: '#EAEFF5', textColor: '#64748B' };
    expect(getCategoryAccent(theme, null)).toEqual(neutral);
    expect(getCategoryAccent(theme, '')).toEqual(neutral);
    expect(getCategoryAccent(theme, '   ')).toEqual(neutral);
  });

  it('da siempre el mismo color a la misma categoria', () => {
    expect(getCategoryAccent(theme, 'Cañería')).toEqual(getCategoryAccent(theme, 'Cañería'));
    // Ignora mayusculas y espacios: es texto libre cargado a mano.
    expect(getCategoryAccent(theme, 'cañería  ')).toEqual(getCategoryAccent(theme, 'Cañería'));
  });

  it('nunca devuelve el gris de "sin categoria" para una categoria real', () => {
    ['Cañería', 'Electricidad', 'Refrigerante', 'Aislación', 'Herramientas'].forEach((category) => {
      expect(getCategoryAccent(theme, category).backgroundColor).not.toBe('#EAEFF5');
    });
  });

  it('distingue categorias distintas', () => {
    const colors = new Set(
      ['Cañería', 'Electricidad', 'Refrigerante', 'Aislación'].map((c) => getCategoryAccent(theme, c).backgroundColor),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
