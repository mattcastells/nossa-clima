export const formatCurrencyArs = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const formatDateAr = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
};

export const formatPercent = (value: number | null | undefined): string =>
  `${Number(value ?? 0).toFixed(2)}%`;
