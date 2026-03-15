# Precios Tecnicos (smart-chip)

App mobile (Expo + React Native) para gestion de precios, servicios y presupuestos tecnicos.

## Requisitos

- Node.js 18+
- npm 9+
- Proyecto de Supabase
- Expo Go o emulador Android/iOS

## Setup rapido

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo `.env`:

```powershell
Copy-Item .env.example .env
```

3. Completar variables en `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO` (opcional, override del repo publico para updates por APK)

4. Aplicar base de datos en Supabase (en este orden):

- `supabase/migrations/202603100001_initial_schema.sql`
- `supabase/migrations/202603100002_quotes_services.sql`
- `supabase/migrations/202603100003_appointments.sql`
- `supabase/migrations/202603100004_jobs_calendar_material_notes.sql`

5. (Opcional) Cargar datos de ejemplo:

- `supabase/seed/seed.sql`
- `supabase/seed/seed_nossa_clima.sql`
- Para limpiar datos de prueba (manteniendo servicios): `supabase/seed/reset_non_services.sql`

6. Levantar app:

```bash
npm run start
```

Con Expo CLI:
- `a` abre Android
- `w` abre Web

## Scripts utiles

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Notas

- Usar solo `anon key` en la app cliente. No usar `service role key`.
- Si el usuario existe en Supabase Auth pero no en `profiles`, la app intenta crear el perfil al iniciar sesion.
- Documentacion de pre-release: `docs/PRE_RELEASE_SETUP.md`.
- Documentacion de updates por APK: `docs/APP_UPDATES.md`.
