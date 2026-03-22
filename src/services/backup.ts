import { supabase } from '@/lib/supabase';
import type {
  Appointment,
  Item,
  ItemMeasurement,
  Quote,
  QuoteMaterialItem,
  QuoteServiceItem,
  Service,
  Store,
  StoreItemMeasurementPrice,
  StoreItemPrice,
} from '@/types/db';
import { isMissingAppointmentQuoteLinkError, isMissingSupabaseColumnError } from './supabaseCompatibility';

export interface UserBackupPayload {
  version: 2;
  exported_at: string;
  services: Service[];
  stores: Store[];
  items: Item[];
  item_measurements: ItemMeasurement[];
  store_item_prices: StoreItemPrice[];
  store_item_measure_prices: StoreItemMeasurementPrice[];
  quotes: Quote[];
  quote_service_items: QuoteServiceItem[];
  quote_material_items: QuoteMaterialItem[];
  appointments: Appointment[];
}

export const exportUserBackup = async (): Promise<UserBackupPayload> => {
  const [services, stores, items, itemMeasurements, storeItemPrices, storeItemMeasurePrices, quotes, quoteServiceItems, quoteMaterialItems, appointments] =
    await Promise.all([
    supabase.from('services').select('*').order('created_at'),
    supabase.from('stores').select('*').order('created_at'),
    supabase.from('items').select('*').order('created_at'),
    supabase.from('item_measurements').select('*').order('created_at'),
    supabase.from('store_item_prices').select('*').order('created_at'),
    supabase.from('store_item_measure_prices').select('*').order('created_at'),
    supabase.from('quotes').select('*').order('created_at'),
    supabase.from('quote_service_items').select('*').order('created_at'),
    supabase.from('quote_material_items').select('*').order('created_at'),
    supabase.from('appointments').select('*').order('created_at'),
    ]);

  if (services.error) throw services.error;
  if (stores.error) throw stores.error;
  if (items.error) throw items.error;
  if (itemMeasurements.error) throw itemMeasurements.error;
  if (storeItemPrices.error) throw storeItemPrices.error;
  if (storeItemMeasurePrices.error) throw storeItemMeasurePrices.error;
  if (quotes.error) throw quotes.error;
  if (quoteServiceItems.error) throw quoteServiceItems.error;
  if (quoteMaterialItems.error) throw quoteMaterialItems.error;
  if (appointments.error) throw appointments.error;

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    services: services.data ?? [],
    stores: stores.data ?? [],
    items: items.data ?? [],
    item_measurements: itemMeasurements.data ?? [],
    store_item_prices: storeItemPrices.data ?? [],
    store_item_measure_prices: storeItemMeasurePrices.data ?? [],
    quotes: quotes.data ?? [],
    quote_service_items: quoteServiceItems.data ?? [],
    quote_material_items: quoteMaterialItems.data ?? [],
    appointments: appointments.data ?? [],
  };
};

const normalizeBackupArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export const restoreUserBackup = async (
  rawPayload: unknown,
  options?: { confirmRestore?: boolean },
): Promise<{ restoredTables: string[] }> => {
  // Guard: require explicit confirmation to run an unsafe restore from client code.
  if (!options?.confirmRestore) {
    throw new Error(
      'restoreUserBackup is restricted. This operation is destructive and should run server-side. To run locally set { confirmRestore: true } explicitly from a secure environment.',
    );
  }
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Backup invalido.');
  }

  const payload = rawPayload as Partial<UserBackupPayload>;

  const services = normalizeBackupArray<Service>(payload.services);
  const stores = normalizeBackupArray<Store>(payload.stores);
  const items = normalizeBackupArray<Item>(payload.items);
  const itemMeasurements = normalizeBackupArray<ItemMeasurement>(payload.item_measurements);
  const storeItemPrices = normalizeBackupArray<StoreItemPrice>(payload.store_item_prices);
  const storeItemMeasurePrices = normalizeBackupArray<StoreItemMeasurementPrice>(payload.store_item_measure_prices);
  const quotes = normalizeBackupArray<Quote>(payload.quotes);
  const quoteServiceItems = normalizeBackupArray<QuoteServiceItem>(payload.quote_service_items);
  const quoteMaterialItems = normalizeBackupArray<QuoteMaterialItem>(payload.quote_material_items);
  const appointments = normalizeBackupArray<Appointment>(payload.appointments);

  // Reset de datos operativos del usuario actual.
  const deleteWhereAnyId = (table: string) => supabase.from(table).delete().not('id', 'is', null);

  const deletions = [
    await deleteWhereAnyId('appointments'),
    await deleteWhereAnyId('quote_material_items'),
    await deleteWhereAnyId('quote_service_items'),
    await deleteWhereAnyId('store_item_measure_prices'),
    await deleteWhereAnyId('quotes'),
    await deleteWhereAnyId('item_measurements'),
    await deleteWhereAnyId('services'),
  ];

  deletions.forEach((result) => {
    if (result.error) throw result.error;
  });

  if (services.length > 0) {
    const { error } = await supabase.from('services').insert(
      services.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        base_price: row.base_price,
        unit_type: row.unit_type,
        archived_at: row.archived_at,
      })),
    );
    if (error) throw error;
  }

  if (stores.length > 0) {
    const { error } = await supabase.from('stores').upsert(
      stores.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        address: row.address,
        phone: row.phone,
        notes: row.notes,
        archived_at: row.archived_at,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  if (items.length > 0) {
    const itemRows = items.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      notes: row.notes ?? null,
      category: row.category,
      base_price_label: row.base_price_label ?? null,
      variant_label: row.variant_label ?? null,
      presentation_quantity: row.presentation_quantity ?? null,
      presentation_unit: row.presentation_unit ?? null,
      unit: row.unit,
      sku: row.sku,
      brand: row.brand,
      item_type: row.item_type,
      archived_at: row.archived_at,
    }));

    const { error } = await supabase.from('items').upsert(
      itemRows,
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (
      error &&
      (isMissingSupabaseColumnError(error, 'base_price_label') ||
        isMissingSupabaseColumnError(error, 'variant_label') ||
        isMissingSupabaseColumnError(error, 'presentation_quantity') ||
        isMissingSupabaseColumnError(error, 'presentation_unit'))
    ) {
      const fallback = await supabase.from('items').upsert(
        itemRows.map((r) => {
          const copy = { ...(r as Record<string, unknown>) } as Record<string, unknown>;
          delete copy['base_price_label'];
          delete copy['variant_label'];
          delete copy['presentation_quantity'];
          delete copy['presentation_unit'];
          return copy as Record<string, unknown>;
        }),
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (fallback.error) throw fallback.error;
    } else if (error) {
      throw error;
    }
  }

  if (itemMeasurements.length > 0) {
    const { error } = await supabase.from('item_measurements').upsert(
      itemMeasurements.map((row) => ({
        id: row.id,
        item_id: row.item_id,
        label: row.label,
        unit: row.unit,
        pricing_mode: row.pricing_mode,
        grams_per_meter: row.grams_per_meter,
        notes: row.notes,
        sort_order: row.sort_order,
        archived_at: row.archived_at,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  if (quotes.length > 0) {
    const { error } = await supabase.from('quotes').insert(
      quotes.map((row) => ({
        id: row.id,
        client_name: row.client_name,
        client_phone: row.client_phone,
        title: row.title,
        description: row.description,
        status: row.status,
        notes: row.notes,
        default_material_margin_percent: row.default_material_margin_percent,
        cancelled_at: row.cancelled_at,
      })),
    );
    if (error) throw error;
  }

  if (quoteServiceItems.length > 0) {
    const { error } = await supabase.from('quote_service_items').insert(
      quoteServiceItems.map((row) => ({
        id: row.id,
        quote_id: row.quote_id,
        service_id: row.service_id,
        service_name_snapshot: row.service_name_snapshot,
        quantity: row.quantity,
        unit_price: row.unit_price,
        notes: row.notes,
      })),
    );
    if (error) throw error;
  }

  if (quoteMaterialItems.length > 0) {
    const { error } = await supabase.from('quote_material_items').insert(
      quoteMaterialItems.map((row) => ({
        id: row.id,
        quote_id: row.quote_id,
        item_id: row.item_id,
        item_measurement_id: row.item_measurement_id,
        item_measurement_snapshot: row.item_measurement_snapshot,
        item_name_snapshot: row.item_name_snapshot,
        quantity: row.quantity,
        unit: row.unit,
        unit_price: row.unit_price,
        margin_percent: row.margin_percent,
        source_store_id: row.source_store_id,
        source_store_name_snapshot: row.source_store_name_snapshot,
        notes: row.notes,
      })),
    );
    if (error) throw error;
  }

  if (storeItemPrices.length > 0) {
    const { error } = await supabase.from('store_item_prices').upsert(
      storeItemPrices.map((row) => ({
        id: row.id,
        store_id: row.store_id,
        item_id: row.item_id,
        price: row.price,
        currency: row.currency,
        observed_at: row.observed_at,
        source_type: row.source_type,
        quantity_reference: row.quantity_reference,
        notes: row.notes,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  if (storeItemMeasurePrices.length > 0) {
    const { error } = await supabase.from('store_item_measure_prices').upsert(
      storeItemMeasurePrices.map((row) => ({
        id: row.id,
        store_id: row.store_id,
        item_measurement_id: row.item_measurement_id,
        price: row.price,
        currency: row.currency,
        observed_at: row.observed_at,
        source_type: row.source_type,
        notes: row.notes,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  if (appointments.length > 0) {
    const withQuoteIdRows = appointments.map((row) => ({
      id: row.id,
      quote_id: row.quote_id ?? null,
      title: row.title,
      notes: row.notes,
      scheduled_for: row.scheduled_for,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      store_id: row.store_id,
    }));

    const insertWithQuote = await supabase.from('appointments').insert(withQuoteIdRows);
    if (insertWithQuote.error && !isMissingAppointmentQuoteLinkError(insertWithQuote.error)) {
      throw insertWithQuote.error;
    }

    if (insertWithQuote.error && isMissingAppointmentQuoteLinkError(insertWithQuote.error)) {
      const insertWithoutQuote = await supabase.from('appointments').insert(
        appointments.map((row) => ({
          id: row.id,
          title: row.title,
          notes: row.notes,
          scheduled_for: row.scheduled_for,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          status: row.status,
          store_id: row.store_id,
        })),
      );
      if (insertWithoutQuote.error) throw insertWithoutQuote.error;
    }
  }

  return {
    restoredTables: [
      'services',
      'stores',
      'items',
      'item_measurements',
      'quotes',
      'quote_service_items',
      'quote_material_items',
      'store_item_prices',
      'store_item_measure_prices',
      'appointments',
    ],
  };
};
