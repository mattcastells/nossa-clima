import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/db';
import { isMissingSupabaseColumnError } from './supabaseCompatibility';

const DEFAULT_SERVICE_CATALOG: Array<{ name: string; base_price: number; category: string }> = [
  { name: 'inst. hasta 3.000 fr', base_price: 160000, category: 'Instalacion' },
  { name: 'inst. hasta 4.500 fr', base_price: 180000, category: 'Instalacion' },
  { name: 'inst. hasta 6.000 fr', base_price: 220000, category: 'Instalacion' },
  { name: 'inst. hasta 8.000 fr', base_price: 300000, category: 'Instalacion' },
  { name: 'inst. piso techo 9.000 fr', base_price: 430000, category: 'Instalacion' },
  { name: 'inst. piso techo 15.000 fr', base_price: 650000, category: 'Instalacion' },
  { name: 'inst. piso techo 18.000 fr', base_price: 750000, category: 'Instalacion' },
  { name: 'visita tecnica', base_price: 30000, category: 'Diagnostico' },
  { name: 'cambio de compresor hasta 4.500 fr', base_price: 300000, category: 'Reparacion' },
  { name: 'cambio de compresor hasta 6.000 fr', base_price: 430000, category: 'Reparacion' },
  { name: 'solucion de perdida simple en tuercas', base_price: 105000, category: 'Reparacion' },
  { name: 'cambio de plaqueta universal', base_price: 150000, category: 'Reparacion' },
  { name: 'cambio de sensores', base_price: 105000, category: 'Reparacion' },
  { name: 'cambio de robinete (nitro+vacio)', base_price: 200000, category: 'Reparacion' },
  { name: 'cambio de valvula inversora (deinst + sold + nitro + vacio)', base_price: 300000, category: 'Reparacion' },
  { name: 'cambio de capacitor', base_price: 105000, category: 'Reparacion' },
  { name: 'limpieza mantenimiento split hasta 4.500 fr', base_price: 130000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento split hasta 6.000 fr', base_price: 150000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento split hasta 8.000 fr', base_price: 170000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento split hasta 9.000 fr', base_price: 190000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento split hasta 15.000 fr', base_price: 200000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento split hasta 18.000 fr', base_price: 225000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento chiller', base_price: 225000, category: 'Mantenimiento' },
  { name: 'limpieza mantenimiento central', base_price: 330000, category: 'Mantenimiento' },
  { name: 'deteccion y reparacion de fuga + carga de R-410', base_price: 220000, category: 'Gas refrigerante' },
  { name: 'deteccion y reparacion de fuga + carga de gas R-22', base_price: 250000, category: 'Gas refrigerante' },
  { name: 'carga de gas R-410 hasta 1kg', base_price: 80000, category: 'Gas refrigerante' },
  { name: 'carga de gas R-22 hasta 1kg', base_price: 90000, category: 'Gas refrigerante' },
  { name: 'desinstalacion hasta 3.000 fr', base_price: 100000, category: 'Desinstalacion' },
  { name: 'desinstalacion hasta 4.500 fr', base_price: 100000, category: 'Desinstalacion' },
  { name: 'desinstalacion hasta 6.000 fr', base_price: 130000, category: 'Desinstalacion' },
  { name: 'montaje sobre pre-instalacion hasta 3.000 fr', base_price: 140000, category: 'Montaje' },
  { name: 'montaje sobre pre-instalacion hasta 4.500 fr', base_price: 175000, category: 'Montaje' },
  { name: 'montaje sobre pre-instalacion hasta 6.000 fr', base_price: 215000, category: 'Montaje' },
  { name: 'armado camara frigorifica 2HP 2,5x2,5x2,5mts', base_price: 3750000, category: 'Especial' },
];

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
const normalizeCategoryName = (name: string): string => name.trim().replace(/\s+/g, ' ');

const SERVICE_CATEGORIES_MISSING_TABLE_CODES = new Set(['42P01', 'PGRST204', 'PGRST205']);

const isMissingServiceCategoriesTableError = (error: { code?: string; message?: string; details?: string } | null | undefined): boolean => {
  if (!error) return false;
  if (error.code && SERVICE_CATEGORIES_MISSING_TABLE_CODES.has(error.code)) return true;

  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return text.includes('service_categories') && (text.includes('not found') || text.includes('does not exist') || text.includes('schema cache'));
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

export const importDefaultServices = async (): Promise<{ inserted: number; skipped: number }> => {
  const { data: existing, error: existingError } = await supabase.from('services').select('name');
  if (existingError) throw existingError;

  const existingNames = new Set((existing ?? []).map((service) => normalizeName(service.name)));

  const rowsToInsert = DEFAULT_SERVICE_CATALOG
    .filter((service) => !existingNames.has(normalizeName(service.name)))
    .map((service) => ({
      name: service.name,
      base_price: service.base_price,
      category: service.category,
      unit_type: 'servicio',
      description: null,
    }));

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: DEFAULT_SERVICE_CATALOG.length };
  }

  const { error: insertError } = await supabase.from('services').insert(rowsToInsert);
  if (insertError) throw insertError;

  const uniqueCategories = Array.from(new Set(rowsToInsert.map((service) => normalizeCategoryName(service.category))));
  if (uniqueCategories.length > 0) {
    const { error: categoriesError } = await supabase
      .from('service_categories')
      .upsert(uniqueCategories.map((name) => ({ name })), { onConflict: 'user_id,name', ignoreDuplicates: true });

    if (categoriesError && !isMissingServiceCategoriesTableError(categoriesError)) {
      throw categoriesError;
    }
  }

  return {
    inserted: rowsToInsert.length,
    skipped: DEFAULT_SERVICE_CATALOG.length - rowsToInsert.length,
  };
};
