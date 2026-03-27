import { itemSchema } from '@/features/items/schemas';
import { quoteSchema } from '@/features/quotes/schemas';
import { serviceSchema } from '@/features/services/schemas';
import { storeSchema } from '@/features/stores/schemas';
import { formatIsoDate, normalizeDateInput, normalizeOptionalTimeInput } from '@/lib/dateTimeInput';
import { formatCurrencyArs, formatDateAr, formatPercent, formatTimeShort } from '@/lib/format';
import type { ItemType } from '@/types/db';

export type AssistantActionConfidence = 'low' | 'medium' | 'high';
export type AssistantActionKind =
  | 'create_store'
  | 'create_item'
  | 'create_service'
  | 'create_appointment'
  | 'create_job'
  | 'create_store_price_batch';

export interface AssistantActionProposal {
  type: AssistantActionKind;
  summary?: string;
  confidence?: AssistantActionConfidence;
  payload?: Record<string, unknown> | null;
}

export interface AssistantActionDetail {
  label: string;
  value: string;
}

export interface AssistantStoreActionPayload {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface AssistantItemActionPayload {
  name: string;
  description?: string;
  notes?: string;
  category?: string;
  base_price_label?: string;
  sku?: string;
  item_type: ItemType;
}

export interface AssistantServiceActionPayload {
  name: string;
  description?: string;
  category?: string;
  base_price: number;
  unit_type?: string;
}

export interface AssistantAppointmentActionPayload {
  title: string;
  scheduled_for: string;
  starts_at: string | null;
  ends_at: string | null;
  notes?: string;
}

export interface AssistantJobServiceLinePayload {
  name: string;
  quantity: number;
  unit_price?: number | null;
  base_price?: number | null;
  description?: string;
  category?: string;
  unit_type?: string;
  notes?: string;
}

export interface AssistantJobMaterialLinePayload {
  name: string;
  quantity: number;
  unit?: string;
  unit_price?: number | null;
  description?: string;
  notes?: string;
  category?: string;
  base_price_label?: string;
  sku?: string;
  item_type: ItemType;
}

export interface AssistantJobActionPayload {
  client_name: string;
  client_phone?: string;
  title: string;
  description?: string;
  notes?: string;
  scheduled_for: string | null;
  starts_at: string | null;
  ends_at: string | null;
  default_material_margin_percent: number | null;
  source_store: AssistantStoreActionPayload | null;
  services: AssistantJobServiceLinePayload[];
  materials: AssistantJobMaterialLinePayload[];
}

export interface AssistantStorePriceLinePayload {
  name: string;
  price: number | null;
  quantity_reference?: string;
  description?: string;
  notes?: string;
  category?: string;
  base_price_label?: string;
  sku?: string;
  item_type: ItemType;
}

export interface AssistantStorePriceBatchActionPayload {
  store: AssistantStoreActionPayload | null;
  observed_at: string;
  currency: string;
  items: AssistantStorePriceLinePayload[];
  notes?: string;
}

interface AssistantActionBase<TKind extends AssistantActionKind, TPayload> {
  kind: TKind;
  summary: string;
  confidence: AssistantActionConfidence;
  payload: TPayload;
  problems: string[];
  hints: string[];
}

export type AssistantActionDraft =
  | AssistantActionBase<'create_store', AssistantStoreActionPayload>
  | AssistantActionBase<'create_item', AssistantItemActionPayload>
  | AssistantActionBase<'create_service', AssistantServiceActionPayload>
  | AssistantActionBase<'create_appointment', AssistantAppointmentActionPayload>
  | AssistantActionBase<'create_job', AssistantJobActionPayload>
  | AssistantActionBase<'create_store_price_batch', AssistantStorePriceBatchActionPayload>;

export interface AssistantPendingActionContext {
  type: AssistantActionKind;
  summary: string;
  confidence: AssistantActionConfidence;
  payload: Record<string, unknown>;
  problems: string[];
  hints: string[];
}

const ACTION_KIND_VALUES: AssistantActionKind[] = [
  'create_store',
  'create_item',
  'create_service',
  'create_appointment',
  'create_job',
  'create_store_price_batch',
];
const CONFIDENCE_VALUES: AssistantActionConfidence[] = ['low', 'medium', 'high'];
const ITEM_TYPE_VALUES: ItemType[] = ['product', 'tool', 'material', 'other'];
const DEFAULT_PENDING_CLIENT_NAME = 'Cliente pendiente';
const DEFAULT_JOB_TITLE = 'Trabajo tecnico';
const DEFAULT_PRICE_CURRENCY = 'ARS';

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toPayloadRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toPayloadArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const uniqueMessages = (messages: string[]): string[] => Array.from(new Set(messages.filter(Boolean)));

const isAssistantActionKind = (value: unknown): value is AssistantActionKind =>
  typeof value === 'string' && ACTION_KIND_VALUES.includes(value as AssistantActionKind);

const normalizeConfidence = (value: unknown): AssistantActionConfidence =>
  typeof value === 'string' && CONFIDENCE_VALUES.includes(value as AssistantActionConfidence) ? (value as AssistantActionConfidence) : 'medium';

const normalizeSummary = (value: unknown): string | null => {
  const normalized = toTrimmedString(value);
  return normalized ?? null;
};

const isItemType = (value: unknown): value is ItemType => typeof value === 'string' && ITEM_TYPE_VALUES.includes(value as ItemType);

const normalizeCatalogLookupName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const parseCurrencyLikeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\s+/g, '').replace(/\$/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if ((normalized.match(/\./g) ?? []).length > 1) {
    normalized = normalized.replace(/\./g, '');
  }

  normalized = normalized.replace(/[^0-9.-]/g, '');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatActionDate = (value: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateAr(value) : value);

const zodMessages = (issues: Array<{ message: string }>): string[] => uniqueMessages(issues.map((issue) => issue.message));
const getTodayIso = (): string => formatIsoDate(new Date());

const toOptionalStorePayload = (value: unknown): AssistantStoreActionPayload | null => {
  if (typeof value === 'string') {
    const name = toTrimmedString(value);
    return name ? { name } : null;
  }

  const payload = toPayloadRecord(value);
  const name = toTrimmedString(payload.name);
  const description = toTrimmedString(payload.description);
  const address = toTrimmedString(payload.address);
  const phone = toTrimmedString(payload.phone);
  const notes = toTrimmedString(payload.notes);

  if (!name && !description && !address && !phone && !notes) {
    return null;
  }

  return {
    name: name ?? '',
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(notes ? { notes } : {}),
  };
};

const parsePositiveNumber = (value: unknown): number | null => {
  const parsed = parseCurrencyLikeNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
};

const deriveJobTitle = (services: AssistantJobServiceLinePayload[], materials: AssistantJobMaterialLinePayload[]): string => {
  const firstService = services[0]?.name?.trim();
  if (firstService) {
    return firstService;
  }

  const firstMaterial = materials[0]?.name?.trim();
  if (firstMaterial) {
    return `Trabajo con ${firstMaterial}`;
  }

  return DEFAULT_JOB_TITLE;
};

const buildJobServiceLine = (
  value: unknown,
  index: number,
  hints: string[],
  problems: string[],
): AssistantJobServiceLinePayload | null => {
  const payload = typeof value === 'string' ? { name: value } : toPayloadRecord(value);
  const name = toTrimmedString(payload.name) ?? '';
  const description = toTrimmedString(payload.description);
  const category = toTrimmedString(payload.category);
  const unitType = toTrimmedString(payload.unit_type);
  const notes = toTrimmedString(payload.notes);

  if (!name) {
    problems.push(`Servicio ${index + 1}: falta el nombre.`);
    return null;
  }

  const quantity = parsePositiveNumber(payload.quantity) ?? 1;
  if (payload.quantity != null && parsePositiveNumber(payload.quantity) == null) {
    hints.push(`Servicio "${name}": cantidad no valida. Se usara 1.`);
  }

  const unitPrice = parseCurrencyLikeNumber(payload.unit_price);
  const basePrice = parseCurrencyLikeNumber(payload.base_price);
  if (payload.unit_price != null && unitPrice == null) {
    hints.push(`Servicio "${name}": precio no claro. Se usara el catalogo o $0.`);
  }

  return {
    name,
    quantity,
    ...(unitPrice != null ? { unit_price: unitPrice } : {}),
    ...(basePrice != null ? { base_price: basePrice } : {}),
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(unitType ? { unit_type: unitType } : {}),
    ...(notes ? { notes } : {}),
  };
};

const buildJobMaterialLine = (
  value: unknown,
  index: number,
  hints: string[],
  problems: string[],
): AssistantJobMaterialLinePayload | null => {
  const payload = typeof value === 'string' ? { name: value } : toPayloadRecord(value);
  const name = toTrimmedString(payload.name) ?? '';
  const unit = toTrimmedString(payload.unit);
  const description = toTrimmedString(payload.description);
  const notes = toTrimmedString(payload.notes);
  const category = toTrimmedString(payload.category);
  const basePriceLabel = toTrimmedString(payload.base_price_label);
  const sku = toTrimmedString(payload.sku);

  if (!name) {
    problems.push(`Material ${index + 1}: falta el nombre.`);
    return null;
  }

  const quantity = parsePositiveNumber(payload.quantity) ?? 1;
  if (payload.quantity != null && parsePositiveNumber(payload.quantity) == null) {
    hints.push(`Material "${name}": cantidad no valida. Se usara 1.`);
  }

  const unitPrice = parseCurrencyLikeNumber(payload.unit_price);
  if (payload.unit_price != null && unitPrice == null) {
    problems.push(`Material "${name}": el precio no es valido.`);
  }

  const rawItemType = payload.item_type;
  const itemType = isItemType(rawItemType) ? rawItemType : 'material';
  if (rawItemType && !isItemType(rawItemType)) {
    hints.push(`Material "${name}": tipo no valido. Se guardara como material.`);
  }

  return {
    name,
    quantity,
    ...(unit ? { unit } : {}),
    ...(unitPrice != null ? { unit_price: unitPrice } : {}),
    ...(description ? { description } : {}),
    ...(notes ? { notes } : {}),
    ...(category ? { category } : {}),
    ...(basePriceLabel ? { base_price_label: basePriceLabel } : {}),
    ...(sku ? { sku } : {}),
    item_type: itemType,
  };
};

const buildStorePriceLine = (
  value: unknown,
  index: number,
  hints: string[],
  problems: string[],
): AssistantStorePriceLinePayload | null => {
  const payload = typeof value === 'string' ? { name: value } : toPayloadRecord(value);
  const name = toTrimmedString(payload.name) ?? '';
  const description = toTrimmedString(payload.description);
  const notes = toTrimmedString(payload.notes);
  const category = toTrimmedString(payload.category);
  const basePriceLabel = toTrimmedString(payload.base_price_label);
  const sku = toTrimmedString(payload.sku);
  const quantityReference = toTrimmedString(payload.quantity_reference);

  if (!name) {
    problems.push(`Material ${index + 1}: falta el nombre.`);
    return null;
  }

  const rawItemType = payload.item_type;
  const itemType = isItemType(rawItemType) ? rawItemType : 'material';
  if (!rawItemType) {
    hints.push(`Material "${name}": tipo no informado. Se guardara como material.`);
  } else if (!isItemType(rawItemType)) {
    hints.push(`Material "${name}": tipo no valido. Se guardara como material.`);
  }

  const parsedPrice = parseCurrencyLikeNumber(payload.price);
  let price: number | null = null;
  if (payload.price == null || payload.price === '') {
    problems.push(`Material "${name}": falta el precio para asociarlo a la tienda.`);
  } else if (parsedPrice == null || parsedPrice <= 0) {
    problems.push(`Material "${name}": el precio no es valido.`);
  } else {
    price = parsedPrice;
  }

  return {
    name,
    price,
    ...(quantityReference ? { quantity_reference: quantityReference } : {}),
    ...(description ? { description } : {}),
    ...(notes ? { notes } : {}),
    ...(category ? { category } : {}),
    ...(basePriceLabel ? { base_price_label: basePriceLabel } : {}),
    ...(sku ? { sku } : {}),
    item_type: itemType,
  };
};

const buildStoreAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const description = toTrimmedString(payload.description);
  const address = toTrimmedString(payload.address);
  const phone = toTrimmedString(payload.phone);
  const notes = toTrimmedString(payload.notes);
  const candidate: AssistantStoreActionPayload = {
    name: toTrimmedString(payload.name) ?? '',
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(notes ? { notes } : {}),
  };

  const parsed = storeSchema.safeParse(candidate);
  const problems = parsed.success ? [] : zodMessages(parsed.error.issues);
  const summary = normalizeSummary(proposal.summary) ?? `Crear tienda "${candidate.name || 'sin nombre'}"`;

  return {
    kind: 'create_store',
    summary,
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems,
    hints: [],
  };
};

const buildItemAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const rawItemType = payload.item_type;
  const normalizedItemType = isItemType(rawItemType) ? rawItemType : 'material';
  const description = toTrimmedString(payload.description);
  const notes = toTrimmedString(payload.notes);
  const category = toTrimmedString(payload.category);
  const basePriceLabel = toTrimmedString(payload.base_price_label);
  const sku = toTrimmedString(payload.sku);
  const hints: string[] = [];

  if (!rawItemType) {
    hints.push('Tipo no informado. Se guardara como material.');
  } else if (!isItemType(rawItemType)) {
    hints.push('Tipo no valido. Se guardara como material.');
  }

  const candidate: AssistantItemActionPayload = {
    name: toTrimmedString(payload.name) ?? '',
    ...(description ? { description } : {}),
    ...(notes ? { notes } : {}),
    ...(category ? { category } : {}),
    ...(basePriceLabel ? { base_price_label: basePriceLabel } : {}),
    ...(sku ? { sku } : {}),
    item_type: normalizedItemType,
  };

  const parsed = itemSchema.safeParse(candidate);
  const problems = parsed.success ? [] : zodMessages(parsed.error.issues);
  const itemTypeLabel = normalizedItemType === 'material' ? 'material' : normalizedItemType;
  const summary = normalizeSummary(proposal.summary) ?? `Crear ${itemTypeLabel} "${candidate.name || 'sin nombre'}"`;

  return {
    kind: 'create_item',
    summary,
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems,
    hints,
  };
};

const buildServiceAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const rawBasePrice = payload.base_price;
  const normalizedBasePrice = parseCurrencyLikeNumber(rawBasePrice);
  const description = toTrimmedString(payload.description);
  const category = toTrimmedString(payload.category);
  const unitType = toTrimmedString(payload.unit_type);
  const hints: string[] = [];
  const problems: string[] = [];

  if (rawBasePrice == null || rawBasePrice === '') {
    problems.push('El precio base del servicio es obligatorio.');
  } else if (normalizedBasePrice == null) {
    problems.push('El precio base del servicio no es valido.');
  }

  const candidate: AssistantServiceActionPayload = {
    name: toTrimmedString(payload.name) ?? '',
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    base_price: normalizedBasePrice ?? 0,
    ...(unitType ? { unit_type: unitType } : {}),
  };

  const parsed = serviceSchema.safeParse(candidate);
  const schemaProblems = parsed.success ? [] : zodMessages(parsed.error.issues);
  const summary =
    normalizeSummary(proposal.summary) ??
    `Crear servicio "${candidate.name || 'sin nombre'}"${candidate.base_price > 0 ? ` por ${formatCurrencyArs(candidate.base_price)}` : ''}`;

  return {
    kind: 'create_service',
    summary,
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems: uniqueMessages([...problems, ...schemaProblems]),
    hints,
  };
};

const buildAppointmentAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const rawTitle = toTrimmedString(payload.title) ?? '';
  const rawDate = toTrimmedString(payload.scheduled_for) ?? '';
  const rawStartsAt = toTrimmedString(payload.starts_at);
  const rawEndsAt = toTrimmedString(payload.ends_at);
  const hints: string[] = [];
  const problems: string[] = [];

  let scheduledFor = rawDate;
  if (!rawTitle) {
    problems.push('El titulo del turno es obligatorio.');
  }

  if (!rawDate) {
    problems.push('La fecha del turno es obligatoria.');
  } else {
    try {
      scheduledFor = normalizeDateInput(rawDate);
    } catch {
      problems.push('La fecha del turno no es valida. Pedi una fecha mas precisa.');
    }
  }

  let startsAt: string | null = null;
  if (rawStartsAt) {
    try {
      startsAt = normalizeOptionalTimeInput(rawStartsAt);
    } catch {
      problems.push('La hora de inicio no es valida.');
    }
  } else {
    hints.push('Sin hora. Se guardara como turno sin horario.');
  }

  let endsAt: string | null = null;
  if (rawEndsAt) {
    try {
      endsAt = normalizeOptionalTimeInput(rawEndsAt);
    } catch {
      problems.push('La hora de fin no es valida.');
    }
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    hints.push('Revisa el horario: la hora de fin queda antes o igual que la de inicio.');
  }

  const notes = toTrimmedString(payload.notes);
  const candidate: AssistantAppointmentActionPayload = {
    title: rawTitle,
    scheduled_for: scheduledFor,
    starts_at: startsAt,
    ends_at: endsAt,
    ...(notes ? { notes } : {}),
  };

  const summaryParts = [
    `Crear turno "${candidate.title || 'sin titulo'}"`,
    candidate.scheduled_for ? `para ${formatActionDate(candidate.scheduled_for)}` : 'sin fecha clara',
    candidate.starts_at ? `a las ${formatTimeShort(candidate.starts_at)}` : '',
  ].filter(Boolean);

  return {
    kind: 'create_appointment',
    summary: normalizeSummary(proposal.summary) ?? summaryParts.join(' '),
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems: uniqueMessages(problems),
    hints: uniqueMessages(hints),
  };
};

const buildJobAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const hints: string[] = [];
  const problems: string[] = [];

  const services = toPayloadArray(payload.services)
    .map((entry, index) => buildJobServiceLine(entry, index, hints, problems))
    .filter((entry): entry is AssistantJobServiceLinePayload => entry != null);
  const materials = toPayloadArray(payload.materials)
    .map((entry, index) => buildJobMaterialLine(entry, index, hints, problems))
    .filter((entry): entry is AssistantJobMaterialLinePayload => entry != null);

  if (services.length === 0 && materials.length === 0) {
    problems.push('El trabajo necesita al menos un servicio o un material.');
  }

  const rawClientName = toTrimmedString(payload.client_name);
  const clientName = rawClientName ?? DEFAULT_PENDING_CLIENT_NAME;
  if (!rawClientName) {
    problems.push('Falta indicar el cliente del trabajo.');
    hints.push(`Cliente no informado. Se usara "${DEFAULT_PENDING_CLIENT_NAME}".`);
  }

  const clientPhone = toTrimmedString(payload.client_phone);
  const description = toTrimmedString(payload.description);
  const notes = toTrimmedString(payload.notes);

  const rawTitle = toTrimmedString(payload.title);
  const title = rawTitle ?? deriveJobTitle(services, materials);
  if (!rawTitle) {
    hints.push(`Titulo no informado. Se usara "${title}".`);
  }

  const rawDate = toTrimmedString(payload.scheduled_for);
  const rawStartsAt = toTrimmedString(payload.starts_at);
  const rawEndsAt = toTrimmedString(payload.ends_at);
  let scheduledFor: string | null = null;
  let startsAt: string | null = null;
  let endsAt: string | null = null;

  if (rawDate) {
    try {
      scheduledFor = normalizeDateInput(rawDate);
    } catch {
      problems.push('La fecha del trabajo no es valida. Pedi una fecha mas precisa.');
    }
  } else if (rawStartsAt || rawEndsAt) {
    hints.push('Hay horario pero falta fecha. Se creara el presupuesto sin turno.');
  } else {
    hints.push('Sin fecha. Se creara el trabajo como presupuesto sin turno.');
  }

  if (rawStartsAt) {
    try {
      startsAt = normalizeOptionalTimeInput(rawStartsAt);
    } catch {
      problems.push('La hora de inicio no es valida.');
    }
  }

  if (rawEndsAt) {
    try {
      endsAt = normalizeOptionalTimeInput(rawEndsAt);
    } catch {
      problems.push('La hora de fin no es valida.');
    }
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    hints.push('Revisa el horario: la hora de fin queda antes o igual que la de inicio.');
  }

  const rawMargin = payload.default_material_margin_percent;
  let defaultMaterialMarginPercent: number | null = null;
  if (rawMargin != null && rawMargin !== '') {
    const parsedMargin = parseCurrencyLikeNumber(rawMargin);
    if (parsedMargin == null || parsedMargin < 0) {
      problems.push('El margen de materiales no es valido.');
    } else {
      defaultMaterialMarginPercent = parsedMargin;
    }
  }

  const sourceStore = toOptionalStorePayload(payload.source_store ?? payload.store ?? payload.store_name);
  if (sourceStore && !sourceStore.name) {
    problems.push('La tienda indicada no tiene nombre valido.');
  }

  const quoteCandidate = {
    client_name: clientName,
    title,
    ...(clientPhone ? { client_phone: clientPhone } : {}),
    ...(notes ? { notes } : {}),
  };
  const parsedQuote = quoteSchema.safeParse(quoteCandidate);
  if (!parsedQuote.success) {
    problems.push(...zodMessages(parsedQuote.error.issues));
  }

  const candidate: AssistantJobActionPayload = {
    client_name: clientName,
    ...(clientPhone ? { client_phone: clientPhone } : {}),
    title,
    ...(description ? { description } : {}),
    ...(notes ? { notes } : {}),
    scheduled_for: scheduledFor,
    starts_at: startsAt,
    ends_at: endsAt,
    default_material_margin_percent: defaultMaterialMarginPercent,
    source_store: sourceStore,
    services,
    materials,
  };

  const summaryParts = [
    `Crear trabajo "${title}"`,
    clientName ? `para ${clientName}` : '',
    scheduledFor ? `el ${formatActionDate(scheduledFor)}` : '',
  ].filter(Boolean);

  if (sourceStore?.name) {
    const normalizedStoreName = normalizeCatalogLookupName(sourceStore.name);
    if (!normalizedStoreName) {
      problems.push('La tienda indicada no tiene nombre valido.');
    }
  }

  return {
    kind: 'create_job',
    summary: normalizeSummary(proposal.summary) ?? summaryParts.join(' '),
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems: uniqueMessages(problems),
    hints: uniqueMessages(hints),
  };
};

const buildStorePriceBatchAction = (proposal: AssistantActionProposal): AssistantActionDraft => {
  const payload = toPayloadRecord(proposal.payload);
  const hints: string[] = [];
  const problems: string[] = [];

  const store = toOptionalStorePayload(payload.store ?? payload.source_store ?? payload.store_name);
  if (!store?.name.trim()) {
    problems.push('La tienda es obligatoria para cargar materiales con precio.');
  } else {
    const parsedStore = storeSchema.safeParse(store);
    if (!parsedStore.success) {
      problems.push(...zodMessages(parsedStore.error.issues));
    }
  }

  const rawObservedAt = toTrimmedString(payload.observed_at);
  let observedAt = getTodayIso();
  if (rawObservedAt) {
    try {
      observedAt = normalizeDateInput(rawObservedAt);
    } catch {
      problems.push('La fecha de precio no es valida.');
    }
  } else {
    hints.push(`Fecha no informada. Se usara ${formatActionDate(observedAt)}.`);
  }

  const rawCurrency = toTrimmedString(payload.currency);
  const currency = rawCurrency?.toUpperCase() ?? DEFAULT_PRICE_CURRENCY;
  if (!rawCurrency) {
    hints.push(`Moneda no informada. Se usara ${DEFAULT_PRICE_CURRENCY}.`);
  }

  const notes = toTrimmedString(payload.notes);
  const items = toPayloadArray(payload.items ?? payload.materials)
    .map((entry, index) => buildStorePriceLine(entry, index, hints, problems))
    .filter((entry): entry is AssistantStorePriceLinePayload => entry != null);

  if (items.length === 0) {
    problems.push('Hace falta al menos un material para asociar a la tienda.');
  }

  const candidate: AssistantStorePriceBatchActionPayload = {
    store: store ?? null,
    observed_at: observedAt,
    currency,
    items,
    ...(notes ? { notes } : {}),
  };

  return {
    kind: 'create_store_price_batch',
    summary:
      normalizeSummary(proposal.summary) ??
      `Cargar ${items.length || 0} precio(s) en ${store?.name?.trim() || 'tienda pendiente'}`,
    confidence: normalizeConfidence(proposal.confidence),
    payload: candidate,
    problems: uniqueMessages(problems),
    hints: uniqueMessages(hints),
  };
};

export const normalizeAssistantAction = (proposal: AssistantActionProposal | null | undefined): AssistantActionDraft | null => {
  if (!proposal || !isAssistantActionKind(proposal.type)) return null;

  switch (proposal.type) {
    case 'create_store':
      return buildStoreAction(proposal);
    case 'create_item':
      return buildItemAction(proposal);
    case 'create_service':
      return buildServiceAction(proposal);
    case 'create_appointment':
      return buildAppointmentAction(proposal);
    case 'create_job':
      return buildJobAction(proposal);
    case 'create_store_price_batch':
      return buildStorePriceBatchAction(proposal);
    default:
      return null;
  }
};

export const isAssistantActionExecutable = (action: AssistantActionDraft): boolean => action.problems.length === 0;
export const needsAssistantActionFollowUp = (action: AssistantActionDraft): boolean => action.problems.length > 0;

export const serializeAssistantActionDraft = (action: AssistantActionDraft): AssistantPendingActionContext => ({
  type: action.kind,
  summary: action.summary,
  confidence: action.confidence,
  payload: action.payload as unknown as Record<string, unknown>,
  problems: [...action.problems],
  hints: [...action.hints],
});

export const getAssistantActionTypeLabel = (action: AssistantActionDraft): string => {
  switch (action.kind) {
    case 'create_store':
      return 'Crear tienda';
    case 'create_item':
      return 'Crear material';
    case 'create_service':
      return 'Crear servicio';
    case 'create_appointment':
      return 'Crear turno';
    case 'create_job':
      return 'Crear trabajo';
    case 'create_store_price_batch':
      return 'Cargar precios en tienda';
    default:
      return 'Accion';
  }
};

export const getAssistantActionDetails = (action: AssistantActionDraft): AssistantActionDetail[] => {
  switch (action.kind) {
    case 'create_store':
      return [
        { label: 'Nombre', value: action.payload.name || 'Sin definir' },
        ...(action.payload.address ? [{ label: 'Direccion', value: action.payload.address }] : []),
        ...(action.payload.phone ? [{ label: 'Telefono', value: action.payload.phone }] : []),
      ];
    case 'create_item':
      return [
        { label: 'Nombre', value: action.payload.name || 'Sin definir' },
        { label: 'Tipo', value: action.payload.item_type },
        ...(action.payload.category ? [{ label: 'Categoria', value: action.payload.category }] : []),
        ...(action.payload.base_price_label ? [{ label: 'Referencia base', value: action.payload.base_price_label }] : []),
      ];
    case 'create_service':
      return [
        { label: 'Nombre', value: action.payload.name || 'Sin definir' },
        ...(action.payload.category ? [{ label: 'Categoria', value: action.payload.category }] : []),
        { label: 'Precio base', value: formatCurrencyArs(action.payload.base_price) },
      ];
    case 'create_appointment':
      return [
        { label: 'Titulo', value: action.payload.title || 'Sin definir' },
        { label: 'Fecha', value: action.payload.scheduled_for ? formatActionDate(action.payload.scheduled_for) : 'Sin definir' },
        ...(action.payload.starts_at ? [{ label: 'Hora', value: formatTimeShort(action.payload.starts_at) }] : []),
        ...(action.payload.ends_at ? [{ label: 'Fin', value: formatTimeShort(action.payload.ends_at) }] : []),
      ];
    case 'create_job':
      return [
        { label: 'Cliente', value: action.payload.client_name || 'Sin definir' },
        { label: 'Titulo', value: action.payload.title || 'Sin definir' },
        { label: 'Fecha', value: action.payload.scheduled_for ? formatActionDate(action.payload.scheduled_for) : 'Sin turno' },
        ...(action.payload.starts_at ? [{ label: 'Hora', value: formatTimeShort(action.payload.starts_at) }] : []),
        ...(action.payload.source_store?.name ? [{ label: 'Tienda', value: action.payload.source_store.name }] : []),
        ...(action.payload.default_material_margin_percent != null
          ? [{ label: 'Margen materiales', value: formatPercent(action.payload.default_material_margin_percent) }]
          : []),
        { label: 'Servicios', value: String(action.payload.services.length) },
        { label: 'Materiales', value: String(action.payload.materials.length) },
      ];
    case 'create_store_price_batch':
      return [
        { label: 'Tienda', value: action.payload.store?.name || 'Sin definir' },
        { label: 'Fecha', value: action.payload.observed_at ? formatActionDate(action.payload.observed_at) : 'Sin definir' },
        { label: 'Moneda', value: action.payload.currency || DEFAULT_PRICE_CURRENCY },
        { label: 'Materiales', value: String(action.payload.items.length) },
      ];
    default:
      return [];
  }
};
