import { describe, expect, it, vi } from 'vitest';

// exportPdf importa modulos nativos de Expo y el PNG del logo. Nada de eso
// hace falta para verificar la plantilla, asi que se stubean.
vi.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ localUri: '', uri: '', downloaded: true }) } }));
vi.mock('expo-file-system', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  copyAsync: vi.fn(),
  documentDirectory: '',
  cacheDirectory: '',
  StorageAccessFramework: {},
}));
vi.mock('expo-print', () => ({ printToFileAsync: vi.fn(), printAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('../../../../assets/nc-logo-dark.png', () => ({ default: 1 }));

const { __buildQuotePdfHtmlForTests: buildHtml } = await import('../exportPdf');

type Detail = Parameters<typeof buildHtml>[0];

const baseQuote = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'u1',
  client_name: 'Juan Perez',
  client_phone: '11 1234 5678',
  title: 'Service de split',
  description: 'Av. Mitre 1200',
  status: 'completed' as const,
  notes: 'Se limpio el filtro.',
  technician_notes: 'SECRETO-DEL-TECNICO cobrar antes de irse',
  client_notes: 'Timbre 3B, recibe la encargada',
  technician_name: 'Matias G.',
  default_material_margin_percent: null,
  cancelled_at: null,
  subtotal_materials: 0,
  subtotal_services: 0,
  total: 0,
  created_at: '2026-08-15T10:00:00.000Z',
  updated_at: '2026-08-15T10:00:00.000Z',
};

const buildDetail = (overrides: Partial<Detail> = {}): Detail =>
  ({
    quote: baseQuote,
    materials: [],
    services: [],
    appointment: null,
    ...overrides,
  }) as Detail;

const material = (name: string, quantity: number, unitPrice: number) => ({
  id: `m-${name}`,
  quote_id: baseQuote.id,
  user_id: 'u1',
  item_id: 'i1',
  item_measurement_id: null,
  item_measurement_snapshot: null,
  item_name_snapshot: name,
  quantity,
  unit: 'u',
  unit_price: unitPrice,
  margin_percent: null,
  total_price: quantity * unitPrice,
  source_store_id: null,
  source_store_name_snapshot: null,
  notes: null,
  created_at: '2026-08-15T10:00:00.000Z',
  updated_at: '2026-08-15T10:00:00.000Z',
});

const service = (name: string, quantity: number, totalPrice: number) => ({
  id: `s-${name}`,
  quote_id: baseQuote.id,
  user_id: 'u1',
  service_id: 'sv1',
  service_name_snapshot: name,
  quantity,
  unit_price: totalPrice / quantity,
  margin_percent: null,
  total_price: totalPrice,
  notes: null,
  created_at: '2026-08-15T10:00:00.000Z',
  updated_at: '2026-08-15T10:00:00.000Z',
});

/** Extrae los importes impresos, en orden, como numeros. */
const readMoney = (html: string): number[] =>
  Array.from(html.matchAll(/\$\s*([\d.]+)/g)).map((match) => Number((match[1] ?? '').replaceAll('.', '')));

describe('informe PDF', () => {
  it('NUNCA imprime las notas del tecnico', () => {
    const html = buildHtml(buildDetail(), '');
    expect(html).not.toContain('SECRETO-DEL-TECNICO');
    expect(html).not.toContain('cobrar antes de irse');
  });

  it('imprime los cinco datos del bloque de cliente', () => {
    const html = buildHtml(buildDetail(), '');
    expect(html).toContain('Juan Perez');
    expect(html).toContain('11 1234 5678');
    expect(html).toContain('Av. Mitre 1200');
    expect(html).toContain('Matias G.');
    expect(html).toContain('Timbre 3B, recibe la encargada');
  });

  it('titula la seccion del resumen como RESUMEN', () => {
    const html = buildHtml(buildDetail(), '');
    expect(html).toContain('>RESUMEN<');
    expect(html).not.toContain('TRABAJO REALIZADO');
  });

  it('omite los campos vacios del bloque de cliente', () => {
    // Se busca el markup del campo, no el texto suelto: "Teléfono" tambien
    // aparece en la tarjeta de contacto de Nossa Clima al pie.
    const fieldLabel = (label: string) => `<div class="field-label">${label}</div>`;

    const html = buildHtml(
      buildDetail({ quote: { ...baseQuote, client_phone: null, technician_name: null, client_notes: null } }),
      '',
    );
    expect(html).not.toContain(fieldLabel('Teléfono'));
    expect(html).not.toContain(fieldLabel('Técnico'));
    expect(html).not.toContain(fieldLabel('Notas'));
    // Los que sí tienen valor siguen estando.
    expect(html).toContain(fieldLabel('Cliente'));
    expect(html).toContain(fieldLabel('Domicilio'));
  });

  it('el total impreso es la suma de las lineas impresas', () => {
    // Con centavos: si se redondeara cada linea pero se mostrara el total de la
    // base, la columna no cerraria.
    const html = buildHtml(
      buildDetail({
        materials: [material('Caño', 1, 44_000.4), material('Aislante', 1, 10_000.4)],
        services: [service('Mano de obra', 1, 25_000.6)],
      }),
      '',
    );

    const amounts = readMoney(html);
    // [caño, aislante, mano de obra, subtotal materiales, subtotal servicios, total]
    expect(amounts).toHaveLength(6);
    const [caño = 0, aislante = 0, manoDeObra = 0, subtotalMat = 0, subtotalSrv = 0, total = 0] = amounts;

    expect(subtotalMat).toBe(caño + aislante);
    expect(subtotalSrv).toBe(manoDeObra);
    expect(total).toBe(subtotalMat + subtotalSrv);
  });

  it('escapa el texto que viene del usuario', () => {
    const html = buildHtml(buildDetail({ quote: { ...baseQuote, client_name: 'Perez & <Hijos>' } }), '');
    expect(html).toContain('Perez &amp; &lt;Hijos&gt;');
    expect(html).not.toContain('<Hijos>');
  });

  it('sale sin resumen, sin materiales y sin servicios', () => {
    const html = buildHtml(buildDetail({ quote: { ...baseQuote, notes: null } }), '');
    expect(html).not.toContain('>RESUMEN<');
    expect(html).toContain('Sin conceptos cargados');
    expect(html).toContain('DETALLE DE COSTOS');
  });

  it('usa el logo embebido cuando esta disponible', () => {
    const html = buildHtml(buildDetail(), 'data:image/png;base64,AAAA');
    expect(html).toContain('<img src="data:image/png;base64,AAAA"');
    expect(html).not.toContain('<svg');
  });

  it('cae al logo dibujado si el asset no cargo', () => {
    const html = buildHtml(buildDetail(), '');
    expect(html).toContain('<svg');
  });
});
