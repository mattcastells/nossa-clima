export interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

const APPOINTMENT_QUOTE_LINK_ERROR_CODES = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);
const MISSING_COLUMN_ERROR_CODES = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);

const includesMissingSchemaPatterns = (text: string): boolean => {
  const hasAppointmentsRef = text.includes('appointments') || text.includes('public.appointments');
  const hasMissingRef =
    text.includes('schema cache') ||
    text.includes('could not find') ||
    text.includes('not found') ||
    text.includes('undefined column') ||
    text.includes('undefined table');

  return hasAppointmentsRef && hasMissingRef;
};

export const isMissingAppointmentQuoteLinkError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;

  if (error.code && APPOINTMENT_QUOTE_LINK_ERROR_CODES.has(error.code)) {
    return true;
  }

  const text = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!text) return false;
  if (text.includes('quote_id')) return true;

  return includesMissingSchemaPatterns(text);
};

const getErrorText = (error: SupabaseErrorLike | null | undefined): string =>
  [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

export const isMissingSupabaseColumnError = (error: SupabaseErrorLike | null | undefined, columnName: string): boolean => {
  if (!error) return false;
  if (error.code && !MISSING_COLUMN_ERROR_CODES.has(error.code)) return false;

  const text = getErrorText(error);
  if (!text) return false;

  return (
    text.includes(columnName.toLowerCase()) &&
    (text.includes('schema cache') ||
      text.includes('could not find') ||
      text.includes('not found') ||
      text.includes('undefined column') ||
      text.includes('does not exist'))
  );
};

export const isMissingSupabaseRelationError = (error: SupabaseErrorLike | null | undefined, relationName: string): boolean => {
  if (!error) return false;
  if (error.code && !MISSING_COLUMN_ERROR_CODES.has(error.code)) return false;

  const text = getErrorText(error);
  if (!text) return false;

  return (
    text.includes(relationName.toLowerCase()) &&
    (text.includes('schema cache') ||
      text.includes('could not find') ||
      text.includes('not found') ||
      text.includes('undefined table') ||
      text.includes('does not exist'))
  );
};

export const isInvalidQuoteStatusEnumError = (error: SupabaseErrorLike | null | undefined): boolean => {
  if (!error) return false;
  const text = getErrorText(error);
  return error.code === '22P02' && text.includes('quote_status');
};
