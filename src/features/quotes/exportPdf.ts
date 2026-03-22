import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import type { QuoteDetail } from '@/services/quotes';
import { getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from './materialPricing';

const BRAND_BLUE_HEX = '#032D6E';
const BRAND_BLUE_RGB: [number, number, number] = [3, 45, 110];
const TEXT_DARK_RGB: [number, number, number] = [17, 24, 39];
const TEXT_MUTED_RGB: [number, number, number] = [107, 114, 128];
const BORDER_RGB: [number, number, number] = [220, 228, 236];
const COMPANY_EMAIL = 'nossaclima@gmail.com';
const COMPANY_PHONE = '11-3001-9957';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const brandBanner = require('../../../assets/nossa-banner.png');

type PdfDocument = import('jspdf').jsPDF;
type AutoTableFn = (doc: PdfDocument, options: Record<string, unknown>) => void;
type AutoTableModule = AutoTableFn & {
  default?: AutoTableFn;
};

type WebLogoImage = {
  dataUrl: string;
  width: number;
  height: number;
  format: 'PNG' | 'JPEG';
};

const resolveBrandLogoUri = async (): Promise<string> => {
  try {
    const asset = Asset.fromModule(brandBanner);

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

const renderServicesRows = (detail: QuoteDetail): string => {
  if (detail.services.length === 0) {
    return '<tr><td colspan="4">Sin servicios cargados</td></tr>';
  }

  return detail.services
    .map(
      (service) => `
      <tr>
        <td>${escapeHtml(service.service_name_snapshot)}</td>
        <td class="right">${escapeHtml(formatQuantity(service.quantity))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(service.unit_price))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(service.total_price))}</td>
      </tr>`,
    )
    .join('');
};

const renderMaterialsRows = (detail: QuoteDetail): string => {
  if (detail.materials.length === 0) {
    return '<tr><td colspan="4">Sin materiales cargados</td></tr>';
  }

  return detail.materials
    .map(
      (material) => `
      <tr>
        <td>${escapeHtml(material.item_name_snapshot)}</td>
        <td class="right">${escapeHtml(formatQuantityWithUnit(material.quantity, material.unit))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(getMaterialEffectiveUnitPrice(material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(getMaterialEffectiveTotalPrice(material.quantity, material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)))}</td>
      </tr>`,
    )
    .join('');
};

const buildCompanyLogoSvg = (): string => `
  <svg viewBox="0 0 1400 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Banner Nossa Clima">
    <rect width="1400" height="320" fill="#ffffff" />
    <polygon points="0,255 220,55 220,255" fill="${BRAND_BLUE_HEX}" />
    <line x1="250" y1="255" x2="470" y2="255" stroke="${BRAND_BLUE_HEX}" stroke-width="14" />
    <line x1="470" y1="55" x2="1400" y2="55" stroke="${BRAND_BLUE_HEX}" stroke-width="14" />
    <text x="250" y="195" fill="${BRAND_BLUE_HEX}" font-family="Arial, Helvetica, sans-serif" font-size="158" font-weight="700">
      NOSSA CLIMA
    </text>
    <text x="500" y="272" fill="${BRAND_BLUE_HEX}" font-family="Arial, Helvetica, sans-serif" font-size="52">
      SERVICIOS INTEGRALES DE REFRIGERACION
    </text>
  </svg>`;

const drawCompanyLogo = (doc: PdfDocument, x: number, y: number, width: number): number => {
  const baseWidth = 440;
  const scale = width / baseWidth;
  const logoHeight = 96 * scale;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, logoHeight, 10, 10, 'F');

  doc.setFillColor(...BRAND_BLUE_RGB);
  doc.triangle(x + 12 * scale, y + 78 * scale, x + 82 * scale, y + 18 * scale, x + 82 * scale, y + 78 * scale, 'F');

  doc.setDrawColor(...BRAND_BLUE_RGB);
  doc.setLineWidth(Math.max(1, 3 * scale));
  doc.line(x + 90 * scale, y + 78 * scale, x + 182 * scale, y + 78 * scale);
  doc.line(x + 182 * scale, y + 18 * scale, x + 412 * scale, y + 18 * scale);

  doc.setTextColor(...BRAND_BLUE_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38 * scale);
  doc.text('NOSSA CLIMA', x + 94 * scale, y + 60 * scale);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11 * scale);
  doc.text('SERVICIOS INTEGRALES DE REFRIGERACION', x + 186 * scale, y + 80 * scale);

  return logoHeight;
};

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

const buildQuotePdfHtml = (detail: QuoteDetail, brandLogoUri: string): string => {
  const { quote } = detail;
  const quoteDate = getQuoteDisplayDate(detail);
  const logoMarkup = Platform.OS === 'web' && brandLogoUri
    ? `<img src="${escapeHtml(brandLogoUri)}" alt="Nossa Clima" />`
    : buildCompanyLogoSvg();

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Presupuesto ${escapeHtml(quote.title)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; padding: 26px 28px 30px; margin: 0; }
        h1 { font-size: 24px; line-height: 1.1; margin: 0; color: ${BRAND_BLUE_HEX}; }
        h2 { font-size: 15px; line-height: 1.2; margin: 0; color: ${BRAND_BLUE_HEX}; }
        .muted { color: #6b7280; font-size: 12px; }
        .header {
          margin-bottom: 4px;
        }
        .brand-block {
          width: 280px;
          margin-left: auto;
          margin-bottom: 14px;
        }
        .brand-logo { width: 100%; background: #ffffff; }
        .brand-logo img, .brand-logo svg { display: block; width: 100%; height: auto; }
        .document-block {
          padding-top: 0;
        }
        .contact-card {
          min-width: 280px;
          max-width: 280px;
          border: 1px solid #dce4ec;
          border-radius: 12px;
          padding: 14px 16px;
          background: #f8fafc;
        }
        .contact-title {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .04em;
          margin-bottom: 10px;
          text-decoration: underline;
          font-weight: 700;
        }
        .contact-line {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .contact-line .label {
          margin-bottom: 0;
        }
        .contact-line .value {
          text-align: right;
          min-width: 0;
          max-width: 170px;
          overflow-wrap: anywhere;
        }
        .contact-line + .contact-line { margin-top: 8px; }
        .box {
          border: 1px solid #dce4ec;
          border-radius: 12px;
          padding: 14px 16px;
          margin-top: 18px;
          background: #ffffff;
        }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
        .info-field.wide { grid-column: 1 / -1; }
        .label { font-size: 11px; line-height: 1.2; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .03em; }
        .value { font-size: 14px; line-height: 1.35; }
        .section { margin-top: 22px; }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .section-line { flex: 1; height: 1px; background: #dce4ec; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        col.name { width: 40%; }
        col.qty  { width: 18%; }
        col.unit { width: 21%; }
        col.tot  { width: 21%; }
        th, td { padding: 9px 10px; font-size: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; word-break: break-word; overflow-wrap: anywhere; }
        th { background: ${BRAND_BLUE_HEX}; color: #ffffff; font-size: 11px; letter-spacing: .02em; white-space: nowrap; }
        tbody tr:nth-child(even) td { background: #f8fbff; }
        .right { text-align: center; white-space: nowrap; }
        .totals-wrap { margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .totals {
          width: 260px;
          border: 1px solid #dce4ec;
          border-radius: 12px;
          overflow: hidden;
        }
        .totals td { font-size: 12px; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
        .totals tr:last-child td {
          background: ${BRAND_BLUE_HEX};
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          border-bottom: none;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand-block">
          <div class="brand-logo">${logoMarkup}</div>
        </div>
        <div class="document-block">
          <h1>Presupuesto tecnico</h1>
          <div class="muted">Fecha: ${escapeHtml(quoteDate)}</div>
        </div>
      </div>

      <div class="box">
        <div class="info-grid">
          <div class="info-field">
            <div class="label">Cliente</div>
            <div class="value">${escapeHtml(quote.client_name)}</div>
          </div>
          <div class="info-field">
            <div class="label">Telefono</div>
            <div class="value">${escapeHtml(quote.client_phone ?? '-')}</div>
          </div>
          <div class="info-field wide">
            <div class="label">Titulo</div>
            <div class="value">${escapeHtml(quote.title)}</div>
          </div>
          <div class="info-field wide">
            <div class="label">Notas</div>
            <div class="value">${escapeHtml(quote.notes ?? '-')}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>Servicios</h2>
          <div class="section-line"></div>
        </div>
        <table>
          <colgroup>
            <col class="name" />
            <col class="qty" />
            <col class="unit" />
            <col class="tot" />
          </colgroup>
          <thead>
            <tr>
              <th>Servicio</th>
              <th class="right">Cantidad</th>
              <th class="right">Unitario</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderServicesRows(detail)}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>Materiales</h2>
          <div class="section-line"></div>
        </div>
        <table>
          <colgroup>
            <col class="name" />
            <col class="qty" />
            <col class="unit" />
            <col class="tot" />
          </colgroup>
          <thead>
            <tr>
              <th>Material</th>
              <th class="right">Cantidad</th>
              <th class="right">Unitario</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderMaterialsRows(detail)}
          </tbody>
        </table>
      </div>

      <div class="totals-wrap">
        <div class="contact-card">
          <div class="contact-title">Contacto:</div>
          <br />
          <div class="contact-line">
            <div class="label">Telefono</div>
            <div class="value">${escapeHtml(COMPANY_PHONE)}</div>
          </div>
          <div class="contact-line">
            <div class="label">Email</div>
            <div class="value">${escapeHtml(COMPANY_EMAIL)}</div>
          </div>
        </div>
        <table class="totals">
          <tbody>
            <tr>
              <td>Subtotal servicios</td>
              <td class="right">${escapeHtml(formatCurrencyArs(quote.subtotal_services))}</td>
            </tr>
            <tr>
              <td>Subtotal materiales</td>
              <td class="right">${escapeHtml(formatCurrencyArs(quote.subtotal_materials))}</td>
            </tr>
            <tr>
              <td>Total</td>
              <td class="right">${escapeHtml(formatCurrencyArs(quote.total))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
  </html>`;
};

const ensureVerticalSpace = (doc: PdfDocument, currentY: number, neededSpace: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededSpace <= pageHeight - 42) {
    return currentY;
  }

  doc.addPage();
  return 42;
};

const drawInfoCard = (doc: PdfDocument, detail: QuoteDetail, x: number, y: number, width: number): number => {
  const fields = [
    { label: 'Cliente', value: detail.quote.client_name },
    { label: 'Telefono', value: detail.quote.client_phone ?? '-' },
    { label: 'Titulo', value: detail.quote.title },
    { label: 'Notas', value: detail.quote.notes ?? '-' },
  ];

  const padding = 14;
  const contentWidth = width - padding * 2;
  const preparedFields = fields.map((field) => ({
    ...field,
    lines: doc.splitTextToSize(field.value, contentWidth),
  }));

  const contentHeight = preparedFields.reduce((sum, field) => sum + 11 + field.lines.length * 13 + 8, 0);
  const height = padding + contentHeight + 4;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER_RGB);
  doc.roundedRect(x, y, width, height, 10, 10, 'FD');

  let cursorY = y + padding;
  preparedFields.forEach((field) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED_RGB);
    doc.text(field.label.toUpperCase(), x + padding, cursorY);

    cursorY += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK_RGB);
    doc.text(field.lines, x + padding, cursorY);
    cursorY += field.lines.length * 13 + 8;
  });

  return height;
};

const drawContactCard = (doc: PdfDocument, x: number, y: number, width: number): number => {
  const height = 94;
  const firstRowY = y + 50;
  const secondRowY = y + 70;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER_RGB);
  doc.roundedRect(x, y, width, height, 10, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED_RGB);
  const titleText = 'CONTACTO:';
  doc.text(titleText, x + 14, y + 18);
  const titleWidth = doc.getTextWidth(titleText);
  doc.setDrawColor(...TEXT_MUTED_RGB);
  doc.setLineWidth(0.5);
  doc.line(x + 14, y + 20, x + 14 + titleWidth, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED_RGB);
  doc.text('Telefono', x + 14, firstRowY);
  doc.setTextColor(...TEXT_DARK_RGB);
  doc.text(COMPANY_PHONE, x + width - 14, firstRowY, { align: 'right' });

  doc.setTextColor(...TEXT_MUTED_RGB);
  doc.text('Email', x + 14, secondRowY);
  doc.setTextColor(...TEXT_DARK_RGB);
  doc.text(COMPANY_EMAIL, x + width - 14, secondRowY, { align: 'right' });

  return height;
};

const drawSectionTitle = (doc: PdfDocument, title: string, x: number, y: number, lineEndX: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BRAND_BLUE_RGB);
  doc.text(title, x, y);

  const titleWidth = doc.getTextWidth(title);
  doc.setDrawColor(...BORDER_RGB);
  doc.setLineWidth(1);
  doc.line(x + titleWidth + 10, y - 4, lineEndX, y - 4);

  return y + 8;
};

const drawTotalsPanel = (doc: PdfDocument, detail: QuoteDetail, x: number, y: number, width: number): number => {
  const rowHeight = 24;
  const totalHeight = rowHeight * 3;

  doc.setDrawColor(...BORDER_RGB);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, totalHeight, 10, 10, 'FD');

  const rows = [
    { label: 'Subtotal servicios', value: formatCurrencyArs(detail.quote.subtotal_services), highlighted: false },
    { label: 'Subtotal materiales', value: formatCurrencyArs(detail.quote.subtotal_materials), highlighted: false },
    { label: 'Total', value: formatCurrencyArs(detail.quote.total), highlighted: true },
  ];

  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;

    if (index > 0) {
      doc.setDrawColor(...BORDER_RGB);
      doc.line(x, rowY, x + width, rowY);
    }

    if (row.highlighted) {
      // Draw a rounded bottom rect that matches the panel's border radius
      const cornerRadius = 10;
      const rx = x + 0.5;
      const ry = rowY + 0.5;
      const rw = width - 1;
      const rh = rowHeight - 1;
      doc.setFillColor(...BRAND_BLUE_RGB);
      // Top part (straight edges)
      doc.rect(rx, ry, rw, rh - cornerRadius, 'F');
      // Bottom part (rounded)
      doc.roundedRect(rx, ry + rh - cornerRadius * 2, rw, cornerRadius * 2, cornerRadius, cornerRadius, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
    } else {
      doc.setTextColor(...TEXT_DARK_RGB);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }

    doc.text(row.label, x + 12, rowY + 15);
    doc.text(row.value, x + width - 12, rowY + 15, { align: 'right' });
  });

  return totalHeight;
};

const exportQuotePdfWeb = async (detail: QuoteDetail, brandLogoUri: string): Promise<void> => {
  // Load web-only PDF dependencies only when the user actually exports a PDF.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jsPDF } = require('jspdf') as typeof import('jspdf');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const autoTableImport = require('jspdf-autotable') as AutoTableModule;
  const autoTable = autoTableImport.default ?? autoTableImport;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const marginX = 44;
  const pageWidth = doc.internal.pageSize.getWidth();

  const headerTopY = 38;
  let cursorY = headerTopY;
  let logoDrawn = false;
  const bannerWidth = 250;
  const logoX = pageWidth - marginX - bannerWidth;
  const contactCardWidth = 190;
  const totalsPanelWidth = 240;
  let logoHeight = 0;

  if (brandLogoUri) {
    try {
      const logoImage = await loadWebLogoImage(brandLogoUri);
      logoHeight = (bannerWidth * logoImage.height) / logoImage.width;
      doc.addImage(logoImage.dataUrl, logoImage.format, logoX, cursorY, bannerWidth, logoHeight, undefined, 'FAST');
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    logoHeight = drawCompanyLogo(doc, logoX, cursorY, bannerWidth);
  }

  const titleY = headerTopY + 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_BLUE_RGB);
  doc.text('Presupuesto tecnico', marginX, titleY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED_RGB);
  doc.text(`Fecha: ${getQuoteDisplayDate(detail)}`, marginX, titleY + 18);

  cursorY = Math.max(headerTopY + logoHeight, titleY + 26) + 20;
  const infoCardHeight = drawInfoCard(doc, detail, marginX, cursorY, pageWidth - marginX * 2);
  cursorY += infoCardHeight + 22;

  cursorY = ensureVerticalSpace(doc, cursorY, 140);
  cursorY = drawSectionTitle(doc, 'Servicios', marginX, cursorY, pageWidth - marginX);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['Servicio', 'Cantidad', 'Unitario', 'Total']],
    body: (detail.services.length === 0
      ? [['Sin servicios cargados', '-', '-', '-']]
      : detail.services.map((service) => [
          service.service_name_snapshot,
          formatQuantity(service.quantity),
          formatCurrencyArs(service.unit_price),
          formatCurrencyArs(service.total_price),
        ])) as string[][],
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 6,
      lineColor: BORDER_RGB,
      lineWidth: 0.5,
      textColor: TEXT_DARK_RGB,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: BRAND_BLUE_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 251, 255],
    },
    columnStyles: {
      0: { cellWidth: 'auto', overflow: 'linebreak' },
      1: { halign: 'center', cellWidth: 80 },
      2: { halign: 'center', cellWidth: 90 },
      3: { halign: 'center', cellWidth: 90 },
    },
  });

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 26;
  cursorY = ensureVerticalSpace(doc, cursorY, 160);
  cursorY = drawSectionTitle(doc, 'Materiales', marginX, cursorY, pageWidth - marginX);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['Material', 'Cantidad', 'Unitario', 'Total']],
    body: (detail.materials.length === 0
      ? [['Sin materiales cargados', '-', '-', '-']]
      : detail.materials.map((material) => [
          material.item_name_snapshot,
          formatQuantityWithUnit(material.quantity, material.unit),
          formatCurrencyArs(getMaterialEffectiveUnitPrice(material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)),
          formatCurrencyArs(getMaterialEffectiveTotalPrice(material.quantity, material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)),
        ])) as string[][],
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 6,
      lineColor: BORDER_RGB,
      lineWidth: 0.5,
      textColor: TEXT_DARK_RGB,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: BRAND_BLUE_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 251, 255],
    },
    columnStyles: {
      0: { cellWidth: 'auto', overflow: 'linebreak' },
      1: { halign: 'center', cellWidth: 80 },
      2: { halign: 'center', cellWidth: 90 },
      3: { halign: 'center', cellWidth: 90 },
    },
  });

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 24;
  cursorY = ensureVerticalSpace(doc, cursorY, 132);
  const contactCardHeight = drawContactCard(doc, marginX, cursorY, contactCardWidth);
  drawTotalsPanel(doc, detail, pageWidth - marginX - totalsPanelWidth, cursorY, totalsPanelWidth);
  cursorY += Math.max(contactCardHeight, 72) + 16;

  doc.save(buildPdfName(detail));
};

const createNativeQuotePdfFile = async (detail: QuoteDetail): Promise<{ uri: string; fileName: string }> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Print = require('expo-print') as typeof import('expo-print');

  const html = buildQuotePdfHtml(detail, '');
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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Print = require('expo-print') as typeof import('expo-print');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');

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

    await Print.printAsync({ html: buildQuotePdfHtml(detail, '') });
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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
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

export const exportQuotePdf = async (detail: QuoteDetail): Promise<void> => {
  await shareQuotePdf(detail);
};
