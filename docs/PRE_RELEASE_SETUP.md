# Precios Técnicos

App mobile (Expo + React Native) para técnicos de refrigeración/aire acondicionado.

## Stack
- Expo Router + TypeScript estricto
- React Native Paper
- Zustand
- TanStack Query
- React Hook Form + Zod
- Supabase + PostgreSQL + RLS

## Requisitos
- Node.js 18+
- npm 9+
- Cuenta/proyecto Supabase
- Expo Go o emulador Android

## Setup local
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear archivo `.env` desde el ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Completar variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Ejecutar app:
   ```bash
   npm run start
   ```

## Variables de entorno
Ver `.env.example`.

Estas variables son públicas del cliente móvil (anon key), no usar service role en la app.

## Base de datos (migrations + seed)
Aplicar migraciones en orden desde `supabase/migrations/`.

Seed de prueba E2E:
- `supabase/seed/seed.sql`

Incluye:
- stores de ejemplo
- items de ejemplo
- historial de precios
- servicios
- quote de ejemplo con líneas de materiales y servicios

## Correr en Android Emulator
1. Iniciar emulador Android.
2. En otra terminal:
   ```bash
   npm run start
   ```
3. Presionar `a` en Expo CLI para abrir Android.

## Auth de prueba
Podés usar un usuario existente en Supabase Auth.

Si el perfil (`profiles`) no existe, la app intenta crearlo automáticamente al iniciar sesión/sincronizar sesión.

## QA manual sugerido (E2E)
1. Iniciar sesión.
2. Crear store.
3. Crear item.
4. Registrar precio.
5. Crear service.
6. Crear quote.
7. Agregar material al quote.
8. Agregar servicio al quote.
9. Editar línea.
10. Duplicar línea.
11. Borrar línea.
12. Verificar subtotal materiales.
13. Verificar subtotal servicios.
14. Verificar total final.
15. Cerrar sesión.
16. Reabrir app y validar persistencia de sesión.

## Estado pre-release actual
- Cálculos finales de líneas/subtotales/totales en DB (triggers/functions).
- RLS por usuario en tablas principales.
- Estados de loading/error/empty mejorados en pantallas clave.
- Formato unificado de moneda ARS en listados y quotes.

## Limitaciones conocidas
- No hay suite de tests E2E automática aún.
- Lint/typecheck pueden requerir entorno Expo completo para ejecutarse localmente.
- Exportación PDF/compartir y plantillas de presupuestos quedan para iteraciones futuras.
