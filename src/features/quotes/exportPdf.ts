import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// jsPDF and jspdf-autotable use browser-only APIs (document, canvas, window.Image)
// that crash Hermes / React Native when evaluated at module load time.
// They are imported lazily inside the functions that need them (web PDF export only).
type JsPDFModule = typeof import('jspdf');
type AutoTableModule = typeof import('jspdf-autotable');

let _jsPDFModule: JsPDFModule | null = null;
let _autoTableModule: AutoTableModule | null = null;

const loadJsPDF = async () => {
  if (!_jsPDFModule) {
    _jsPDFModule = await import('jspdf');
  }
  if (!_autoTableModule) {
    _autoTableModule = await import('jspdf-autotable');
  }
  return { jsPDF: _jsPDFModule.jsPDF, autoTable: _autoTableModule.default };
};

// Logo blanco (el del login): va sobre la banda navy del encabezado.
import brandBannerOnNavy from '../../../assets/nc-logo-dark.png';
import { formatDateAr } from '@/lib/format';
import type { QuoteDetail } from '@/services/quotes';
import { getMaterialEffectiveTotalPrice } from './materialPricing';

// ── Paleta del informe (la del rediseño) ─────────────────────────────────
const NAVY_HEX = '#052653';
const NAVY_RGB: [number, number, number] = [5, 38, 83];
const CYAN_HEX = '#22C3E6';
const CYAN_RGB: [number, number, number] = [34, 195, 230];
const CYAN_DARK_HEX = '#0891B2';
const CYAN_DARK_RGB: [number, number, number] = [8, 145, 178];
const HEADER_SOFT_HEX = '#9FC4E0';
const HEADER_SOFT_RGB: [number, number, number] = [159, 196, 224];
const CARD_BG_HEX = '#F4F6F9';
const CARD_BG_RGB: [number, number, number] = [244, 246, 249];
const CARD_BORDER_HEX = '#E4E9F0';
const CARD_BORDER_RGB: [number, number, number] = [228, 233, 240];
const INK_HEX = '#0F1B2D';
const INK_RGB: [number, number, number] = [15, 27, 45];
const MUTED_HEX = '#64748B';
const MUTED_RGB: [number, number, number] = [100, 116, 139];
const BODY_HEX = '#334155';
const BODY_RGB: [number, number, number] = [51, 65, 85];
const GREEN_HEX = '#15803D';
const GREEN_RGB: [number, number, number] = [21, 128, 61];
const AMBER_HEX = '#8A5A00';
const AMBER_RGB: [number, number, number] = [138, 90, 0];
const TABLE_HEAD_RGB: [number, number, number] = [234, 239, 245];

const COMPANY_EMAIL = 'nossaclima@gmail.com';
const COMPANY_PHONE = '11 3001 9957';
const WARRANTY_TEXT =
  '*Todo servicio técnico posee una garantía de 3 (tres) meses desde el día de la visita, siempre y cuando se trate de un servicio relacionado al trabajo realizado. La garantía del servicio técnico no contempla nuevos problemas que pueda presentar el equipo.';

type PdfDocument = InstanceType<Awaited<ReturnType<typeof loadJsPDF>>['jsPDF']>;

type WebLogoImage = {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG';
};

const resolveBrandLogoUri = async (): Promise<string> => {
  try {
    const asset = Asset.fromModule(brandBannerOnNavy);

    if (Platform.OS !== 'web' && !asset.localUri) {
      await asset.downloadAsync();
    }

    return asset.localUri ?? asset.uri ?? '';
  } catch {
    return '';
  }
};

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

// El informe muestra importes sin centavos ($ 44.000), como el diseño.
const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

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
  return normalized || 'presupuesto';
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

// ── HTML (nativo, via expo-print) ────────────────────────────────────────

const buildLogoOnNavySvg = (): string => `
  <svg viewBox="0 0 440 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nossa Clima">
    <polygon points="12,78 82,18 82,78" fill="#ffffff" />
    <line x1="90" y1="78" x2="182" y2="78" stroke="#ffffff" stroke-width="4" />
    <line x1="182" y1="18" x2="412" y2="18" stroke="#ffffff" stroke-width="4" />
    <text x="94" y="60" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">NOSSA CLIMA</text>
    <text x="186" y="82" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="11">SERVICIOS INTEGRALES DE REFRIGERACION</text>
  </svg>`;

const renderCostRowsHtml = (detail: QuoteDetail): string => {
  const rows: string[] = [];

  if (detail.materials.length > 0) {
    rows.push(`<tr class="group"><td colspan="3" style="color:${GREEN_HEX};">Materiales</td></tr>`);
    detail.materials.forEach((material) => {
      rows.push(`
        <tr>
          <td>${escapeHtml(material.item_name_snapshot)}</td>
          <td class="num muted">${escapeHtml(formatQuantityWithUnit(material.quantity, material.unit))}</td>
          <td class="num strong">${escapeHtml(formatMoney(getMaterialTotal(detail, material)))}</td>
        </tr>`);
    });
  }

  if (detail.services.length > 0) {
    rows.push(`<tr class="group"><td colspan="3" style="color:${AMBER_HEX};">Mano de obra</td></tr>`);
    detail.services.forEach((service) => {
      rows.push(`
        <tr>
          <td>${escapeHtml(service.service_name_snapshot)}</td>
          <td class="num muted">${escapeHtml(formatQuantity(service.quantity))}</td>
          <td class="num strong">${escapeHtml(formatMoney(service.total_price))}</td>
        </tr>`);
    });
  }

  if (rows.length === 0) {
    rows.push('<tr><td colspan="3">Sin conceptos cargados</td></tr>');
  }

  return rows.join('');
};

const buildQuotePdfHtml = (detail: QuoteDetail): string => {
  const { quote } = detail;
  const quoteDate = getQuoteDisplayDate(detail);
  const reportNumber = getReportNumber(quote.id);
  const address = quote.description?.trim() ?? '';
  const workDone = quote.notes?.trim() ?? '';

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Informe técnico ${escapeHtml(quote.title)}</title>
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: Arial, sans-serif;
          color: ${INK_HEX};
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .band {
          background: ${NAVY_HEX};
          color: #ffffff;
          padding: 26px 32px 24px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
        }
        .band .eyebrow { color: ${CYAN_HEX}; font-size: 11px; font-weight: 700; letter-spacing: .14em; margin-bottom: 8px; }
        .band h1 { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 800; }
        .band .meta { color: ${HEADER_SOFT_HEX}; font-size: 12px; margin-top: 10px; }
        .band .logo { width: 190px; flex: none; align-self: flex-start; }
        .band .logo svg, .band .logo img { display: block; width: 100%; height: auto; }
        .content { flex: 1; padding: 22px 32px 26px; }
        .cards { display: flex; gap: 12px; }
        .card {
          flex: 1;
          background: ${CARD_BG_HEX};
          border: 1px solid ${CARD_BORDER_HEX};
          border-radius: 12px;
          padding: 13px 15px;
        }
        .card .label { color: ${MUTED_HEX}; font-size: 10px; font-weight: 700; letter-spacing: .08em; margin-bottom: 6px; }
        .card .value { font-size: 14px; font-weight: 700; line-height: 1.3; }
        .card .sub { color: ${MUTED_HEX}; font-size: 12px; margin-top: 4px; }
        .eyebrow-section { color: ${CYAN_DARK_HEX}; font-size: 11px; font-weight: 700; letter-spacing: .12em; margin: 24px 0 10px; }
        .work {
          border-left: 3px solid ${CYAN_HEX};
          padding: 2px 0 2px 14px;
          color: ${BODY_HEX};
          font-size: 12.5px;
          line-height: 1.55;
          white-space: pre-wrap;
        }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          background: ${CARD_BG_HEX};
          color: ${MUTED_HEX};
          font-size: 10px;
          letter-spacing: .06em;
          text-align: left;
          padding: 8px 12px;
        }
        thead th.num, td.num { text-align: right; }
        tbody td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid ${CARD_BORDER_HEX}; }
        tbody tr.group td { font-weight: 700; font-size: 11.5px; border-bottom: none; padding-top: 12px; }
        td.muted { color: ${MUTED_HEX}; }
        td.strong { font-weight: 700; }
        .totals { margin-top: 14px; margin-left: auto; width: 260px; }
        .totals .line { display: flex; justify-content: space-between; font-size: 12px; color: ${MUTED_HEX}; padding: 4px 14px; }
        .totals .line .val { color: ${INK_HEX}; }
        .totals .grand {
          margin-top: 8px;
          background: ${NAVY_HEX};
          color: #ffffff;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          font-weight: 700;
          font-size: 14px;
        }
        .footer {
          background: ${TABLE_HEAD_RGB ? '#EAEFF5' : '#EAEFF5'};
          padding: 16px 32px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }
        .footer .warranty { flex: 1; max-width: 380px; color: ${MUTED_HEX}; font-size: 9.5px; line-height: 1.45; }
        .footer .contact { text-align: right; }
        .footer .contact .label { color: ${MUTED_HEX}; font-size: 10px; letter-spacing: .08em; }
        .footer .contact .phone { font-weight: 700; font-size: 13px; margin-top: 3px; }
        .footer .contact .email { color: ${MUTED_HEX}; font-size: 11px; margin-top: 2px; }
      </style>
    </head>
    <body>
      <div class="band">
        <div>
          <div class="eyebrow">INFORME TÉCNICO</div>
          <h1>${escapeHtml(quote.title)}</h1>
          <div class="meta">N° ${escapeHtml(reportNumber)} · ${escapeHtml(quoteDate)}</div>
        </div>
        <div class="logo">${buildLogoOnNavySvg()}</div>
      </div>

      <div class="content">
        <div class="cards">
          <div class="card">
            <div class="label">CLIENTE</div>
            <div class="value">${escapeHtml(quote.client_name)}</div>
            ${quote.client_phone ? `<div class="sub">${escapeHtml(quote.client_phone)}</div>` : ''}
          </div>
          <div class="card">
            <div class="label">DOMICILIO</div>
            <div class="value">${escapeHtml(address || '-')}</div>
          </div>
        </div>

        ${workDone
          ? `<div class="eyebrow-section">TRABAJO REALIZADO</div>
             <div class="work">${escapeHtml(workDone)}</div>`
          : ''}

        <div class="eyebrow-section">DETALLE DE COSTOS</div>
        <table>
          <thead>
            <tr>
              <th>CONCEPTO</th>
              <th class="num">CANT.</th>
              <th class="num">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${renderCostRowsHtml(detail)}
          </tbody>
        </table>

        <div class="totals">
          <div class="line"><span>Subtotal materiales</span><span class="val">${escapeHtml(formatMoney(quote.subtotal_materials))}</span></div>
          <div class="line"><span>Subtotal mano de obra</span><span class="val">${escapeHtml(formatMoney(quote.subtotal_services))}</span></div>
          <div class="grand"><span>Total</span><span>${escapeHtml(formatMoney(quote.total))}</span></div>
        </div>
      </div>

      <div class="footer">
        <div class="warranty">${escapeHtml(WARRANTY_TEXT)}</div>
        <div class="contact">
          <div class="label">CONTACTO</div>
          <div class="phone">${escapeHtml(COMPANY_PHONE)}</div>
          <div class="email">${escapeHtml(COMPANY_EMAIL)}</div>
        </div>
      </div>
    </body>
  </html>`;
};

// ── jsPDF (web) ──────────────────────────────────────────────────────────

const loadWebLogoImage = (uri: string): Promise<WebLogoImage> => {
  if (typeof window === 'undefined' || !uri) {
    return Promise.reject(new Error('Logo no disponible en entorno web'));
  }

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = window.document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('No se pudo obtener contexto 2D para el banner'));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: image.naturalWidth,
        height: image.naturalHeight,
        format: 'PNG',
      });
    };
    image.onerror = () => reject(new Error('No se pudo cargar el banner para PDF web'));
    image.src = uri;
  });
};

/** Logo dibujado en blanco, para cuando la imagen no carga. */
const drawLogoOnNavy = (doc: PdfDocument, x: number, y: number, width: number): number => {
  const baseWidth = 440;
  const scale = width / baseWidth;
  const logoHeight = 96 * scale;

  doc.setFillColor(255, 255, 255);
  doc.triangle(x + 12 * scale, y + 78 * scale, x + 82 * scale, y + 18 * scale, x + 82 * scale, y + 78 * scale, 'F');

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(Math.max(1, 3 * scale));
  doc.line(x + 90 * scale, y + 78 * scale, x + 182 * scale, y + 78 * scale);
  doc.line(x + 182 * scale, y + 18 * scale, x + 412 * scale, y + 18 * scale);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38 * scale);
  doc.text('NOSSA CLIMA', x + 94 * scale, y + 60 * scale);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11 * scale);
  doc.text('SERVICIOS INTEGRALES DE REFRIGERACION', x + 186 * scale, y + 80 * scale);

  return logoHeight;
};

const ensureVerticalSpace = (doc: PdfDocument, currentY: number, neededSpace: number, bottomReserve: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededSpace <= pageHeight - bottomReserve) {
    return currentY;
  }

  doc.addPage();
  return 46;
};

const exportQuotePdfWeb = async (detail: QuoteDetail, brandLogoUri: string): Promise<void> => {
  const { jsPDF: JsPDFClass, autoTable: autoTableFn } = await loadJsPDF();
  const doc = new JsPDFClass({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;
  const footerHeight = 74;
  const bottomReserve = footerHeight + 22;

  const { quote } = detail;
  const address = quote.description?.trim() ?? '';
  const workDone = quote.notes?.trim() ?? '';

  // ── Banda navy del encabezado ──────────────────────────────────────────
  const logoWidth = 165;
  const titleMaxWidth = contentWidth - logoWidth - 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(quote.title, titleMaxWidth) as string[];
  const titleLineHeight = 26;
  const titleTopY = 76;
  const metaY = titleTopY + (titleLines.length - 1) * titleLineHeight + 24;
  const bandHeight = Math.max(132, metaY + 24);

  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, pageWidth, bandHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...CYAN_RGB);
  doc.text('INFORME TÉCNICO', marginX, 48, { charSpace: 1.4 });

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(titleLines, marginX, titleTopY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...HEADER_SOFT_RGB);
  doc.text(`N° ${getReportNumber(quote.id)} · ${getQuoteDisplayDate(detail)}`, marginX, metaY);

  const logoX = pageWidth - marginX - logoWidth;
  let logoDrawn = false;
  if (brandLogoUri) {
    try {
      const logoImage = await loadWebLogoImage(brandLogoUri);
      const logoHeight = (logoWidth * logoImage.height) / logoImage.width;
      doc.addImage(logoImage.dataUrl, logoImage.format, logoX, 44, logoWidth, logoHeight, undefined, 'FAST');
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    drawLogoOnNavy(doc, logoX, 34, logoWidth);
  }

  let cursorY = bandHeight + 24;

  // ── Tarjetas Cliente / Domicilio ───────────────────────────────────────
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardPad = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  const addressLines = doc.splitTextToSize(address || '-', cardWidth - cardPad * 2) as string[];
  const clientCardHeight = 30 + 16 + (quote.client_phone ? 16 : 0);
  const addressCardHeight = 30 + addressLines.length * 15;
  const cardHeight = Math.max(64, clientCardHeight, addressCardHeight);

  [0, 1].forEach((index) => {
    const x = marginX + index * (cardWidth + cardGap);
    doc.setFillColor(...CARD_BG_RGB);
    doc.setDrawColor(...CARD_BORDER_RGB);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, cursorY, cardWidth, cardHeight, 9, 9, 'FD');
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_RGB);
  doc.text('CLIENTE', marginX + cardPad, cursorY + 18, { charSpace: 0.8 });
  doc.text('DOMICILIO', marginX + cardWidth + cardGap + cardPad, cursorY + 18, { charSpace: 0.8 });

  doc.setFontSize(11.5);
  doc.setTextColor(...INK_RGB);
  doc.text(quote.client_name, marginX + cardPad, cursorY + 35);
  doc.text(addressLines, marginX + cardWidth + cardGap + cardPad, cursorY + 35);

  if (quote.client_phone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_RGB);
    doc.text(quote.client_phone, marginX + cardPad, cursorY + 51);
  }

  cursorY += cardHeight + 26;

  const drawSectionEyebrow = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...CYAN_DARK_RGB);
    doc.text(label, marginX, cursorY, { charSpace: 1.1 });
    cursorY += 14;
  };

  // ── Trabajo realizado ──────────────────────────────────────────────────
  if (workDone) {
    cursorY = ensureVerticalSpace(doc, cursorY, 60, bottomReserve);
    drawSectionEyebrow('TRABAJO REALIZADO');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const workLines = doc.splitTextToSize(workDone, contentWidth - 18) as string[];
    const workLineHeight = 15;

    // El relato puede ser largo: se dibuja por tramos con su barra cian,
    // saltando de página cuando no queda lugar.
    let segmentStart = 0;
    while (segmentStart < workLines.length) {
      const available = pageHeight - bottomReserve - cursorY;
      const linesThatFit = Math.max(1, Math.floor(available / workLineHeight));
      const segment = workLines.slice(segmentStart, segmentStart + linesThatFit);
      const segmentHeight = segment.length * workLineHeight;

      doc.setFillColor(...CYAN_RGB);
      doc.rect(marginX, cursorY - 10, 3, segmentHeight + 4, 'F');
      doc.setTextColor(...BODY_RGB);
      doc.text(segment, marginX + 16, cursorY);

      segmentStart += segment.length;
      cursorY += segmentHeight;
      if (segmentStart < workLines.length) {
        doc.addPage();
        cursorY = 46;
      }
    }
    cursorY += 16;
  }

  // ── Detalle de costos ──────────────────────────────────────────────────
  cursorY = ensureVerticalSpace(doc, cursorY, 120, bottomReserve);
  drawSectionEyebrow('DETALLE DE COSTOS');

  type CostCell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const costRows: CostCell[][] = [];
  const groupRow = (label: string, color: [number, number, number]): CostCell[] => [
    {
      content: label,
      colSpan: 3,
      styles: { textColor: color, fontStyle: 'bold', fontSize: 9.5, fillColor: [255, 255, 255], cellPadding: { top: 10, bottom: 4, left: 10, right: 10 } },
    },
  ];

  if (detail.materials.length > 0) {
    costRows.push(groupRow('Materiales', GREEN_RGB));
    detail.materials.forEach((material) => {
      costRows.push([
        material.item_name_snapshot,
        formatQuantityWithUnit(material.quantity, material.unit),
        formatMoney(getMaterialTotal(detail, material)),
      ]);
    });
  }
  if (detail.services.length > 0) {
    costRows.push(groupRow('Mano de obra', AMBER_RGB));
    detail.services.forEach((service) => {
      costRows.push([service.service_name_snapshot, formatQuantity(service.quantity), formatMoney(service.total_price)]);
    });
  }
  if (costRows.length === 0) {
    costRows.push([{ content: 'Sin conceptos cargados', colSpan: 3, styles: { textColor: MUTED_RGB } }]);
  }

  autoTableFn(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX, bottom: bottomReserve },
    head: [['CONCEPTO', 'CANT.', 'TOTAL']],
    body: costRows as never,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: { top: 7, bottom: 7, left: 10, right: 10 },
      textColor: INK_RGB,
      lineColor: CARD_BORDER_RGB,
      lineWidth: { bottom: 0.6 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: TABLE_HEAD_RGB,
      textColor: MUTED_RGB,
      fontStyle: 'bold',
      fontSize: 8.5,
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 84, textColor: MUTED_RGB },
      2: { halign: 'right', cellWidth: 100, fontStyle: 'bold' },
    },
  });

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 18;

  // ── Subtotales y total ─────────────────────────────────────────────────
  const totalsWidth = 250;
  const totalsX = pageWidth - marginX - totalsWidth;
  cursorY = ensureVerticalSpace(doc, cursorY, 96, bottomReserve);

  const subtotalLine = (label: string, value: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_RGB);
    doc.text(label, totalsX + 12, cursorY);
    doc.setTextColor(...INK_RGB);
    doc.text(formatMoney(value), totalsX + totalsWidth - 12, cursorY, { align: 'right' });
    cursorY += 17;
  };

  subtotalLine('Subtotal materiales', quote.subtotal_materials);
  subtotalLine('Subtotal mano de obra', quote.subtotal_services);

  cursorY += 3;
  doc.setFillColor(...NAVY_RGB);
  doc.roundedRect(totalsX, cursorY - 12, totalsWidth, 38, 9, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('Total', totalsX + 14, cursorY + 12);
  doc.setFontSize(14);
  doc.text(formatMoney(quote.total), totalsX + totalsWidth - 14, cursorY + 12, { align: 'right' });

  // ── Pie: garantía + contacto (última página) ───────────────────────────
  const footerY = pageHeight - footerHeight;
  doc.setFillColor(...TABLE_HEAD_RGB);
  doc.rect(0, footerY, pageWidth, footerHeight, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_RGB);
  const warrantyLines = doc.splitTextToSize(WARRANTY_TEXT, 320) as string[];
  doc.text(warrantyLines, marginX, footerY + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONTACTO', pageWidth - marginX, footerY + 20, { align: 'right', charSpace: 0.8 });
  doc.setFontSize(11);
  doc.setTextColor(...INK_RGB);
  doc.text(COMPANY_PHONE, pageWidth - marginX, footerY + 36, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED_RGB);
  doc.text(COMPANY_EMAIL, pageWidth - marginX, footerY + 50, { align: 'right' });

  doc.save(buildPdfName(detail));
};

// ── Plumbing de guardado / compartido (sin cambios) ──────────────────────

const createNativeQuotePdfFile = async (detail: QuoteDetail): Promise<{ uri: string; fileName: string }> => {
  const html = buildQuotePdfHtml(detail);
  const file = await Print.printToFileAsync({ html });

  return {
    uri: file.uri,
    fileName: buildPdfName(detail),
  };
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
    const brandLogoUri = await resolveBrandLogoUri();
    await exportQuotePdfWeb(detail, brandLogoUri);
    return;
  }

  const file = await createNativeQuotePdfFile(detail);

  try {
    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Exportar presupuesto',
        UTI: '.pdf',
      });
      return;
    }

    await Print.printAsync({ html: buildQuotePdfHtml(detail) });
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
    const brandLogoUri = await resolveBrandLogoUri();
    await exportQuotePdfWeb(detail, brandLogoUri);
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
