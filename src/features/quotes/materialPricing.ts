const roundCurrency = (value: number): number => Number(value.toFixed(2));

export const getEffectiveMaterialMarginPercent = (
  itemMarginPercent?: number | null,
  quoteDefaultMarginPercent?: number | null,
): number => Number(itemMarginPercent ?? quoteDefaultMarginPercent ?? 0);

export const getMaterialEffectiveUnitPrice = (
  baseUnitCost: number,
  itemMarginPercent?: number | null,
  quoteDefaultMarginPercent?: number | null,
): number => {
  const effectiveMarginPercent = getEffectiveMaterialMarginPercent(itemMarginPercent, quoteDefaultMarginPercent);
  return roundCurrency(Number(baseUnitCost ?? 0) * (1 + effectiveMarginPercent / 100));
};

export const getMaterialEffectiveTotalPrice = (
  quantity: number,
  baseUnitCost: number,
  itemMarginPercent?: number | null,
  quoteDefaultMarginPercent?: number | null,
): number => roundCurrency(Number(quantity ?? 0) * getMaterialEffectiveUnitPrice(baseUnitCost, itemMarginPercent, quoteDefaultMarginPercent));

