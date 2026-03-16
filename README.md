# Precios Tecnicos (smart-chip)

App mobile (Expo + React Native) para gestion de precios, servicios y presupuestos tecnicos.

## Requisitos

- Node.js 18+
- npm 9+
- Proyecto de Supabase
# Precios Tecnicos (Nossa Clima mobile)

Professional mobile application for managing prices, services and technical quotes. The app is part of the Nossa Clima ecosystem and provides a compact interface for creating quotes, managing service and item catalogs, tracking prices and generating PDF exports.

## What this project is

- A cross-platform mobile application built with Expo (React Native + TypeScript).
- Intended for technicians and administrators to create, manage and export price estimates and service quotes.
- Integrates with Supabase as the backend (database and authentication).

This repository contains the client application and assets used by the Nossa Clima initiative for field operations and quoting.

## Key features

- Create and manage services, items and stores.
- Build and export quotes as PDF.
- Price history and price comparison screens.
- Offline-capable client with Supabase sync for authenticated users.

## Tech stack

- Expo / React Native (mobile UI)
- TypeScript
- Supabase (Postgres + Auth) via `@supabase/supabase-js`
- React Query (`@tanstack/react-query`) for remote state and caching
- React Hook Form + Zod for forms and validation
- Zustand for lightweight local state
- jsPDF + jspdf-autotable for PDF export
- Vitest + Testing Library for tests; ESLint + Prettier for linting/formatting

See `package.json` for exact dependency versions.

## Requirements

- Node.js 18 or later
- npm 10+ (this project uses npm as package manager)
- Expo CLI (recommended) or Expo Go for device testing
- A Supabase project with database and service migrations applied

Do not store or commit any secret keys. Only the Supabase anonymous public key (anon key) should be used in the client app.

## Quickstart (local development)

1. Clone the repository:

```bash
git clone https://github.com/mattcastells/nossa-clima.git
cd nossa-clima
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```powershell
Copy-Item .env.example .env
# then edit .env and set the required values
```

Required environment variables (example keys used by the client):

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- (optional) EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO
- (optional) EXPO_PUBLIC_AI_FUNCTION_NAME

4. Prepare the Supabase database

Apply the SQL migration files in the `supabase/migrations/` folder to your Supabase project's database. Files are intended to be applied in chronological order. Example files include:

- `supabase/migrations/202603100001_initial_schema.sql`
- `supabase/migrations/202603100002_quotes_services.sql`
- `supabase/migrations/202603100003_appointments.sql`

You can apply them with the Supabase dashboard SQL editor or the Supabase CLI.

Optional: load seed data from `supabase/seed/` if you need example records for testing.

5. Start the app (Expo)

```bash
npm run start
```

From the Expo UI you can run on Android, iOS simulator/emulator, or web. Common shortcuts shown in the Expo terminal apply (for example: `a` to open Android).

### Android development workflow

- Use `npm run android` for the normal development loop. It starts Expo and opens the installed development client without recompiling native Android code.
- Use `npm run android:build` only when you need to install or rebuild the native Android app, for example after changing native dependencies, Expo config plugins, or files under `android/`.
- If Metro looks stale, use `npm run start:clear`.

This project also limits local Android builds to 64-bit ABIs by default (`arm64-v8a` and `x86_64`) to reduce cold build time. If you need a legacy 32-bit target, override `reactNativeArchitectures` from the Gradle CLI.

## Tests & checks

- Run type check: `npm run typecheck`
- Run lint: `npm run lint`
- Run tests: `npm run test`

## Notes and recommendations

- The repository uses the Supabase anonymous key on the client; never use or expose the service role key in client code.
- After renaming or moving the repository, update any CI/CD workflows, GitHub Actions, webhooks or external integrations that reference the repository URL.
- Keep migration files and seed data under `supabase/` to reproduce the schema locally or in staging.

## AI assistant setup

The app includes an optional `Asistente AI` screen that talks to a Supabase Edge Function using the Gemini API.

Files involved:

- `app/(tabs)/assistant.tsx`
- `src/services/assistant.ts`
- `supabase/functions/assistant-chat/index.ts`

### Supabase secrets

Set these in Supabase before using the assistant:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

Optional:

```bash
supabase secrets set GEMINI_ASSISTANT_INSTRUCTIONS="Sos el asistente tecnico de Nossa Clima. Ayudas a personas que trabajan con aires acondicionados, refrigeracion, instalaciones tecnicas y electronica aplicada. Responde en espanol claro, concreto y util. Prioriza diagnostico, mantenimiento, materiales, seguridad electrica, herramientas, instalacion y service. Si la imagen o el texto no alcanzan para dar una respuesta confiable, explicalo y pedi el dato faltante. No inventes datos tecnicos."
```

### Deploy the Edge Function

```bash
supabase functions deploy assistant-chat
```

If you want a different public function name in the client:

```bash
EXPO_PUBLIC_AI_FUNCTION_NAME=assistant-chat
```

### Current MVP scope

- Text questions
- One optional image per message
- Conversation continuity using recent local history
- No database persistence yet

This keeps the first version simple and avoids storing user images or messages until that is explicitly designed.

## Where to find more documentation

- Release process and tag convention: `RELEASES.md`
- Pre-release and setup notes: `docs/PRE_RELEASE_SETUP.md`
- Additional operational notes: `docs/ITERACION_2_QUOTES_SERVICES.md`

If you need the README tailored further (shorter, more examples, or added troubleshooting), tell me which section to expand and I will update it.
