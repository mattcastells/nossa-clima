import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';
import type { AppointmentInput } from '@/services/appointments';
import { listItems } from '@/services/items';
import { listLatestPrices } from '@/services/prices';
import {
  deleteQuote,
  type QuoteMaterialItemInput,
  type QuoteServiceItemInput,
} from '@/services/quotes';
import { listServices } from '@/services/services';
import { listStores } from '@/services/stores';
import type { Appointment, Item, LatestStoreItemPrice, Quote, Service, Store, StoreItemPrice } from '@/types/db';

import type {
  AssistantActionDraft,
  AssistantItemActionPayload,
  AssistantJobActionPayload,
  AssistantJobMaterialLinePayload,
  AssistantJobServiceLinePayload,
  AssistantServiceActionPayload,
  AssistantStoreActionPayload,
} from './actions';

const normalizeCatalogName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

type AssistantExecutionDependencies = {
  saveStore: (payload: Partial<Store> & { name: string }) => Promise<Store>;
  saveItem: (payload: Partial<Item> & { name: string }) => Promise<Item>;
  saveService: (payload: Partial<Service> & { name: string }) => Promise<Service>;
  saveQuote: (payload: Partial<Quote> & Pick<Quote, 'client_name' | 'title'>) => Promise<Quote>;
  addQuoteMaterialItem: (payload: QuoteMaterialItemInput) => Promise<unknown>;
  addQuoteServiceItem: (payload: QuoteServiceItemInput) => Promise<unknown>;
  createAppointment: (payload: AppointmentInput) => Promise<Appointment>;
  upsertQuoteAppointment: (payload: Omit<AppointmentInput, 'quote_id'> & { quote_id: string }) => Promise<Appointment>;
  createPriceRecord: (payload: Omit<StoreItemPrice, 'id' | 'created_at' | 'user_id'>) => Promise<unknown>;
};

type CatalogMaps = {
  stores: Map<string, Store>;
  items: Map<string, Item>;
  services: Map<string, Service>;
  latestPrices: Map<string, LatestStoreItemPrice>;
};

const buildCatalogMaps = async (): Promise<CatalogMaps> => {
  const [stores, items, services, latestPrices] = await Promise.all([listStores(), listItems(), listServices(), listLatestPrices()]);

  return {
    stores: new Map(stores.map((store) => [normalizeCatalogName(store.name), store])),
    items: new Map(items.map((item) => [normalizeCatalogName(item.name), item])),
    services: new Map(services.map((service) => [normalizeCatalogName(service.name), service])),
    latestPrices: new Map(latestPrices.map((price) => [`${price.store_id}::${price.item_id}`, price])),
  };
};

const uniqueMessages = (messages: string[]): string[] => Array.from(new Set(messages.filter(Boolean)));

const mergeDraftMessages = <T extends AssistantActionDraft>(action: T, problems: string[], hints: string[]): T => ({
  ...action,
  problems: uniqueMessages([...action.problems, ...problems]),
  hints: uniqueMessages([...action.hints, ...hints]),
});

const validateCreateJobDraft = (
  action: Extract<AssistantActionDraft, { kind: 'create_job' }>,
  catalog: CatalogMaps,
): Extract<AssistantActionDraft, { kind: 'create_job' }> => {
  const problems: string[] = [];
  const hints: string[] = [];
  const sourceStoreName = action.payload.source_store?.name?.trim() ?? '';
  const normalizedStoreName = sourceStoreName ? normalizeCatalogName(sourceStoreName) : null;
  const existingStore = normalizedStoreName ? catalog.stores.get(normalizedStoreName) ?? null : null;

  for (const serviceDraft of action.payload.services) {
    const explicitUnitPrice = serviceDraft.unit_price ?? serviceDraft.base_price ?? null;
    if (explicitUnitPrice != null && explicitUnitPrice > 0) {
      continue;
    }

    const existingService = catalog.services.get(normalizeCatalogName(serviceDraft.name)) ?? null;
    if (existingService?.base_price != null && existingService.base_price > 0) {
      hints.push(`Servicio "${serviceDraft.name}": se usara el precio del catalogo (${formatCurrencyArs(existingService.base_price)}).`);
      continue;
    }

    problems.push(`Servicio "${serviceDraft.name}": falta indicar un precio valido o usar un servicio ya existente con precio.`);
  }

  if (action.payload.materials.length > 0 && !sourceStoreName) {
    problems.push('Falta indicar la tienda de compra de los materiales.');
  }

  for (const materialDraft of action.payload.materials) {
    if (materialDraft.unit_price != null && materialDraft.unit_price > 0) {
      continue;
    }

    if (!sourceStoreName) {
      problems.push(`Material "${materialDraft.name}": falta indicar la tienda o el precio.`);
      continue;
    }

    if (!existingStore) {
      problems.push(
        `Material "${materialDraft.name}": la tienda "${sourceStoreName}" no tiene precios cargados todavia. Indica el precio o cargalo antes.`,
      );
      continue;
    }

    const existingItem = catalog.items.get(normalizeCatalogName(materialDraft.name)) ?? null;
    if (!existingItem) {
      problems.push(
        `Material "${materialDraft.name}": no existe en el catalogo y falta el precio para usarlo en "${existingStore.name}".`,
      );
      continue;
    }

    const latestPrice = catalog.latestPrices.get(`${existingStore.id}::${existingItem.id}`) ?? null;
    if (!latestPrice || latestPrice.price <= 0) {
      problems.push(`Material "${materialDraft.name}": no encontre un precio vigente en "${existingStore.name}".`);
      continue;
    }

    hints.push(
      `Material "${materialDraft.name}": se usara el precio vigente de ${formatCurrencyArs(latestPrice.price)} en "${existingStore.name}".`,
    );
  }

  return mergeDraftMessages(action, problems, hints);
};

export const validateAssistantActionDraft = async (action: AssistantActionDraft): Promise<AssistantActionDraft> => {
  switch (action.kind) {
    case 'create_job': {
      try {
        const catalog = await buildCatalogMaps();
        return validateCreateJobDraft(action, catalog);
      } catch {
        return mergeDraftMessages(action, ['No se pudo validar el trabajo contra la base de datos. Intenta nuevamente.'], []);
      }
    }
    default:
      return action;
  }
};

const resolveOrCreateStore = async (
  storeDraft: AssistantStoreActionPayload | null,
  catalog: CatalogMaps,
  deps: AssistantExecutionDependencies,
): Promise<Store | null> => {
  if (!storeDraft?.name.trim()) return null;

  const key = normalizeCatalogName(storeDraft.name);
  const existing = catalog.stores.get(key);
  if (existing) {
    return existing;
  }

  const created = await deps.saveStore({
    name: storeDraft.name,
    description: storeDraft.description ?? null,
    address: storeDraft.address ?? null,
    phone: storeDraft.phone ?? null,
    notes: storeDraft.notes ?? null,
  });
  catalog.stores.set(key, created);
  return created;
};

const resolveOrCreateItem = async (
  itemDraft: AssistantItemActionPayload | AssistantJobMaterialLinePayload,
  catalog: CatalogMaps,
  deps: AssistantExecutionDependencies,
): Promise<Item> => {
  const key = normalizeCatalogName(itemDraft.name);
  const existing = catalog.items.get(key);
  if (existing) {
    return existing;
  }

  const created = await deps.saveItem({
    name: itemDraft.name,
    description: itemDraft.description ?? null,
    notes: itemDraft.notes ?? null,
    category: itemDraft.category ?? null,
    base_price_label: itemDraft.base_price_label ?? null,
    sku: itemDraft.sku ?? null,
    item_type: itemDraft.item_type,
    unit: 'unit' in itemDraft ? itemDraft.unit ?? null : null,
  });
  catalog.items.set(key, created);
  return created;
};

const resolveOrCreateService = async (
  serviceDraft: AssistantServiceActionPayload | AssistantJobServiceLinePayload,
  catalog: CatalogMaps,
  deps: AssistantExecutionDependencies,
): Promise<Service> => {
  const key = normalizeCatalogName(serviceDraft.name);
  const existing = catalog.services.get(key);
  if (existing) {
    return existing;
  }

  const basePrice =
    'base_price' in serviceDraft
      ? serviceDraft.base_price ?? ('unit_price' in serviceDraft ? serviceDraft.unit_price ?? 0 : 0)
      : serviceDraft.base_price ?? 0;

  const created = await deps.saveService({
    name: serviceDraft.name,
    description: serviceDraft.description ?? null,
    category: serviceDraft.category ?? null,
    base_price: basePrice,
    unit_type: serviceDraft.unit_type ?? null,
  });
  catalog.services.set(key, created);
  return created;
};

const executeCreateJobAction = async (
  payload: AssistantJobActionPayload,
  catalog: CatalogMaps,
  deps: AssistantExecutionDependencies,
): Promise<string> => {
  let createdQuoteId: string | null = null;

  try {
    const quote = await deps.saveQuote({
      client_name: payload.client_name,
      client_phone: payload.client_phone ?? null,
      title: payload.title,
      description: payload.description ?? null,
      notes: payload.notes ?? null,
      default_material_margin_percent: payload.default_material_margin_percent,
      status: 'pending',
    });
    createdQuoteId = quote.id;

    const sourceStore = await resolveOrCreateStore(payload.source_store, catalog, deps);

    if (payload.materials.length > 0 && !sourceStore) {
      throw new Error('Falta indicar la tienda de compra de los materiales.');
    }

    for (const serviceDraft of payload.services) {
      const service = await resolveOrCreateService(serviceDraft, catalog, deps);
      const resolvedUnitPrice = serviceDraft.unit_price ?? serviceDraft.base_price ?? service.base_price ?? null;
      if (resolvedUnitPrice == null || resolvedUnitPrice <= 0) {
        throw new Error(`Servicio "${serviceDraft.name}": falta un precio valido para crear el trabajo.`);
      }

      await deps.addQuoteServiceItem({
        quote_id: quote.id,
        service_id: service.id,
        quantity: serviceDraft.quantity,
        unit_price: resolvedUnitPrice,
        margin_percent: null,
        notes: serviceDraft.notes ?? null,
      });
    }

    for (const materialDraft of payload.materials) {
      const item = await resolveOrCreateItem(materialDraft, catalog, deps);
      const latestStorePrice =
        materialDraft.unit_price == null && sourceStore ? catalog.latestPrices.get(`${sourceStore.id}::${item.id}`) ?? null : null;
      const resolvedUnitPrice = materialDraft.unit_price ?? latestStorePrice?.price ?? null;

      if (resolvedUnitPrice == null || resolvedUnitPrice <= 0) {
        throw new Error(`Material "${materialDraft.name}": falta un precio valido para crear el trabajo.`);
      }

      await deps.addQuoteMaterialItem({
        quote_id: quote.id,
        item_id: item.id,
        item_measurement_id: null,
        quantity: materialDraft.quantity,
        unit: materialDraft.unit ?? item.unit ?? 'u',
        unit_price: resolvedUnitPrice,
        margin_percent: null,
        source_store_id: sourceStore?.id ?? null,
        notes: materialDraft.notes ?? null,
      });
    }

    let appointmentSummary = '';
    if (payload.scheduled_for) {
      await deps.upsertQuoteAppointment({
        quote_id: quote.id,
        title: `${quote.client_name} - ${quote.title}`,
        notes: payload.notes ?? quote.notes ?? null,
        scheduled_for: payload.scheduled_for,
        starts_at: payload.starts_at,
        ends_at: payload.ends_at,
        status: 'scheduled',
        store_id: sourceStore?.id ?? null,
      });
      appointmentSummary = ` Turno ${formatDateAr(payload.scheduled_for)}${payload.starts_at ? ` ${formatTimeShort(payload.starts_at)}` : ''}.`;
    }

    return `Trabajo "${quote.title}" creado con ${payload.services.length} servicio(s) y ${payload.materials.length} material(es).${appointmentSummary}`;
  } catch (error) {
    if (createdQuoteId) {
      await deleteQuote(createdQuoteId).catch(() => {});
      const message = error instanceof Error ? error.message : 'No se pudo crear el trabajo.';
      throw new Error(`${message} Se intento limpiar el borrador parcial del trabajo.`);
    }

    throw error;
  }
};

const executeCreateStorePriceBatchAction = async (
  payload: Extract<AssistantActionDraft, { kind: 'create_store_price_batch' }>['payload'],
  catalog: CatalogMaps,
  deps: AssistantExecutionDependencies,
): Promise<string> => {
  const store = await resolveOrCreateStore(payload.store, catalog, deps);
  if (!store) {
    throw new Error('La tienda es obligatoria para cargar precios.');
  }

  for (const itemDraft of payload.items) {
    const item = await resolveOrCreateItem(itemDraft, catalog, deps);
    if (itemDraft.price == null || itemDraft.price <= 0) {
      throw new Error(`Falta un precio valido para "${itemDraft.name}".`);
    }

    await deps.createPriceRecord({
      store_id: store.id,
      item_id: item.id,
      price: itemDraft.price,
      currency: payload.currency,
      observed_at: payload.observed_at,
      source_type: 'manual_update',
      quantity_reference: itemDraft.quantity_reference ?? null,
      notes: itemDraft.notes ?? payload.notes ?? null,
    });
  }

  return `Se cargaron ${payload.items.length} precio(s) en la tienda "${store.name}" para ${formatDateAr(payload.observed_at)}.`;
};

export const executeAssistantActionDraft = async (
  action: AssistantActionDraft,
  deps: AssistantExecutionDependencies,
): Promise<string> => {
  switch (action.kind) {
    case 'create_store': {
      const created = await deps.saveStore(action.payload);
      return `Tienda "${created.name}" creada.`;
    }
    case 'create_item': {
      const created = await deps.saveItem(action.payload);
      return `Material "${created.name}" creado.`;
    }
    case 'create_service': {
      const created = await deps.saveService(action.payload);
      return `Servicio "${created.name}" creado.`;
    }
    case 'create_appointment': {
      const created = await deps.createAppointment({
        quote_id: null,
        title: action.payload.title,
        notes: action.payload.notes ?? null,
        scheduled_for: action.payload.scheduled_for,
        starts_at: action.payload.starts_at,
        ends_at: action.payload.ends_at,
        status: 'scheduled',
        store_id: null,
      });
      return `Turno "${created.title}" creado.`;
    }
    case 'create_job': {
      const catalog = await buildCatalogMaps();
      return executeCreateJobAction(action.payload, catalog, deps);
    }
    case 'create_store_price_batch': {
      const catalog = await buildCatalogMaps();
      return executeCreateStorePriceBatchAction(action.payload, catalog, deps);
    }
    default:
      throw new Error('La accion propuesta no esta soportada todavia.');
  }
};
