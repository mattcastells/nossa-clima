# Rediseño UI — Nossa Clima (guía de migración)

Documento para aplicar el rediseño sobre la app real. Todos los cambios respetan
la lógica existente (hooks, formularios, llamadas a Supabase, navegación).

## 1. Sistema de diseño (centralizado)

Todo sale de `src/theme/index.ts`. Cambiando ahí se reskinnea toda la app.

- **Marca:** navy `#052653` (sin cambios).
- **Acento nuevo:** cian `#06B6D4` (CTAs, foco, links) — tokens `accent`, `accentStrong` `#0891B2`, `accentSoft` `#E0F7FC`, `onAccent` `#02323D`.
- **Semánticos:** verde `#15803D` (servicios/ok), ámbar `#B45309` (precios/pendiente), rojo `#DC2626` (peligro/cancelado).
- **Neutros:** fondo `#F4F6F9`, surface `#FFFFFF`, borde `#E4E9F0`, texto `#0F1B2D`, muted `#64748B`.
- **Radios:** `roundness` 12; tarjetas 16–18; pills 999.
- **Tipografía en la app:** se mantiene la del sistema (Paper). En los mockups se usó Plus Jakarta Sans + Space Grotesk para importes.

## 2. Archivos ya modificados (copiar al repo)

| Archivo | Cambio |
|---|---|
| `src/theme/index.ts` | Paleta navy+cian, semánticos, dark mode, radios. Reskin global. |
| `src/components/AppScreen.tsx` | **Tab bar real** de 5 secciones (Inicio·Trabajos·Agenda·Materiales·Asistente) + back en anidadas. |
| `app/(tabs)/index.tsx` | Home hub: CTA "Nuevo trabajo" + grilla de accesos. |
| `app/(auth)/login.tsx` | Logo + tarjeta; sin textos redundantes. |
| `src/features/quotes/status.ts` | Colores de estado ámbar/verde/rojo (lista, detalle, agenda). |
| `app/(tabs)/quotes/index.tsx` | Lista: badge color+texto, filtros por estado, tarjeta plana, FAB. |
| `app/(tabs)/items/index.tsx` | Lista de materiales: buscador + filtro categoría, tarjeta plana, FAB. |
| `app/(tabs)/items/[id].tsx` | Detalle: medidas y precios al nuevo sistema, badges, sin relleno. |
| `app/(tabs)/services/index.tsx` | Lista de servicios: buscador + categoría, precio, FAB. |
| `app/(tabs)/stores/index.tsx` | Lista de tiendas: fila con ícono + chevron. |
| `app/(tabs)/settings.tsx` | Agrupada Apariencia/Aplicación/Cuenta con filas + íconos. |
| `app/(tabs)/assistant.tsx` | Íconos de micrófono en lugar de texto "Audio"/"MIC". |
| `src/features/appointments/WorkCalendarCard.tsx` | Agenda por hora (timeline) + alta de turno en panel. |
| `src/features/quotes/exportPdf.ts` | Azul de marca `#052653`. |

## 3. Reskineadas automáticamente por el theme (sin tocar)

Alta/edición de material, servicio y tienda (ItemForm/ServiceForm), nuevo trabajo +
add-material/add-service, detalle de trabajo, precios/comparación/historial,
documentos, categorías, cleanup, diálogos, toasts y estados de carga/error.

## 4. Pendiente (hacer con la app corriendo)

**`app/(tabs)/quotes/[id]/index.tsx`** (detalle de trabajo, 1182 líneas): ya está
reskineado y funcional. Falta la reestructuración de presentación (acordeones →
secciones más planas, tabla de conceptos como tarjetas). Es la pantalla más crítica;
conviene reescribir la presentación con la app en `localhost` validando cada paso,
sin tocar los hooks (`useQuoteDetail`, `useSaveQuote`, `useUpdateQuoteStatus`,
`saveQuotePdf`/`shareQuotePdf`, `QuoteItemsTable`, `QuoteTotalsSummary`).

## 5. Bugs / mejoras detectadas

- Acentos faltantes en varias strings ("Descripcion", "Categoria", "version").
- Trabajos cancelados se autoborran a los 3 días sin deshacer → considerar undo/toast.
- Fecha tipeada a mano (DD-MM-AAAA) en varios lugares → usar date picker nativo.

## 6. Referencia visual

`Nossa Clima App (prototipo).dc.html` (en el proyecto) es la app completa navegable
con el diseño final de cada pantalla — usar como fuente de verdad al migrar.
