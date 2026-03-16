export const formatCurrencyArs = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const formatDateAr = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [rawYear = '1970', rawMonth = '01', rawDay = '01'] = value.split('-');
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    const date = new Date(
      Number.isFinite(year) ? year : 1970,
      Number.isFinite(month) ? month - 1 : 0,
      Number.isFinite(day) ? day : 1,
    );
    return date.toLocaleDateString('es-AR');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
};

export const formatTimeShort = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.length >= 5 ? value.slice(0, 5) : value;
};

export const formatPercent = (value: number | null | undefined): string =>
  `${Number(value ?? 0).toFixed(2)}%`;

export const formatDateTimeAr = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString('es-AR')} ${date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};
