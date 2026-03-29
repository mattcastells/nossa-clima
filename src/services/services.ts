import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/db';
import { isMissingSupabaseColumnError } from './supabaseCompatibility';

const normalizeCategoryName = (name: string): string => name.trim().replace(/\s+/g, ' ');

const SERVICE_CATEGORIES_MISSING_TABLE_CODES = new Set(['42P01', 'PGRST204', 'PGRST205']);

const isMissingServiceCategoriesTableError = (
  error: { code?: string; message?: string; details?: string; status?: number; statusCode?: number } | null | undefined,
): boolean => {
  if (!error) return false;
  if (error.code && SERVICE_CATEGORIES_MISSING_TABLE_CODES.has(error.code)) return true;
  if (error.status === 404 || error.statusCode === 404) return true;

  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    text.includes('service_categories') &&
    (text.includes('not found') || text.includes('does not exist') || text.includes('schema cache') || text.includes('404'))
  );
};

const missingServiceCategoriesTableError = (): Error =>
  new Error('Falta la tabla service_categories. Ejecuta la migracion 202603100006_service_categories.sql.');

const mergeCategoryName = (map: Map<string, string>, rawValue: string | null | undefined): void => {
  const normalized = normalizeCategoryName(rawValue ?? '');
  if (!normalized) return;
  const key = normalized.toLowerCase();
  if (!map.has(key)) {
    map.set(key, normalized);
  }
};

export const listServices = async (): Promise<Service[]> => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .is('archived_at', null)
    .order('name');
  if (error) {
    if (!isMissingSupabaseColumnError(error, 'archived_at')) throw error;

    const fallback = await supabase.from('services').select('*').order('name');
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const upsertService = async (payload: Partial<Service> & { name: string }): Promise<Service> => {
  const { data, error } = await supabase.from('services').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteService = async (serviceId: string): Promise<void> => {
  const { error } = await supabase
    .from('services')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', serviceId);
  if (error) {
    if (isMissingSupabaseColumnError(error, 'archived_at')) {
      throw new Error('Falta aplicar la migracion de archivado de catalogos en Supabase.');
    }
    throw error;
  }
};

export const listServiceCategoryNames = async (): Promise<string[]> => {
  const [{ data: managedCategories, error: managedError }, { data: serviceCategories, error: serviceError }] = await Promise.all([
    supabase.from('service_categories').select('name').order('name'),
    supabase.from('services').select('category'),
  ]);

  if (serviceError) throw serviceError;
  if (managedError && !isMissingServiceCategoriesTableError(managedError)) throw managedError;

  const merged = new Map<string, string>();

  for (const category of managedCategories ?? []) {
    mergeCategoryName(merged, category.name);
  }

  for (const service of serviceCategories ?? []) {
    mergeCategoryName(merged, service.category);
  }

  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
};

export const createServiceCategory = async (name: string): Promise<string> => {
  const normalized = normalizeCategoryName(name);
  if (!normalized) {
    throw new Error('El nombre de la categoria es obligatorio.');
  }

  const existing = await listServiceCategoryNames();
  if (existing.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    throw new Error('La categoria ya existe.');
  }

  const { error } = await supabase.from('service_categories').insert({ name: normalized });
  if (error) {
    if (isMissingServiceCategoriesTableError(error)) throw missingServiceCategoriesTableError();
    throw error;
  }

  return normalized;
};

interface RenameServiceCategoryPayload {
  currentName: string;
  nextName: string;
}

const findServiceIdsByCategoryName = async (categoryName: string): Promise<string[]> => {
  const normalizedTarget = normalizeCategoryName(categoryName).toLowerCase();
  const { data, error } = await supabase.from('services').select('id, category').not('category', 'is', null);
  if (error) throw error;

  return (data ?? [])
    .filter((service) => normalizeCategoryName(service.category ?? '').toLowerCase() === normalizedTarget)
    .map((service) => service.id);
};

export const renameServiceCategory = async ({ currentName, nextName }: RenameServiceCategoryPayload): Promise<void> => {
  const previous = normalizeCategoryName(currentName);
  const next = normalizeCategoryName(nextName);

  if (!previous || !next) {
    throw new Error('Los nombres de categoria no pueden estar vacios.');
  }

  const previousKey = previous.toLowerCase();
  const nextKey = next.toLowerCase();

  const existing = await listServiceCategoryNames();
  const hasPrevious = existing.some((item) => item.toLowerCase() === previousKey);
  if (!hasPrevious) {
    throw new Error('La categoria ya no existe.');
  }

  if (previousKey !== nextKey && existing.some((item) => item.toLowerCase() === nextKey)) {
    throw new Error('Ya existe una categoria con ese nombre.');
  }

  const targetServiceIds = await findServiceIdsByCategoryName(previous);
  if (targetServiceIds.length > 0) {
    const { error: updateServicesError } = await supabase.from('services').update({ category: next }).in('id', targetServiceIds);
    if (updateServicesError) throw updateServicesError;
  }

  const { data: updatedRows, error: updateCategoryError } = await supabase
    .from('service_categories')
    .update({ name: next })
    .ilike('name', previous)
    .select('id');

  if (updateCategoryError && !isMissingServiceCategoriesTableError(updateCategoryError)) {
    throw updateCategoryError;
  }

  if ((updatedRows?.length ?? 0) === 0 && previousKey !== nextKey) {
    const { error: insertCategoryError } = await supabase.from('service_categories').insert({ name: next });
    if (insertCategoryError && !isMissingServiceCategoriesTableError(insertCategoryError)) {
      throw insertCategoryError;
    }
  }

  if (previousKey !== nextKey) {
    const { error: deleteOldCategoryError } = await supabase.from('service_categories').delete().ilike('name', previous);
    if (deleteOldCategoryError && !isMissingServiceCategoriesTableError(deleteOldCategoryError)) {
      throw deleteOldCategoryError;
    }
  }
};

export const deleteServiceCategory = async (name: string): Promise<void> => {
  const normalized = normalizeCategoryName(name);
  if (!normalized) {
    throw new Error('La categoria seleccionada no es valida.');
  }

  const targetServiceIds = await findServiceIdsByCategoryName(normalized);
  if (targetServiceIds.length > 0) {
    const { error: clearCategoryError } = await supabase.from('services').update({ category: null }).in('id', targetServiceIds);
    if (clearCategoryError) throw clearCategoryError;
  }

  const { error: deleteCategoryError } = await supabase.from('service_categories').delete().ilike('name', normalized);
  if (deleteCategoryError && !isMissingServiceCategoriesTableError(deleteCategoryError)) {
    throw deleteCategoryError;
  }
};
