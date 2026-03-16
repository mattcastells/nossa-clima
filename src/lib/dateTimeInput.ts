const onlyDigits = (value: string): string => value.replace(/\D/g, '');
const isValidDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(year, month - 1, day);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const formatIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDisplayDate = (value: Date): string => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatStoredDateForDisplay = (value: string): string => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!isoMatch) {
    return trimmed;
  }

  const [, year, month, day] = isoMatch;
  return `${day}-${month}-${year}`;
};

export const maskDateInput = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

export const maskTimeInput = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export const parseDisplayDate = (value: string): Date | null => {
  const trimmed = value.trim();
  const localMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (localMatch) {
    const [, rawDay, rawMonth, rawYear] = localMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    const date = new Date(year, month - 1, day);

    if (isValidDate(year, month, day)) {
      return date;
    }
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, rawYear, rawMonth, rawDay] = isoMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    const date = new Date(year, month - 1, day);

    if (isValidDate(year, month, day)) {
      return date;
    }
  }

  return null;
};

export const normalizeDateInput = (value: string): string => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, rawYear, rawMonth, rawDay] = isoMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);

    if (!isValidDate(year, month, day)) {
      throw new Error('La fecha ingresada no es valida.');
    }

    return trimmed;
  }

  const maskedValue = maskDateInput(trimmed);
  const localMatch = maskedValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (localMatch) {
    const [, rawDay, rawMonth, rawYear] = localMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);

    if (!isValidDate(year, month, day)) {
      throw new Error('La fecha ingresada no es valida.');
    }

    return `${rawYear}-${rawMonth}-${rawDay}`;
  }

  throw new Error('La fecha debe tener formato DD-MM-AAAA.');
};

export const normalizeOptionalTimeInput = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const maskedValue = maskTimeInput(trimmed);
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(maskedValue)) {
    throw new Error('La hora debe tener formato HH:mm.');
  }

  return `${maskedValue}:00`;
};

export const toHumanDate = (isoDate: string): string => {
  const [rawYear = '1970', rawMonth = '01', rawDay = '01'] = isoDate.split('-');
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(
    Number.isFinite(year) ? year : 1970,
    Number.isFinite(month) ? month - 1 : 0,
    Number.isFinite(day) ? day : 1,
  );
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const getCalendarCells = (anchor: Date): Array<number | null> => {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

  const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const monthLabel = (anchor: Date): string => {
  const label = anchor.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : label;
};
