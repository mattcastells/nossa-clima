# Handoff — Rediseño UI mobile · Nossa Clima

## Para quién es esto
Para una sesión de **Claude Code trabajando dentro del repo real** (`mattcastells/nossa-clima`, Expo + React Native + TypeScript + react-native-paper). El objetivo es **mergear el diseño nuevo con la lógica original** de forma incremental y **compilando/validando en cada paso**, NO copiar archivos a ciegas.

> ⚠️ Contexto importante: los archivos de `reference_implementation/` se escribieron contra un *snapshot* del repo, sin poder compilar. Cuando el usuario los copió tal cual, **se rompió** (típico: aplicar unos sí y otros no, o desajustes de imports/props/tipos con el repo actual). Este handoff existe para hacerlo bien: adaptando, no pegando.

## Cómo trabajar (regla de oro)
1. Trabajá en una rama: `git checkout -b rediseno-ui`.
2. Aplicá **primero el theme** (paso 1 de abajo), corré `npm run typecheck` y `npm run start`. No sigas hasta que compile.
3. Después, **una pantalla por commit**: adaptá el archivo de referencia al código real, `npm run typecheck` + `npm run lint`, probá en el emulador, commit. Si algo falla, arreglá antes de seguir.
4. No cambies lógica de negocio: hooks (React Query), formularios (react-hook-form + zod), llamadas a Supabase, params de navegación, permisos. Solo cambia **presentación**.

## Fidelidad
**Hi-fi.** El prototipo (`prototipo/Nossa Clima App (prototipo).dc.html`) y las referencias tienen colores, tipografía, espaciados e interacciones finales. Recreá pixel-perfect con los componentes/paper que ya usa el repo.

## Cómo usar cada carpeta
- `prototipo/` — la app rediseñada navegable en HTML. **Fuente de verdad visual.** Abrila en un navegador y recorré con la tab bar. Es referencia, no se shippea.
- `prototipo/screenshots/` — captura de cada pantalla en alta calidad + `INDEX.md` que mapea cada imagen a su archivo del repo. Usalas para máxima fidelidad.
- `DESIGN_GUIDELINES.md` — reglas de diseño (tokens, recetas de componentes, do/don'ts). **Seguilas siempre que crees o modifiques UI**, no solo al aplicar este rediseño.
- `reference_implementation/` — versiones `.tsx`/`.ts` ya adaptadas al repo (misma estructura de carpetas). Son **candidatos fuertes**, pero **verificá contra el repo real** antes de pisar: imports, nombres de hooks, tipos de props y firmas de componentes compartidos (`QuoteItemsTable`, `ItemForm`, `ServiceForm`, `AppScreen`, etc.).

---

## Paso 1 — Design tokens (base, hacer primero)
Archivo: `src/theme/index.ts`. Se **mantienen todos los nombres de token existentes** y se cambian valores; además se **agregan** tokens nuevos. Esto reskinea casi toda la app sola.

**Causa probable de rotura #1:** varios archivos nuevos usan `theme.colors.accent` / `accentStrong` / `accentSoft` / `onAccent`. Si el theme NO se aplicó primero, esas pantallas crashean (`undefined`). → Aplicá el theme y su `AppExtendedColors` (los tipos) antes que nada.

Tokens (light):
- primary (marca) `#052653` · secondary/accent `#06B6D4` · accentStrong `#0891B2` · accentSoft `#E0F7FC` · onAccent `#02323D`
- background `#F4F6F9` · surface `#FFFFFF` · surfaceVariant `#EAEFF5` · borderSoft `#E4E9F0` · outline `#CBD5E1`
- titleOnSoft `#0F1B2D` · textMuted `#64748B` · error `#DC2626`
- softBlue `#E2F4FB` / softBlueStrong `#B9E4F2` · softGreen `#E7F6EC` / softGreenStrong `#BEE6C9` · softYellow `#FBEFD2` / softYellowStrong `#F2D89A` / onSoftYellow `#8A5A00`
- toastSuccessSurface `#EAF7EE` / toastSuccessText `#15803D` · toastErrorSurface `#FDECEC` / toastErrorText `#B91C1C`
- dialogSurface `#FFFFFF` (antes era lila `#F8F3FB` por error)
- `roundness: 12`
- Semánticos de marca (constantes exportadas): BRAND_GREEN `#15803D`, BRAND_YELLOW `#8A5A00`, BRAND_CYAN `#06B6D4` (+ soft/dark). BRAND_BLUE sigue `#052653`.
- Dark mode: set análogo en tonos navy fríos + acento cian (ver archivo).

Recordá agregar al type `AppExtendedColors`: `accent`, `accentStrong`, `accentSoft`, `onAccent`.

## Paso 2 — Shell de navegación
Archivo: `src/components/AppScreen.tsx`.
- Reemplaza la barra inferior vieja (Atrás/Inicio/Asistente) por una **tab bar real de 5 secciones**: Inicio (`/(tabs)`), Trabajos (`/(tabs)/quotes`), Agenda (`/(tabs)/calendar`), Materiales (`/(tabs)/items`), Asistente (`/(tabs)/assistant`). Activo por `segments[1]` (con `?? 'index'`).
- El botón "Volver" pasa al encabezado en pantallas anidadas.
- **Compatibilidad:** el prop `showHomeButton` sigue en la interfaz (aunque no se use) para no romper los call-sites que lo pasan (`items/[id]`, `quotes/[id]`). No lo elimines de `Props`.
- La tab bar aparece con `width < 768`.

## Paso 3 — Pantallas (una por commit)
Cada una tiene su archivo en `reference_implementation/` y su vista en el prototipo. Patrón común: encabezado con título + `IconButton` "+" (FAB) en `titleRight`, buscador tipo "pill", tarjetas planas (radio 16), badges tipo pill (color + texto).

| Pantalla | Archivo | Qué cambia (solo presentación) | Lógica a preservar |
|---|---|---|---|
| Home | `app/(tabs)/index.tsx` | Banner logo compacto + CTA "Nuevo trabajo" + grilla accesos | `router.push` a rutas existentes |
| Login | `app/(auth)/login.tsx` | Logo sobre navy + tarjeta blanca. **Sin** subtítulos ("Ingresá con tu usuario…") ni eslogan (ya está en el logo) | `useForm`/`zodResolver`/`signIn`/`pendingPath` |
| Estados | `src/features/quotes/status.ts` | Solo colores ámbar/verde/rojo | `normalizeQuoteStatus` etc. sin tocar |
| Trabajos (lista) | `app/(tabs)/quotes/index.tsx` | Badge color+texto, **filtros por estado**, tarjeta plana, FAB | `useQuotes`, search, paginación |
| Materiales (lista) | `app/(tabs)/items/index.tsx` | Buscador + filtro categoría (Menu), tarjeta plana, FAB | `useItems`, filtros, categorías |
| Materiales (detalle) | `app/(tabs)/items/[id].tsx` | Encabezados limpios, badges de medida (Calculada cian / Manual gris), quita textos de relleno | **TODO** el resto: `ItemForm`, dialog de medidas, `useSaveItem`/`useSaveItemMeasurement`, precios por tienda, link a `/prices/new`, `CatalogAuditCard` |
| Servicios (lista) | `app/(tabs)/services/index.tsx` | Buscador + categoría, precio, FAB, link "Categorías" | `useServices`, `useServiceCategories`, paginación |
| Tiendas (lista) | `app/(tabs)/stores/index.tsx` | Fila con ícono + chevron | `useStores`, search |
| Opciones | `app/(tabs)/settings.tsx` | Agrupada Apariencia/Aplicación/Cuenta, filas + íconos | `useThemeStore`, `signOut`, `checkAndInstallUpdate`, link cleanup |
| Asistente | `app/(tabs)/assistant.tsx` | Íconos de micrófono (reemplaza texto "Audio"/"MIC"). Requiere agregar `Icon` al import de paper | toda la lógica de chat/audio/acciones |
| Calendario | `src/features/appointments/WorkCalendarCard.tsx` | **Agenda por hora** (timeline hora + tarjeta con borde por estado) + alta de turno en panel | `useAppointmentsInMonth`, `useCreateAppointment`, `useDeleteAppointment`, `useNotificationSync`, navegación |
| PDF | `src/features/quotes/exportPdf.ts` | Solo azul de marca `#052653` (BRAND_BLUE_HEX/RGB) | generación jsPDF intacta |

**Checklist anti-rotura por archivo:**
- Compará imports con el repo real (rutas `@/…`, qué exporta cada módulo).
- Verificá que los hooks devuelven lo que la vista espera (nombres de campos del modelo `db.ts`).
- Si un archivo de referencia quitó un import ahora usado, o dejó uno sin usar, ajustá (el repo tiene ESLint `no-unused-vars`).

## Paso 4 — Pendiente real (hacer con la app corriendo)
`app/(tabs)/quotes/[id]/index.tsx` (detalle de trabajo, ~1182 líneas) — **la pantalla más crítica**. NO tiene versión reescrita a propósito. Ya queda reskineada por el theme. Falta pasar la presentación (acordeones Cliente/Fecha, tabla de conceptos, selector de estado, acciones PDF) al patrón nuevo (secciones planas, tarjetas). Hacelo mirando el prototipo (pantalla "Trabajo · detalle"), sin tocar: `useQuoteDetail`, `useSaveQuote`, `useUpdateQuoteStatus`, `saveQuotePdf`/`shareQuotePdf`, `QuoteItemsTable`, `QuoteTotalsSummary`, el calendario inline y los diálogos de borrado.
También quedan las pantallas de **alta/edición** (`items/new`, `services/new`, `services/[id]`, `stores/new`, `stores/[id]`, `quotes/new`, `quotes/[id]/add-material`, `add-service`) que ya heredan el theme; opcionalmente aplicá el patrón de inputs/botones nuevos.

## Design tokens completos
(Ver `reference_implementation/src/theme/index.ts` — es la fuente única.)

## Bugs detectados (aprovechar el pase)
- Acentos faltantes en strings ("Descripcion", "Categoria", "version", "cancelado…").
- Trabajos cancelados se autoborran a los 3 días sin deshacer → considerar toast con undo.
- Fecha tipeada a mano (DD-MM-AAAA) en varios lugares → date picker nativo.

## Íconos y assets
Se usa `@expo/vector-icons` (MaterialCommunityIcons) que ya está en el repo — mismos nombres de ícono. Logos: `assets/nc-logo-*.png` y `assets/logo-icon-*.png` (ya en el repo). El prototipo HTML usa el webfont MDI vía CDN solo para la referencia.

## Definición de "hecho"
`npm run typecheck` sin errores · `npm run lint` sin errores nuevos · la app abre y se navega en emulador · cada pantalla coincide con el prototipo.
