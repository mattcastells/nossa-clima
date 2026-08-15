import { describe, expect, it, vi, beforeEach } from 'vitest';

type QuoteRow = {
  client_name: string | null;
  client_phone: string | null;
  description: string | null;
  created_at: string;
};

const state: { rows: QuoteRow[]; selectError: unknown } = { rows: [], selectError: null };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: state.rows, error: state.selectError }),
      }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  },
}));

// status.ts arrastra @/theme -> react-native-paper, que no se puede cargar en
// el entorno node de vitest. listClientDirectory no lo usa.
vi.mock('@/features/quotes/status', () => ({
  normalizeQuoteStatus: (value: string) => value,
}));

import { listClientDirectory, normalizeClientName } from '@/services/quotes';

describe('normalizeClientName', () => {
  it('recorta, baja a minusculas y colapsa espacios', () => {
    expect(normalizeClientName('  Juan   PEREZ ')).toBe('juan perez');
  });

  it('deja igual un nombre ya normalizado', () => {
    expect(normalizeClientName('juan perez')).toBe('juan perez');
  });
});

describe('listClientDirectory', () => {
  beforeEach(() => {
    state.rows = [];
    state.selectError = null;
  });

  it('agrupa el mismo cliente escrito distinto', async () => {
    state.rows = [
      { client_name: 'Juan Perez', client_phone: '11 1111', description: 'Mitre 100', created_at: '2026-08-10' },
      { client_name: '  juan   perez ', client_phone: '11 2222', description: 'Mitre 200', created_at: '2026-08-01' },
    ];

    const directory = await listClientDirectory();

    expect(directory).toHaveLength(1);
    expect(directory[0]?.jobCount).toBe(2);
  });

  it('se queda con los datos del trabajo mas reciente', async () => {
    // La query pide order(created_at desc), asi que la primera fila es la mas nueva.
    state.rows = [
      { client_name: 'Juan Perez', client_phone: '11 NUEVO', description: 'Domicilio nuevo', created_at: '2026-08-10' },
      { client_name: 'Juan Perez', client_phone: '11 VIEJO', description: 'Domicilio viejo', created_at: '2026-08-01' },
    ];

    const [entry] = await listClientDirectory();

    expect(entry?.phone).toBe('11 NUEVO');
    expect(entry?.address).toBe('Domicilio nuevo');
  });

  it('completa con un trabajo viejo lo que el mas nuevo dejo vacio', async () => {
    state.rows = [
      { client_name: 'Juan Perez', client_phone: null, description: null, created_at: '2026-08-10' },
      { client_name: 'Juan Perez', client_phone: '11 2222', description: 'Mitre 200', created_at: '2026-08-01' },
    ];

    const [entry] = await listClientDirectory();

    expect(entry?.phone).toBe('11 2222');
    expect(entry?.address).toBe('Mitre 200');
  });

  it('ignora trabajos sin nombre de cliente', async () => {
    state.rows = [
      { client_name: '   ', client_phone: '11 1111', description: null, created_at: '2026-08-10' },
      { client_name: null, client_phone: null, description: null, created_at: '2026-08-09' },
      { client_name: 'Ana Gomez', client_phone: null, description: null, created_at: '2026-08-08' },
    ];

    const directory = await listClientDirectory();

    expect(directory.map((entry) => entry.name)).toEqual(['Ana Gomez']);
  });

  it('ordena alfabeticamente y preserva el nombre tal como se escribio', async () => {
    state.rows = [
      { client_name: 'Zulema Ruiz', client_phone: null, description: null, created_at: '2026-08-10' },
      { client_name: 'Ana Gomez', client_phone: null, description: null, created_at: '2026-08-09' },
    ];

    const directory = await listClientDirectory();

    expect(directory.map((entry) => entry.name)).toEqual(['Ana Gomez', 'Zulema Ruiz']);
  });

  it('devuelve vacio si no hay trabajos', async () => {
    state.rows = [];
    await expect(listClientDirectory()).resolves.toEqual([]);
  });
});
