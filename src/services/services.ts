import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/db';

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

export const listServices = async (): Promise<Service[]> => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');
  if (error) throw error;
  return data;
};

export const upsertService = async (payload: Partial<Service> & { name: string }): Promise<Service> => {
  const { data, error } = await supabase.from('services').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteService = async (serviceId: string): Promise<void> => {
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw error;
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
      is_active: true,
    }));

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: DEFAULT_SERVICE_CATALOG.length };
  }

  const { error: insertError } = await supabase.from('services').insert(rowsToInsert);
  if (insertError) throw insertError;

  return {
    inserted: rowsToInsert.length,
    skipped: DEFAULT_SERVICE_CATALOG.length - rowsToInsert.length,
  };
};
