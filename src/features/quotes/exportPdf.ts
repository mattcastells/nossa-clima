import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Logo blanco (el del login): va sobre la banda navy del encabezado.
import brandBannerOnNavy from '../../../assets/nc-logo-dark.png';
import { formatDateAr } from '@/lib/format';
import type { QuoteDetail } from '@/services/quotes';
import { getMaterialEffectiveTotalPrice } from './materialPricing';
import { splitWorkSections } from './workSections';

// ── Paleta del informe ───────────────────────────────────────────────────
// El informe es siempre claro: no sigue el modo oscuro de la app. Por eso son
// constantes de marca y no tokens del tema.
const NAVY = '#052653';
const CYAN = '#22C3E6';
const CYAN_DARK = '#0891B2';
const HEADER_SOFT = '#9FC4E0';
const CARD_BG = '#F4F6F9';
const CARD_BORDER = '#E4E9F0';
const INK = '#0F1B2D';
const MUTED = '#64748B';
const GREEN = '#15803D';
const AMBER = '#8A5A00';
const TABLE_HEAD_BG = '#EAEFF5';

const COMPANY_EMAIL = 'nossaclima@gmail.com';
const COMPANY_PHONE = '11 3001 9957';
const WARRANTY_TEXT =
  '*Todo servicio técnico posee una garantía de 3 (tres) meses desde el día de la visita, siempre y cuando se trate de un servicio relacionado al trabajo realizado. La garantía del servicio técnico no contempla nuevos problemas que pueda presentar el equipo.';

// ── Logo ─────────────────────────────────────────────────────────────────

/**
 * El PNG del logo, embebido como data URI.
 *
 * Va embebido porque el HTML se imprime tanto con expo-print (nativo) como con
 * el diálogo del navegador (web), y en ninguno de los dos casos hay un origen
 * desde donde resolver una ruta relativa.
 */
let cachedLogoDataUri: string | null = null;

const resolveBrandLogoDataUri = async (): Promise<string> => {
  if (cachedLogoDataUri != null) return cachedLogoDataUri;

  try {
    const asset = Asset.fromModule(brandBannerOnNavy);
    if (!asset.localUri && !asset.downloaded) {
      await asset.downloadAsync();
    }

    const uri = asset.localUri ?? asset.uri ?? '';
    if (!uri) return '';

    // En web el bundler ya sirve el asset como URL (o como data URI directo).
    if (uri.startsWith('data:')) {
      cachedLogoDataUri = uri;
      return uri;
    }
    if (Platform.OS === 'web') {
      cachedLogoDataUri = uri;
      return uri;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    cachedLogoDataUri = `data:image/png;base64,${base64}`;
    return cachedLogoDataUri;
  } catch {
    return '';
  }
};

/** Fallback dibujado, por si el asset no carga. Nunca debería usarse. */
const buildLogoFallbackSvg = (): string => `
  <svg viewBox="0 0 440 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nossa Clima">
    <polygon points="12,78 82,18 82,78" fill="#ffffff" />
    <line x1="90" y1="78" x2="182" y2="78" stroke="#ffffff" stroke-width="4" />
    <line x1="182" y1="18" x2="412" y2="18" stroke="#ffffff" stroke-width="4" />
    <text x="94" y="60" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">NOSSA CLIMA</text>
    <text x="186" y="82" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="11">SERVICIOS INTEGRALES DE REFRIGERACION</text>
  </svg>`;

// ── Formateo ─────────────────────────────────────────────────────────────

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatQuantityWithUnit = (quantity: number, unit: string | null | undefined): string => {
  const normalizedUnit = unit?.trim();
  return normalizedUnit && normalizedUnit !== '-' ? `${formatQuantity(quantity)} ${normalizedUnit}` : formatQuantity(quantity);
};

/**
 * El informe muestra importes sin centavos. Se redondea CADA LINEA y los
 * totales se suman a partir de las lineas ya redondeadas: si se mostraran las
 * lineas redondeadas junto al total de la base, el cliente suma la columna y no
 * le cierra por unos pesos.
 */
const roundToPeso = (value: number): number => Math.round(Number(value ?? 0));

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(roundToPeso(value));

/** N° de informe estable por trabajo, derivado del id (no hay numeración en la base). */
const getReportNumber = (quoteId: string): string => {
  const hex = quoteId.replaceAll('-', '').slice(0, 8);
  const parsed = Number.parseInt(hex, 16);
  const number = Number.isFinite(parsed) ? parsed % 10000 : 0;
  return String(number).padStart(4, '0');
};

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'informe';
};

const getQuoteDisplayDate = (detail: QuoteDetail): string =>
  formatDateAr(detail.appointment?.scheduled_for ?? detail.quote.created_at);

const buildPdfName = (detail: QuoteDetail): string => {
  const dateStr = sanitizeFileName(getQuoteDisplayDate(detail));
  return `${sanitizeFileName(detail.quote.title)}-${dateStr}.pdf`;
};

const splitFileName = (value: string): { base: string; extension: string } => {
  const extensionIndex = value.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return { base: value, extension: '' };
  }

  return {
    base: value.slice(0, extensionIndex),
    extension: value.slice(extensionIndex),
  };
};

const getMaterialTotal = (detail: QuoteDetail, material: QuoteDetail['materials'][number]): number =>
  getMaterialEffectiveTotalPrice(material.quantity, material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent);

// ── Filas de costos ──────────────────────────────────────────────────────

interface CostTotals {
  materials: number;
  services: number;
  total: number;
}

/**
 * Arma las filas del detalle y los totales a la vez, para que lo impreso y lo
 * sumado salgan del mismo redondeo.
 */
const buildCostSection = (detail: QuoteDetail): { rowsHtml: string; totals: CostTotals } => {
  const rows: string[] = [];
  let materialsTotal = 0;
  let servicesTotal = 0;

  if (detail.materials.length > 0) {
    rows.push(`<tr class="group"><td colspan="3" style="color:${GREEN};">Materiales</td></tr>`);
    detail.materials.forEach((material) => {
      const lineTotal = roundToPeso(getMaterialTotal(detail, material));
      materialsTotal += lineTotal;
      rows.push(`
        <tr>
          <td>${escapeHtml(material.item_name_snapshot)}</td>
          <td class="num muted">${escapeHtml(formatQuantityWithUnit(material.quantity, material.unit))}</td>
          <td class="num strong">${escapeHtml(formatMoney(lineTotal))}</td>
        </tr>`);
    });
  }

  if (detail.services.length > 0) {
    rows.push(`<tr class="group"><td colspan="3" style="color:${AMBER};">Mano de obra</td></tr>`);
    detail.services.forEach((service) => {
      const lineTotal = roundToPeso(service.total_price);
      servicesTotal += lineTotal;
      rows.push(`
        <tr>
          <td>${escapeHtml(service.service_name_snapshot)}</td>
          <td class="num muted">${escapeHtml(formatQuantity(service.quantity))}</td>
          <td class="num strong">${escapeHtml(formatMoney(lineTotal))}</td>
        </tr>`);
    });
  }

  if (rows.length === 0) {
    rows.push(`<tr><td colspan="3" style="color:${MUTED};">Sin conceptos cargados</td></tr>`);
  }

  return {
    rowsHtml: rows.join(''),
    totals: {
      materials: materialsTotal,
      services: servicesTotal,
      total: materialsTotal + servicesTotal,
    },
  };
};

/** Una fila del bloque de cliente. Se omite si no hay valor. */
const renderClientField = (label: string, value: string | null | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return `
    <div class="field">
      <div class="field-label">${escapeHtml(label)}</div>
      <div class="field-value">${escapeHtml(trimmed)}</div>
    </div>`;
};

// ── Plantilla ────────────────────────────────────────────────────────────

/**
 * La ÚNICA plantilla del informe. Nativo la imprime con expo-print y web con el
 * diálogo del navegador. No duplicar este documento en otro renderer.
 */
const buildQuotePdfHtml = (detail: QuoteDetail, logoDataUri: string): string => {
  const { quote } = detail;
  const quoteDate = getQuoteDisplayDate(detail);
  const reportNumber = getReportNumber(quote.id);
  const address = quote.description?.trim() ?? '';
  const summary = quote.notes?.trim() ?? '';
  const { rowsHtml, totals } = buildCostSection(detail);

  const logoMarkup = logoDataUri
    ? `<img src="${escapeHtml(logoDataUri)}" alt="Nossa Clima" />`
    : buildLogoFallbackSvg();

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Informe técnico ${escapeHtml(quote.title)}</title>
      <style>
        /* El pie va fijo al pie de CADA página impresa: en medio paginado un
           flex con 100vh no garantiza que caiga al final de la última. */
        @page { margin: 0 0 96px; }

        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: ${INK};
          font-size: 12.5px;
          line-height: 1.5;
        }

        /* ── Banda del encabezado ─────────────────────────────────── */
        .band {
          background: ${NAVY};
          color: #ffffff;
          padding: 26px 32px 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }
        .band .eyebrow {
          color: ${CYAN};
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .14em;
          margin-bottom: 8px;
        }
        .band h1 { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 800; }
        .band .meta { color: ${HEADER_SOFT}; font-size: 12px; margin-top: 10px; }
        .band .logo { width: 230px; flex: none; }
        .band .logo img, .band .logo svg { display: block; width: 100%; height: auto; }

        .content { padding: 22px 32px 8px; }

        /* ── Títulos de sección: con fondo, como el informe anterior ── */
        .section-title {
          background: ${NAVY};
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          padding: 7px 12px;
          border-radius: 5px;
          margin: 22px 0 12px;
        }
        .section-title:first-child { margin-top: 0; }

        /* ── Bloque de datos del cliente ──────────────────────────── */
        .client-card {
          background: ${CARD_BG};
          border: 1px solid ${CARD_BORDER};
          border-radius: 12px;
          padding: 6px 18px 12px;
        }
        .field {
          display: flex;
          align-items: baseline;
          gap: 14px;
          padding: 7px 0;
          border-bottom: 1px solid ${CARD_BORDER};
        }
        .field:last-child { border-bottom: none; }
        .field-label {
          width: 116px;
          flex: none;
          color: ${MUTED};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .field-value {
          flex: 1;
          font-size: 13.5px;
          font-weight: 700;
          color: ${INK};
          line-height: 1.45;
        }

        /* ── Resumen ──────────────────────────────────────────────── */
        .summary {
          border-left: 3px solid ${CYAN};
          padding: 2px 0 2px 14px;
          color: ${INK};
        }
        .summary p { margin: 0; white-space: pre-wrap; }
        .summary .sub {
          font-weight: 700;
          color: ${CYAN_DARK};
          margin-top: 11px;
          margin-bottom: 2px;
          letter-spacing: .02em;
        }

        /* ── Detalle de costos ────────────────────────────────────── */
        table { width: 100%; border-collapse: collapse; }
        thead th {
          background: ${TABLE_HEAD_BG};
          color: ${INK};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .06em;
          text-align: left;
          padding: 8px 12px;
        }
        thead th.num, td.num { text-align: right; }
        tbody td {
          padding: 8px 12px;
          font-size: 12px;
          border-bottom: 1px solid ${CARD_BORDER};
        }
        tbody tr.group td {
          font-weight: 700;
          font-size: 11.5px;
          border-bottom: none;
          padding-top: 12px;
        }
        td.muted { color: ${MUTED}; }
        td.strong { font-weight: 700; }

        /* ── Cierre: contacto a la izquierda, totales a la derecha ─── */
        .closing {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }
        .contact-card {
          flex: none;
          width: 250px;
          border: 1.5px solid ${NAVY};
          border-radius: 12px;
          padding: 12px 16px 14px;
        }
        .contact-card .title {
          color: ${NAVY};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .contact-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 14px;
        }
        .contact-line + .contact-line { margin-top: 7px; }
        .contact-line .k { color: ${MUTED}; font-size: 11px; }
        .contact-line .v { color: ${INK}; font-size: 12px; font-weight: 700; text-align: right; }

        .totals { flex: none; width: 250px; }
        .totals .line {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: ${MUTED};
          padding: 4px 14px;
        }
        .totals .line .val { color: ${INK}; font-weight: 700; }
        .totals .grand {
          margin-top: 8px;
          background: ${NAVY};
          color: #ffffff;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          font-weight: 700;
          font-size: 14px;
        }

        /* ── Pie ──────────────────────────────────────────────────── */
        .footer {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: 96px;
          background: ${TABLE_HEAD_BG};
          padding: 14px 32px;
          display: flex;
          align-items: center;
        }
        .footer .warranty {
          color: ${MUTED};
          font-size: 9px;
          line-height: 1.45;
        }
      </style>
    </head>
    <body>
      <div class="band">
        <div>
          <div class="eyebrow">INFORME TÉCNICO</div>
          <h1>${escapeHtml(quote.title)}</h1>
          <div class="meta">N° ${escapeHtml(reportNumber)} · ${escapeHtml(quoteDate)}</div>
        </div>
        <div class="logo">${logoMarkup}</div>
      </div>

      <div class="content">
        <div class="section-title">DATOS DEL CLIENTE</div>
        <div class="client-card">
          ${renderClientField('Cliente', quote.client_name)}
          ${renderClientField('Teléfono', quote.client_phone)}
          ${renderClientField('Domicilio', address)}
          ${renderClientField('Técnico', quote.technician_name)}
          ${renderClientField('Notas', quote.client_notes)}
        </div>

        ${summary
          ? `<div class="section-title">RESUMEN</div>
             <div class="summary">${splitWorkSections(summary)
               .map(
                 (section) =>
                   `${section.title ? `<div class="sub">${escapeHtml(section.title)}</div>` : ''}<p>${escapeHtml(section.body)}</p>`,
               )
               .join('')}</div>`
          : ''}

        <div class="section-title">DETALLE DE COSTOS</div>
        <table>
          <thead>
            <tr>
              <th>CONCEPTO</th>
              <th class="num">CANT.</th>
              <th class="num">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="closing">
          <div class="contact-card">
            <div class="title">Contacto</div>
            <div class="contact-line"><span class="k">Teléfono</span><span class="v">${escapeHtml(COMPANY_PHONE)}</span></div>
            <div class="contact-line"><span class="k">Email</span><span class="v">${escapeHtml(COMPANY_EMAIL)}</span></div>
          </div>
          <div class="totals">
            <div class="line"><span>Subtotal materiales</span><span class="val">${escapeHtml(formatMoney(totals.materials))}</span></div>
            <div class="line"><span>Subtotal mano de obra</span><span class="val">${escapeHtml(formatMoney(totals.services))}</span></div>
            <div class="grand"><span>Total</span><span>${escapeHtml(formatMoney(totals.total))}</span></div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="warranty">${escapeHtml(WARRANTY_TEXT)}</div>
      </div>
    </body>
  </html>`;
};

// ── Salidas ──────────────────────────────────────────────────────────────

const createNativeQuotePdfFile = async (detail: QuoteDetail): Promise<{ uri: string; fileName: string }> => {
  const logoDataUri = await resolveBrandLogoDataUri();
  const html = buildQuotePdfHtml(detail, logoDataUri);
  const file = await Print.printToFileAsync({ html });

  return {
    uri: file.uri,
    fileName: buildPdfName(detail),
  };
};

/**
 * En web se imprime la misma plantilla con el diálogo del navegador (donde el
 * usuario elige "Guardar como PDF"). Antes había un segundo renderer con jsPDF
 * que dibujaba el informe a mano; se eliminó porque obligaba a mantener el
 * diseño en dos lugares y ya había divergido.
 */
const printQuotePdfWeb = async (detail: QuoteDetail): Promise<void> => {
  const logoDataUri = await resolveBrandLogoDataUri();
  const html = buildQuotePdfHtml(detail, logoDataUri);

  if (typeof window === 'undefined' || typeof window.document === 'undefined') {
    throw new Error('No se pudo abrir el informe para imprimir.');
  }

  const frame = window.document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  window.document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error('No se pudo preparar el informe para imprimir.');
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await new Promise<void>((resolve) => {
    // Sin esperar la carga, el diálogo puede abrirse antes de que el logo esté
    // pintado y el PDF sale sin él.
    if (frameDocument.readyState === 'complete') {
      resolve();
      return;
    }
    frameWindow.addEventListener('load', () => resolve(), { once: true });
    // Red de seguridad: si el evento no llega, no dejamos el flujo colgado.
    window.setTimeout(resolve, 1500);
  });

  frameWindow.focus();
  frameWindow.print();

  // El diálogo de impresión es sincrónico en la práctica, pero el iframe no se
  // puede sacar de inmediato en todos los navegadores.
  window.setTimeout(() => frame.remove(), 1000);
};

const createUniqueSafFileUri = async (
  directoryUri: string,
  fileName: string,
  mimeType: string,
  StorageAccessFramework: typeof import('expo-file-system').StorageAccessFramework,
): Promise<string> => {
  try {
    return await StorageAccessFramework.createFileAsync(directoryUri, fileName, mimeType);
  } catch {
    const { base, extension } = splitFileName(fileName);
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    return StorageAccessFramework.createFileAsync(directoryUri, `${base}-${timestamp}${extension}`, mimeType);
  }
};

const requestAndroidPdfDirectoryUri = async (
  StorageAccessFramework: typeof import('expo-file-system').StorageAccessFramework,
): Promise<string> => {
  const downloadsRootUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
  const preferredPermission = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsRootUri);
  if (preferredPermission.granted && preferredPermission.directoryUri) {
    return preferredPermission.directoryUri;
  }

  const fallbackPermission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!fallbackPermission.granted || !fallbackPermission.directoryUri) {
    throw new Error('No se otorgo permiso para guardar el PDF. Selecciona una carpeta para continuar.');
  }

  return fallbackPermission.directoryUri;
};

export const shareQuotePdf = async (detail: QuoteDetail): Promise<void> => {
  if (Platform.OS === 'web') {
    await printQuotePdfWeb(detail);
    return;
  }

  const file = await createNativeQuotePdfFile(detail);

  try {
    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir informe',
        UTI: '.pdf',
      });
      return;
    }

    const logoDataUri = await resolveBrandLogoDataUri();
    await Print.printAsync({ html: buildQuotePdfHtml(detail, logoDataUri) });
  } finally {
    try {
      // The share sheet already received the file by this point.
      // Ignore cleanup failures for temp export files.
      await FileSystem.deleteAsync(file.uri);
    } catch {
      // Ignore cleanup errors for generated temp files.
    }
  }
};

export const saveQuotePdf = async (detail: QuoteDetail): Promise<string> => {
  if (Platform.OS === 'web') {
    await printQuotePdfWeb(detail);
    return buildPdfName(detail);
  }
  const { StorageAccessFramework } = FileSystem;
  const file = await createNativeQuotePdfFile(detail);

  try {
    if (Platform.OS !== 'android') {
      const targetDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!targetDirectory) {
        throw new Error('No se encontro una carpeta disponible para guardar el PDF.');
      }

      const targetUri = `${targetDirectory}${file.fileName}`;
      await FileSystem.copyAsync({ from: file.uri, to: targetUri });
      return targetUri;
    }

    const fileBase64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    const writeToSafDirectory = async (directoryUri: string): Promise<string> => {
      const targetUri = await createUniqueSafFileUri(directoryUri, file.fileName, 'application/pdf', StorageAccessFramework);
      await StorageAccessFramework.writeAsStringAsync(targetUri, fileBase64, { encoding: FileSystem.EncodingType.Base64 });
      return targetUri;
    };

    const directoryUri = await requestAndroidPdfDirectoryUri(StorageAccessFramework);
    return await writeToSafDirectory(directoryUri);
  } finally {
    try {
      await FileSystem.deleteAsync(file.uri);
    } catch {
      // Ignore cleanup errors for generated temp files.
    }
  }
};

/** Export para tests: la plantilla es la única fuente del informe. */
export const __buildQuotePdfHtmlForTests = buildQuotePdfHtml;
