import type { AppTheme } from '@/theme';

export interface CategoryAccent {
  backgroundColor: string;
  textColor: string;
}

/**
 * Color del badge de categoría. El diseño usa un color distinto por categoría
 * (Cañería verde, Electricidad cian, Refrigerante gris) en vez de teñir todo
 * del mismo tono, para que la lista se lea de un vistazo.
 *
 * La categoría es texto libre cargado por el usuario, así que el color se
 * deriva del nombre: la misma categoría cae siempre en el mismo color, y las
 * que no tienen categoría quedan en gris neutro.
 */
export const getCategoryAccent = (theme: AppTheme, category: string | null | undefined): CategoryAccent => {
  const normalized = category?.trim().toLowerCase();

  const neutral: CategoryAccent = {
    backgroundColor: theme.colors.surfaceVariant,
    textColor: theme.colors.textMuted,
  };
  if (!normalized) return neutral;

  const palette: CategoryAccent[] = [
    { backgroundColor: theme.colors.softGreen, textColor: theme.colors.toastSuccessText },
    { backgroundColor: theme.colors.accentSoft, textColor: theme.colors.accentStrong },
    { backgroundColor: theme.colors.softYellow, textColor: theme.colors.onSoftYellow },
    { backgroundColor: theme.colors.softBlue, textColor: theme.colors.primary },
  ];

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) % 100000;
  }
  return palette[hash % palette.length] ?? neutral;
};
