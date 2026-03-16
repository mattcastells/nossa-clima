type ItemDisplayFields = {
  name?: string | null | undefined;
  variant_label?: string | null | undefined;
  presentation_quantity?: number | string | null | undefined;
  presentation_unit?: string | null | undefined;
  unit?: string | null | undefined;
};

type MeasurementDisplayFields = {
  label?: string | null | undefined;
  unit?: string | null | undefined;
};

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parsePositiveDecimalInput = (value: string | null | undefined): number | null => {
  const parsed = normalizeNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
};

export const formatItemNumericValue = (value: number | string | null | undefined): string => {
  const normalized = normalizeNumber(value);
  if (normalized == null) return '';

  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(normalized);
};

export const formatItemPresentation = (item: ItemDisplayFields): string | null => {
  const presentationQuantity = normalizeNumber(item.presentation_quantity);
  const presentationUnit = normalizeText(item.presentation_unit);

  if (presentationQuantity == null || !presentationUnit) {
    return null;
  }

  const presentation = `${formatItemNumericValue(presentationQuantity)} ${presentationUnit}`;
  const itemUnit = normalizeText(item.unit);

  return itemUnit ? `${presentation} por ${itemUnit}` : presentation;
};

export const formatItemVariantSummary = (item: ItemDisplayFields): string | null => {
  const parts = [normalizeText(item.variant_label), formatItemPresentation(item)].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : null;
};

export const formatItemDisplayName = (item: ItemDisplayFields): string => {
  const baseName = normalizeText(item.name) ?? 'Material';
  const variantSummary = formatItemVariantSummary(item);
  return variantSummary ? `${baseName} · ${variantSummary}` : baseName;
};

export const formatMeasurementDisplayLabel = (measurement: MeasurementDisplayFields): string | null => {
  const label = normalizeText(measurement.label);
  if (!label) return null;

  const unit = normalizeText(measurement.unit);
  return unit ? `${label} (${unit})` : label;
};

export const formatMeasuredItemDisplayName = (
  item: Pick<ItemDisplayFields, 'name'>,
  measurement: MeasurementDisplayFields | null | undefined,
): string => {
  const baseName = normalizeText(item.name) ?? 'Material';
  const measurementLabel = measurement ? formatMeasurementDisplayLabel(measurement) : null;

  return measurementLabel ? `${baseName} ${measurementLabel}` : baseName;
};
