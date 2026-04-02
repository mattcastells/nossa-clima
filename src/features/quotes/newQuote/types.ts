export type DraftServiceLine = {
  id: string;
  service_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  total_price: number;
};

export type DraftMaterialLine = {
  id: string;
  item_id: string;
  item_measurement_id: string | null;
  label: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  source_store_id: string | null;
  source_store_name: string | null;
  notes: string | null;
  total_price: number;
};

export const createDraftId = (): string =>
  `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
