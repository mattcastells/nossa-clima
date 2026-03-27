import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/stores', () => ({
  listStores: vi.fn(),
}));

vi.mock('@/services/items', () => ({
  listItems: vi.fn(),
}));

vi.mock('@/services/services', () => ({
  listServices: vi.fn(),
}));

vi.mock('@/services/prices', () => ({
  listLatestPrices: vi.fn(),
}));

vi.mock('@/services/quotes', () => ({
  deleteQuote: vi.fn(),
}));

import { listItems } from '@/services/items';
import { listLatestPrices } from '@/services/prices';
import { listServices } from '@/services/services';
import { listStores } from '@/services/stores';

import { normalizeAssistantAction } from '../actions';
import { validateAssistantActionDraft } from '../execution';

describe('assistant execution validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listStores).mockResolvedValue([]);
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(listLatestPrices).mockResolvedValue([]);
  });

  it('bloquea trabajos con materiales sin tienda', async () => {
    const action = normalizeAssistantAction({
      type: 'create_job',
      payload: {
        client_name: 'Carlos Gomez',
        title: 'Instalacion split',
        materials: [
          {
            name: 'Cano de cobre 1/4',
            quantity: 3,
          },
        ],
      },
    });

    if (!action || action.kind !== 'create_job') throw new Error('Expected create_job action');

    const reviewed = await validateAssistantActionDraft(action);
    expect(reviewed.kind).toBe('create_job');
    expect(reviewed.problems).toContain('Falta indicar la tienda de compra de los materiales.');
    expect(reviewed.problems).toContain('Material "Cano de cobre 1/4": falta indicar la tienda o el precio.');
  });

  it('permite trabajos con material sin precio si existe precio vigente en la tienda indicada', async () => {
    vi.mocked(listStores).mockResolvedValue([
      {
        id: 'store-1',
        name: 'Frio Sur',
      } as never,
    ]);
    vi.mocked(listItems).mockResolvedValue([
      {
        id: 'item-1',
        name: 'Cano de cobre 1/4',
      } as never,
    ]);
    vi.mocked(listLatestPrices).mockResolvedValue([
      {
        store_id: 'store-1',
        item_id: 'item-1',
        price: 25000,
      } as never,
    ]);

    const action = normalizeAssistantAction({
      type: 'create_job',
      payload: {
        client_name: 'Carlos Gomez',
        title: 'Instalacion split',
        source_store: {
          name: 'Frio Sur',
        },
        materials: [
          {
            name: 'Cano de cobre 1/4',
            quantity: 3,
          },
        ],
      },
    });

    if (!action || action.kind !== 'create_job') throw new Error('Expected create_job action');

    const reviewed = await validateAssistantActionDraft(action);
    expect(reviewed.problems).toEqual([]);
    expect(reviewed.hints.some((hint) => hint.includes('Material "Cano de cobre 1/4": se usara el precio vigente'))).toBe(true);
    expect(reviewed.hints.some((hint) => hint.includes('"Frio Sur"'))).toBe(true);
  });

  it('bloquea servicios dentro del trabajo si no hay precio ni servicio existente con precio', async () => {
    const action = normalizeAssistantAction({
      type: 'create_job',
      payload: {
        client_name: 'Carlos Gomez',
        title: 'Trabajo tecnico',
        services: [
          {
            name: 'Visita tecnica',
            quantity: 1,
          },
        ],
      },
    });

    if (!action || action.kind !== 'create_job') throw new Error('Expected create_job action');

    const reviewed = await validateAssistantActionDraft(action);
    expect(reviewed.problems).toContain(
      'Servicio "Visita tecnica": falta indicar un precio valido o usar un servicio ya existente con precio.',
    );
  });
});
