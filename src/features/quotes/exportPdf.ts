import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { Platform } from 'react-native';

import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import type { QuoteDetail } from '@/services/quotes';
import { getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from './materialPricing';

const BRAND_BLUE_HEX = '#032D6E';
const BRAND_BLUE_RGB: [number, number, number] = [3, 45, 110];
// eslint-disable-next-line @typescript-eslint/no-var-requires
const brandLogo = require('../../../assets/Nossa Clima - Logo.jpg.jpeg');

type WebLogoImage = {
  dataUrl: string;
  width: number;
  height: number;
};

const resolveBrandLogoUri = async (): Promise<string> => {
  try {
    const asset = Asset.fromModule(brandLogo);

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

const formatNumber = (value: number): string => Number(value ?? 0).toFixed(2);

const sanitizeFileName = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'presupuesto';
};

const buildPdfName = (detail: QuoteDetail): string =>
  `${sanitizeFileName(detail.quote.title)}-${detail.quote.id.slice(0, 8)}.pdf`;

const renderServicesRows = (detail: QuoteDetail): string => {
  if (detail.services.length === 0) {
    return '<tr><td colspan="4">Sin servicios cargados</td></tr>';
  }

  return detail.services
    .map(
      (service) => `
      <tr>
        <td>${escapeHtml(service.service_name_snapshot)}</td>
        <td class="right">${formatNumber(service.quantity)}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(service.unit_price))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(service.total_price))}</td>
      </tr>`,
    )
    .join('');
};

const renderMaterialsRows = (detail: QuoteDetail): string => {
  if (detail.materials.length === 0) {
    return '<tr><td colspan="5">Sin materiales cargados</td></tr>';
  }

  return detail.materials
    .map(
      (material) => `
      <tr>
        <td>${escapeHtml(material.item_name_snapshot)}</td>
        <td class="right">${formatNumber(material.quantity)}</td>
        <td>${escapeHtml(material.unit ?? '-')}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(getMaterialEffectiveUnitPrice(material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)))}</td>
        <td class="right">${escapeHtml(formatCurrencyArs(getMaterialEffectiveTotalPrice(material.quantity, material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)))}</td>
      </tr>`,
    )
    .join('');
};

const buildCompanyLogoSvg = (): string => `
  <svg viewBox="0 0 1400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo Nossa Clima">
    <polygon points="0,250 220,50 220,250" fill="${BRAND_BLUE_HEX}" />
    <line x1="250" y1="250" x2="470" y2="250" stroke="${BRAND_BLUE_HEX}" stroke-width="14" />
    <line x1="470" y1="50" x2="1400" y2="50" stroke="${BRAND_BLUE_HEX}" stroke-width="14" />
    <text x="250" y="190" fill="${BRAND_BLUE_HEX}" font-family="Arial, Helvetica, sans-serif" font-size="158" font-weight="700" letter-spacing="1">
      NOSSA CLIMA
    </text>
    <text x="500" y="266" fill="${BRAND_BLUE_HEX}" font-family="Arial, Helvetica, sans-serif" font-size="52" letter-spacing="1">
      SERVICIOS INTEGRALES DE REFRIGERACION
    </text>
  </svg>`;

const drawCompanyLogo = (doc: jsPDF, x: number, y: number, width: number): number => {
  const baseWidth = 420;
  const scale = width / baseWidth;
  const logoHeight = 102 * scale;

  doc.setFillColor(...BRAND_BLUE_RGB);
  doc.triangle(x, y + 82 * scale, x + 70 * scale, y + 22 * scale, x + 70 * scale, y + 82 * scale, 'F');

  doc.setDrawColor(...BRAND_BLUE_RGB);
  doc.setLineWidth(Math.max(1, 3 * scale));
  doc.line(x + 78 * scale, y + 82 * scale, x + 170 * scale, y + 82 * scale);
  doc.line(x + 170 * scale, y + 22 * scale, x + 400 * scale, y + 22 * scale);

  doc.setTextColor(...BRAND_BLUE_RGB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(40 * scale);
  doc.text('NOSSA CLIMA', x + 82 * scale, y + 64 * scale);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12 * scale);
  doc.text('SERVICIOS INTEGRALES DE REFRIGERACION', x + 178 * scale, y + 86 * scale);

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
        reject(new Error('No se pudo obtener contexto 2D para el logo'));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error('No se pudo cargar el logo para PDF web'));
    image.src = uri;
  });
};

const buildQuotePdfHtml = (detail: QuoteDetail, brandLogoUri: string): string => {
  const { quote } = detail;
  const createdAt = formatDateAr(quote.created_at);
  const generatedAt = new Date().toLocaleString('es-AR');
  const logoMarkup = brandLogoUri
    ? `<img src="${escapeHtml(brandLogoUri)}" alt="Logo Nossa Clima" />`
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
        body { font-family: Arial, sans-serif; color: #111827; padding: 24px; margin: 0; }
        h1 { font-size: 24px; margin: 0 0 8px; color: ${BRAND_BLUE_HEX}; }
        h2 { font-size: 16px; margin: 22px 0 10px; }
        .meta { margin: 0; font-size: 13px; color: #4b5563; }
        .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 14px; margin-top: 14px; }
        .brand-logo { width: 100%; max-width: 560px; margin-bottom: 14px; }
        .brand-logo img { display: block; width: 100%; height: auto; }
        .brand-logo svg { display: block; width: 100%; height: auto; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .label { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
        .value { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
        th { background: ${BRAND_BLUE_HEX}; color: #ffffff; }
        .right { text-align: right; }
        .totals { margin-top: 16px; width: 320px; margin-left: auto; }
        .totals td { font-size: 13px; }
        .totals tr:last-child td { font-weight: 700; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="brand-logo">${logoMarkup}</div>
      <h1>Presupuesto tecnico</h1>
      <p class="meta">Generado: ${escapeHtml(generatedAt)}</p>
      <p class="meta">Fecha de alta: ${escapeHtml(createdAt)}</p>

      <div class="box">
        <div class="grid">
          <div>
            <div class="label">Cliente</div>
            <div class="value">${escapeHtml(quote.client_name)}</div>
          </div>
          <div>
            <div class="label">Telefono</div>
            <div class="value">${escapeHtml(quote.client_phone ?? '-')}</div>
          </div>
          <div>
            <div class="label">Titulo</div>
            <div class="value">${escapeHtml(quote.title)}</div>
          </div>
          <div>
            <div class="label">Notas</div>
            <div class="value">${escapeHtml(quote.notes ?? '-')}</div>
          </div>
        </div>
      </div>

      <h2>Servicios</h2>
      <table>
        <thead>
          <tr>
            <th>Servicio</th>
            <th class="right">Cant.</th>
            <th class="right">Precio</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${renderServicesRows(detail)}
        </tbody>
      </table>

      <h2>Materiales</h2>
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th class="right">Cant.</th>
            <th>Unidad</th>
            <th class="right">Precio</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${renderMaterialsRows(detail)}
        </tbody>
      </table>

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
    </body>
  </html>`;
};

const exportQuotePdfWeb = async (detail: QuoteDetail, brandLogoUri: string): Promise<void> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const marginX = 44;

  let cursorY = 42;
  let logoDrawn = false;

  if (brandLogoUri) {
    try {
      const logoImage = await loadWebLogoImage(brandLogoUri);
      const logoWidth = 340;
      const logoHeight = (logoWidth * logoImage.height) / logoImage.width;
      doc.addImage(logoImage.dataUrl, 'JPEG', marginX, cursorY, logoWidth, logoHeight, undefined, 'FAST');
      cursorY += logoHeight + 18;
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    const logoHeight = drawCompanyLogo(doc, marginX, cursorY, 340);
    cursorY += logoHeight + 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_BLUE_RGB);
  doc.text('Presupuesto tecnico', marginX, cursorY);

  cursorY += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(34, 49, 63);
  doc.text(`Fecha: ${formatDateAr(detail.quote.created_at)}`, marginX, cursorY);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 330, cursorY);

  cursorY += 20;
  doc.setFontSize(12);
  doc.text(`Cliente: ${detail.quote.client_name}`, marginX, cursorY);
  cursorY += 16;
  doc.text(`Telefono: ${detail.quote.client_phone ?? '-'}`, marginX, cursorY);
  cursorY += 16;
  doc.text(`Titulo: ${detail.quote.title}`, marginX, cursorY);
  cursorY += 16;
  doc.text(`Notas: ${detail.quote.notes ?? '-'}`, marginX, cursorY);

  cursorY += 16;
  doc.setDrawColor(210);
  doc.line(marginX, cursorY, 552, cursorY);
  cursorY += 14;

  doc.setFont('helvetica', 'bold');
  doc.text('Servicios', marginX, cursorY);
  cursorY += 8;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['Servicio', 'Cant.', 'Precio unit.', 'Total']],
    body: (detail.services.length === 0
      ? [['Sin servicios cargados', '-', '-', '-']]
      : detail.services.map((service) => [
          service.service_name_snapshot,
          formatNumber(service.quantity),
          formatCurrencyArs(service.unit_price),
          formatCurrencyArs(service.total_price),
        ])) as string[][],
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: BRAND_BLUE_RGB, textColor: [255, 255, 255] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 24;
  doc.setFont('helvetica', 'bold');
  doc.text('Materiales', marginX, cursorY);
  cursorY += 8;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['Material', 'Cant.', 'Unidad', 'Precio unit.', 'Total']],
    body: (detail.materials.length === 0
      ? [['Sin materiales cargados', '-', '-', '-', '-']]
      : detail.materials.map((material) => [
          material.item_name_snapshot,
          formatNumber(material.quantity),
          material.unit ?? '-',
          formatCurrencyArs(getMaterialEffectiveUnitPrice(material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)),
          formatCurrencyArs(getMaterialEffectiveTotalPrice(material.quantity, material.unit_price, material.margin_percent, detail.quote.default_material_margin_percent)),
        ])) as string[][],
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: BRAND_BLUE_RGB, textColor: [255, 255, 255] },
    columnStyles: {
      1: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  cursorY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 24;
  doc.setFont('helvetica', 'bold');
  doc.text(`Subtotal servicios: ${formatCurrencyArs(detail.quote.subtotal_services)}`, marginX, cursorY);
  cursorY += 16;
  doc.text(`Subtotal materiales: ${formatCurrencyArs(detail.quote.subtotal_materials)}`, marginX, cursorY);
  cursorY += 18;
  doc.setFontSize(13);
  doc.text(`Total: ${formatCurrencyArs(detail.quote.total)}`, marginX, cursorY);

  doc.save(buildPdfName(detail));
};

export const exportQuotePdf = async (detail: QuoteDetail): Promise<void> => {
  const brandLogoUri = await resolveBrandLogoUri();

  if (Platform.OS === 'web') {
    await exportQuotePdfWeb(detail, brandLogoUri);
    return;
  }

  const html = buildQuotePdfHtml(detail, brandLogoUri);
  const file = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Exportar presupuesto',
      UTI: '.pdf',
    });
    return;
  }

  await Print.printAsync({ html });
};
