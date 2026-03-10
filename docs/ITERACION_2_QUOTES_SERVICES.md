# Iteración 2 — Services y Quotes

Este documento describe la implementación incremental del módulo de presupuestos sobre la base existente.

## Alcance implementado
- CRUD de servicios (`services`) con archivado lógico (`is_active`).
- Listado de presupuestos (`quotes`) con filtro por estado.
- Creación y edición de cabecera de presupuesto.
- Agregado de materiales al presupuesto:
  - selección de ítems existentes,
  - tienda de referencia opcional,
  - precio sugerido desde `latest_store_item_prices` o último precio conocido,
  - margen opcional (`margin_percent`) para sugerencia,
  - override manual de `unit_price`.
- Agregado de servicios al presupuesto:
  - selección de servicios activos,
  - precio sugerido desde `base_price`,
  - override manual de `unit_price`.
- Totales persistentes y consistentes:
  - total por línea material/servicio,
  - subtotal materiales,
  - subtotal servicios,
  - total general.

## Base de datos
Migración principal:
- `supabase/migrations/202603100002_quotes_services.sql`

Incluye:
- Enum `quote_status` (`draft`, `sent`, `approved`, `rejected`).
- Tablas nuevas:
  - `services`
  - `quotes`
  - `quote_material_items`
  - `quote_service_items`
- Triggers `updated_at`.
- Defaults de `user_id`.
- Validaciones de integridad:
  - no permitir ítems/servicios inactivos,
  - ownership consistente entre quote y líneas,
  - validación de tienda fuente opcional activa.
- Cálculo de `total_price` por línea en trigger.
- Recalculo automático de subtotales/totales de quote con triggers.
- Índices para consultas por usuario/estado/quote.
- RLS + policies por usuario en todas las tablas nuevas.

## Seeds
Se agregaron servicios de ejemplo en:
- `supabase/seed/seed.sql`

Servicios incluidos:
- Instalación hasta 3000 fr
- Visita técnica
- Limpieza split hasta 4500 fr
- Cambio de capacitor
- Carga de gas R-410 hasta 1kg

## Frontend
Rutas nuevas (Expo Router):
- Services:
  - `app/(tabs)/services.tsx`
  - `app/services/new.tsx`
  - `app/services/[id].tsx`
- Quotes:
  - `app/(tabs)/quotes.tsx`
  - `app/quotes/new.tsx`
  - `app/quotes/[id]/index.tsx`
  - `app/quotes/[id]/add-material.tsx`
  - `app/quotes/[id]/add-service.tsx`

## Capa de aplicación
- Tipos nuevos en `src/types/db.ts`.
- API Supabase tipada:
  - `src/services/services.ts`
  - `src/services/quotes.ts`
- Zod schemas:
  - `src/features/services/schemas.ts`
  - `src/features/quotes/schemas.ts`
- Hooks TanStack Query:
  - `src/features/services/hooks.ts`
  - `src/features/quotes/hooks.ts`
- Formularios UI:
  - `src/features/services/ServiceForm.tsx`
  - `src/features/quotes/QuoteForm.tsx`

## Decisión de cálculo
Se implementó recálculo de subtotales/totales en PostgreSQL (triggers) para asegurar consistencia de negocio en cualquier origen de escritura (app actual y futuras integraciones).

## Fuera de alcance de esta iteración
- Plantillas de presupuestos
- Exportación/compartir PDF
- Descuentos e impuestos
- Multimoneda
- Adjuntos/imágenes
- Motor avanzado de fórmulas
- Edición/eliminación de líneas existentes
