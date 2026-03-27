import { describe, expect, it } from 'vitest';

import { getAssistantActionDetails, isAssistantActionExecutable, normalizeAssistantAction } from '../actions';

describe('assistant actions', () => {
  it('normaliza una tienda simple', () => {
    const action = normalizeAssistantAction({
      type: 'create_store',
      payload: {
        name: 'Frio Sur',
        address: 'Av. Belgrano 123',
      },
    });

    expect(action?.kind).toBe('create_store');
    if (!action || action.kind !== 'create_store') throw new Error('Expected create_store action');
    expect(action.payload.name).toBe('Frio Sur');
    expect(action.problems).toEqual([]);
    expect(isAssistantActionExecutable(action)).toBe(true);
  });

  it('defaultea materiales sin tipo a material', () => {
    const action = normalizeAssistantAction({
      type: 'create_item',
      payload: {
        name: 'Cano de cobre',
      },
    });

    expect(action?.kind).toBe('create_item');
    if (!action || action.kind !== 'create_item') throw new Error('Expected create_item action');
    expect(action.payload.item_type).toBe('material');
    expect(action.hints).toContain('Tipo no informado. Se guardara como material.');
  });

  it('deja pendiente servicios sin precio', () => {
    const action = normalizeAssistantAction({
      type: 'create_service',
      payload: {
        name: 'Limpieza de split',
      },
    });

    expect(action?.kind).toBe('create_service');
    if (!action || action.kind !== 'create_service') throw new Error('Expected create_service action');
    expect(action.payload.base_price).toBe(0);
    expect(action.problems).toContain('El precio base del servicio es obligatorio.');
    expect(isAssistantActionExecutable(action)).toBe(false);
  });

  it('normaliza turnos con fecha y hora', () => {
    const action = normalizeAssistantAction({
      type: 'create_appointment',
      payload: {
        title: 'Visita tecnica Carlos Gomez',
        scheduled_for: '28-03-2026',
        starts_at: '15:30',
      },
    });

    expect(action?.kind).toBe('create_appointment');
    if (!action || action.kind !== 'create_appointment') throw new Error('Expected create_appointment action');
    expect(action.payload.scheduled_for).toBe('2026-03-28');
    expect(action.payload.starts_at).toBe('15:30:00');
    expect(action.problems).toEqual([]);
  });

  it('bloquea turnos sin fecha', () => {
    const action = normalizeAssistantAction({
      type: 'create_appointment',
      payload: {
        title: 'Instalacion split',
      },
    });

    expect(action?.kind).toBe('create_appointment');
    if (!action || action.kind !== 'create_appointment') throw new Error('Expected create_appointment action');
    expect(action.problems).toContain('La fecha del turno es obligatoria.');
    expect(isAssistantActionExecutable(action)).toBe(false);
  });

  it('normaliza trabajos con servicios, materiales y margen global', () => {
    const action = normalizeAssistantAction({
      type: 'create_job',
      payload: {
        client_name: 'Carlos Gomez',
        title: 'Instalacion split 3000 fg',
        scheduled_for: '28-03-2026',
        starts_at: '09:30',
        default_material_margin_percent: '18',
        source_store: {
          name: 'Frio Sur',
        },
        services: [
          {
            name: 'Instalacion split 3000 fg',
            quantity: 1,
          },
        ],
        materials: [
          {
            name: 'Cano de cobre 1/4',
            quantity: '3',
            unit: 'mt',
          },
          'Mensulas',
        ],
      },
    });

    expect(action?.kind).toBe('create_job');
    if (!action || action.kind !== 'create_job') throw new Error('Expected create_job action');
    expect(action.payload.client_name).toBe('Carlos Gomez');
    expect(action.payload.scheduled_for).toBe('2026-03-28');
    expect(action.payload.starts_at).toBe('09:30:00');
    expect(action.payload.default_material_margin_percent).toBe(18);
    expect(action.payload.services).toHaveLength(1);
    expect(action.payload.materials).toHaveLength(2);
    expect(action.payload.materials[1]?.item_type).toBe('material');
    expect(action.problems).toEqual([]);
  });

  it('deja pendiente trabajos sin cliente y exige al menos una linea', () => {
    const action = normalizeAssistantAction({
      type: 'create_job',
      payload: {
        materials: [],
        services: [],
      },
    });

    expect(action?.kind).toBe('create_job');
    if (!action || action.kind !== 'create_job') throw new Error('Expected create_job action');
    expect(action.payload.client_name).toBe('Cliente pendiente');
    expect(action.payload.title).toBe('Trabajo tecnico');
    expect(action.problems).toContain('Falta indicar el cliente del trabajo.');
    expect(action.problems).toContain('El trabajo necesita al menos un servicio o un material.');
    expect(action.hints).toContain('Cliente no informado. Se usara "Cliente pendiente".');
    expect(isAssistantActionExecutable(action)).toBe(false);
  });

  it('mantiene el batch de precios pendiente si falta algun precio', () => {
    const action = normalizeAssistantAction({
      type: 'create_store_price_batch',
      payload: {
        store: {
          name: 'Frio Sur',
        },
        items: [
          {
            name: 'Cano de cobre 1/4',
          },
        ],
      },
    });

    expect(action?.kind).toBe('create_store_price_batch');
    if (!action || action.kind !== 'create_store_price_batch') throw new Error('Expected create_store_price_batch action');
    expect(action.payload.store?.name).toBe('Frio Sur');
    expect(action.payload.currency).toBe('ARS');
    expect(action.problems).toContain('Material "Cano de cobre 1/4": falta el precio para asociarlo a la tienda.');
    expect(isAssistantActionExecutable(action)).toBe(false);
  });

  it('normaliza un batch de precios para una tienda', () => {
    const action = normalizeAssistantAction({
      type: 'create_store_price_batch',
      payload: {
        store_name: 'Clima Center',
        observed_at: '29-03-2026',
        currency: 'usd',
        items: [
          {
            name: 'Cinta aisladora',
            price: '4500',
            quantity_reference: 'unidad',
          },
          {
            name: 'Mensula',
            price: 18000,
          },
        ],
      },
    });

    expect(action?.kind).toBe('create_store_price_batch');
    if (!action || action.kind !== 'create_store_price_batch') throw new Error('Expected create_store_price_batch action');
    expect(action.payload.store?.name).toBe('Clima Center');
    expect(action.payload.observed_at).toBe('2026-03-29');
    expect(action.payload.currency).toBe('USD');
    expect(action.payload.items).toHaveLength(2);
    expect(action.payload.items[0]?.price).toBe(4500);
    expect(action.payload.items[0]?.quantity_reference).toBe('unidad');
    expect(action.problems).toEqual([]);
    expect(isAssistantActionExecutable(action)).toBe(true);
  });

  it('expone detalles legibles para la UI', () => {
    const action = normalizeAssistantAction({
      type: 'create_service',
      payload: {
        name: 'Carga de gas',
        category: 'Gas refrigerante',
        base_price: 90000,
      },
    });

    const details = getAssistantActionDetails(action!);
    expect(details).toEqual([
      { label: 'Nombre', value: 'Carga de gas' },
      { label: 'Categoria', value: 'Gas refrigerante' },
      { label: 'Precio base', value: expect.any(String) },
    ]);
  });
});
