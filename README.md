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

4. Aplicar base de datos en Supabase (en este orden):

- `supabase/migrations/202603100001_initial_schema.sql`
- `supabase/migrations/202603100002_quotes_services.sql`
- `supabase/migrations/202603100003_appointments.sql`

5. (Opcional) Cargar datos de ejemplo:

- `supabase/seed/seed.sql`

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
