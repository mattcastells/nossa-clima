# Auditoría y plan de trabajo — feedback de usuarios (2026-08)

> **Estado: implementado el 2026-08-15.** Las cinco fases están hechas. La auditoría
> de la parte 2 se conserva como registro de por qué se hizo cada cosa; las líneas
> citadas son las de **antes** del cambio.
>
> **Falta un paso manual:** correr en Supabase
> `supabase/migrations/202608150001_quote_notes_split_and_technician.sql`.
> Hasta que se corra, la app funciona igual: los tres campos nuevos se guardan
> como vacíos y el informe los omite (ver el fallback de `upsertQuote`).

Fuente: feedback de uso real + dos capturas con anotaciones sobre el informe PDF
y sobre la pantalla de alta de trabajo.

Cada hallazgo tiene id (`A1`, `B2`, …), archivo y línea. El plan de la parte 3
referencia esos ids.

Decisiones ya tomadas con el usuario:

| Tema | Decisión |
|---|---|
| Clientes | Autocompletado **derivado de los trabajos existentes**. Sin tabla `clients` por ahora. |
| PDF | **Unificar en una sola plantilla HTML**. Se elimina la implementación jsPDF. |
| Notas del técnico | Visibles en el **detalle del trabajo**, en la **tarjeta de la agenda** y en la **notificación del turno**. |

---

## 1. Resumen ejecutivo

Ocho frentes. Ninguno es un bug de datos: el feedback es de interfaz y de informe,
que es exactamente lo que reporta el usuario ("no le encuentro ningún error").

| # | Frente | Severidad | Riesgo del cambio | Migración |
|---|---|---|---|---|
| A | Informe PDF: estética, campos y arquitectura duplicada | Alta | Medio | — |
| B | Separar "resumen para el informe" de "notas para el técnico" | Alta | Bajo | Sí |
| C | Autocompletado de clientes | Media | Bajo | No |
| D | Selector de estado arriba en el detalle del trabajo | Media | Bajo | No |
| E | Seleccionar y borrar materiales/servicios repetidos | Media | Medio | No |
| F | Scroll en materiales/tiendas/servicios al crear un trabajo | Alta | Bajo | No |
| G | Contraste del elemento seleccionado (modo oscuro) | Alta | Bajo | No |
| H | "Precio inicial" → "Costo" y glosario de precios | Baja | Nulo | No |

Dos hallazgos **no reportados** que conviene arreglar de paso, porque salieron
al auditar el código de lo que sí se reportó: `A9` (los importes del informe se
muestran sin centavos y el detalle puede no sumar el total impreso) y `A10`
(el N° de informe puede repetirse entre trabajos distintos).

---

## 2. Auditoría

### A. Informe PDF — `src/features/quotes/exportPdf.ts`

**A1 · El informe está escrito dos veces.**
`buildQuotePdfHtml()` (líneas 198-364) genera el HTML que usa el celular vía
`expo-print`. `exportQuotePdfWeb()` (435-712) redibuja el mismo informe a mano con
jsPDF para la web. Son ~500 líneas que hay que mantener en paralelo: cualquier
cambio de diseño hay que hacerlo dos veces y ya divergieron (ver `A8`).
→ **Decidido:** una sola plantilla HTML. En nativo sigue `expo-print`; en web se
imprime el mismo HTML con el diálogo del navegador. Se eliminan `jspdf` y
`jspdf-autotable` de `package.json`.

**A2 · En el celular el logo nunca se usa.**
`buildLogoOnNavySvg()` (155-162) dibuja el logotipo a mano con `<polygon>`,
`<line>` y `<text>` en Arial. El asset real `nc-logo-dark.png`, importado en la
línea 27, **solo se usa en la rama web** (`resolveBrandLogoUri` →
`loadWebLogoImage`, 368-397). O sea: el PDF que genera el técnico desde el
teléfono lleva un logo dibujado, no el logo de la marca.
→ Es el "hay que poner el logo" de la captura. Se resuelve embebiendo el PNG como
`data:` URI en el HTML (`expo-asset` + `FileSystem.readAsStringAsync` en base64),
que además funciona igual en web.

**A3 · El bloque de datos del cliente está incompleto.**
Hoy son dos tarjetas: CLIENTE (nombre + teléfono) y DOMICILIO (líneas 311-321).
El feedback pide cinco datos, resaltados e interlineados como en el informe viejo:
nombre, teléfono, domicilio, **técnico encargado** y **notas del cliente**
(detalles de acceso: timbre, quién recibe si no está).
Los dos últimos **no existen en la base**. Ver `B3`.

**A4 · "TRABAJO REALIZADO" debe llamarse "RESUMEN".**
Hardcodeado en dos lugares: línea 324 (HTML) y 546 (jsPDF). Con `A1` queda uno solo.

**A5 · Los títulos de sección perdieron el fondo.**
Hoy `.eyebrow-section` (247) es texto cian sin fondo. El informe anterior usaba
`th { background: #052653; color: #fff }` — por eso el usuario dice que "el hecho
de que tengan un fondo los distinguía más". Referencia exacta:
`git show c31c701:src/features/quotes/exportPdf.ts`.

**A6 · El bloque de contacto está al pie, no al margen del total.**
Hoy el pie es una banda gris con garantía a la izquierda y contacto a la derecha
(354-361). El informe anterior ponía el contacto de Nossa Clima **a la izquierda,
a la misma altura que la tarjeta de totales** (`.totals-wrap` con `.contact-card`).
Eso es lo que pide el feedback.

**A7 · Contraste bajo.**
El cuerpo del resumen usa `BODY_HEX #334155` a 12.5px y los metadatos
`MUTED_HEX #64748B` sobre blanco. El usuario lo describe como "medio apagado" y
sugiere navy. Se sube el cuerpo a navy oscuro (`INK_HEX #0F1B2D`) y se reserva el
gris solo para labels de campo.

**A8 · Basura en el CSS.**
Línea 286: `background: ${TABLE_HEAD_RGB ? '#EAEFF5' : '#EAEFF5'}` — ternario sobre
un array (siempre truthy) con las dos ramas iguales. Se limpia.

**A9 · Los importes se imprimen sin centavos y pueden no sumar.** *(no reportado)*
`formatMoney` (106-111) usa `maximumFractionDigits: 0`, pero los subtotales y el
total vienen con 2 decimales de Postgres (`numeric(12,2)`). Un informe con
`44.000,40 + 10.000,40` imprime `$ 44.000` + `$ 10.000` y total `$ 54.001`: el
cliente suma la columna y no le cierra. Hay que redondear una sola vez y de forma
consistente (redondear cada línea y recalcular el total impreso a partir de las
líneas redondeadas), o mostrar centavos.

**A10 · El N° de informe puede repetirse.** *(no reportado)*
`getReportNumber` (114-119) toma los primeros 8 hex del uuid y hace `% 10000`.
Con 10.000 valores posibles la probabilidad de colisión pasa el 50% cerca de los
120 informes. Si el número va a usarse como referencia con clientes, conviene una
secuencia real (columna `report_number` con `identity`/secuencia por usuario).
No bloquea este ciclo; queda anotado.

**A11 · El pie en informes de más de una página.**
El HTML usa `body { display:flex; min-height:100vh }` con `.content { flex:1 }`.
En medio paginado (`expo-print`) ese layout no garantiza que el pie caiga al final
de la última página. Al unificar hay que resolverlo con `position: fixed; bottom:0`
+ `@page margin` (que sí funciona en paginado) y validarlo con un informe largo.

---

### B. Notas duales — `quotes.notes`

**B1 · Hoy `notes` cumple tres roles a la vez.**
Se imprime en el informe (`exportPdf.ts:203`), se copia a `appointments.notes` al
programar el trabajo (`app/(tabs)/quotes/[id]/index.tsx:287` y `:424`) y desde ahí
se muestra como "Descripcion" en la agenda
(`src/features/appointments/calendarShared.ts:30-37`). El label en la UI es
"Trabajo realizado / notas" (`src/features/quotes/QuoteForm.tsx:129`).

**B2 · Renombrar el campo actual.**
`notes` pasa a llamarse en la UI **"Notas para el informe"**. Es lo que pide el
feedback ("así no hay confusión"). El nombre de columna no cambia: renombrar en
base obligaría a tocar el asistente, los seeds y la Edge Function sin ganancia.

**B3 · Tres campos nuevos en `quotes`.**

| Columna | Va al PDF | Para qué |
|---|---|---|
| `technician_notes` | **No** | Notas privadas del técnico. Se leen al abrir el trabajo. |
| `client_notes` | Sí (bloque de cliente) | Detalles de acceso: timbre, quién recibe. |
| `technician_name` | Sí (bloque de cliente) | Técnico encargado. Se autocompleta con `profile_directory.full_name` del dueño del trabajo, editable. |

> **Supuesto a confirmar antes de implementar:** el feedback de la captura pide
> "notas" en el bloque del cliente del PDF ("timbre, persona que recibe"), y el
> feedback de texto pide notas del técnico que **no** salgan en el PDF. Se leen como
> dos cosas distintas, por eso son dos columnas. Si en realidad es una sola,
> se cae `client_notes` y `technician_notes` pasa a imprimirse.

**B4 · Qué se copia a la agenda y a la notificación.**
Decidido: la agenda y el push muestran `technician_notes`.
- `calendarShared.ts:30-37` (`getAppointmentDescription`) pasa a priorizar las notas
  del técnico sobre `quote.notes`.
- Los dos `scheduleQuote.mutateAsync({ notes: … })` del detalle
  (`[id]/index.tsx:287`, `:424`) pasan `technician_notes`.
- `src/services/notifications.ts:127` arma el body fijo
  `"Hoy a las X tenes un turno agendado."`; hay que pasar las notas por
  `scheduleAppointmentReminder` (`useNotificationSync.ts:33-40`) y sumarlas al body.

**B5 · El asistente IA también escribe `notes`.**
`src/features/assistant/execution.ts:243` y `:300`, y el prompt de
`supabase/functions/assistant-chat/index.ts:291`. Al cambiar el significado del
campo en la UI hay que actualizar el prompt para que sepa que `notes` es el resumen
del informe y que existen `technician_notes` / `client_notes`.

**B6 · Colisión de nombres con `splitWorkSections`.**
`src/features/quotes/workSections.ts` ya parsea un subtítulo `"Notas:"` **dentro**
del texto del resumen. Con el campo nuevo llamado "notas del técnico" conviene
renombrar ese subtítulo del informe a "Observaciones" o dejar claro en el
placeholder qué es cada cosa.

---

### C. Autocompletado de clientes

**C1 · No hay entidad cliente.**
Cada trabajo repite `client_name`, `client_phone` y `description` (domicilio) como
texto libre (`supabase/migrations/202603100002_quotes_services.sql:23-26`). El mismo
cliente termina escrito de tres formas distintas y no hay dónde corregirlo.

**C2 · Solución acordada: directorio derivado.**
Hook nuevo `useClientDirectory()` sobre una query liviana
(`select('client_name, client_phone, description, created_at')` de `quotes`,
`order('created_at', { ascending: false })`), agrupando por nombre normalizado
(trim + minúsculas + colapsar espacios) y quedándose con el registro más reciente
de cada uno. Se ofrece como sugerencias debajo del input "Cliente" en `QuoteForm`;
al tocar una sugerencia se completan teléfono y domicilio.

**C3 · Firma estable.**
El hook devuelve `{ id, name, phone, address }`. Si en el futuro se migra a una
tabla `clients` real, cambia la implementación del hook y **no la UI**.

**C4 · Detalle de implementación.**
`QuoteForm` es un `react-hook-form` controlado; las sugerencias tienen que
escribir con `setValue(..., { shouldDirty: true })` para que el submit del detalle
(`quoteFormRef.current.submit()`, `[id]/index.tsx:219`) las tome.

---

### D. Estado del trabajo arriba — `app/(tabs)/quotes/[id]/index.tsx`

**D1 · El selector está al fondo de la pantalla.**
Pendiente/Terminado/Cancelado vive en las líneas 749-791, después de los acordeones
de Cliente y Fecha, de la tabla de conceptos y de los totales.

**D2 · Y es la acción que desbloquea la pantalla.**
`isCompleted` bloquea la edición del cliente (389-395) y de la fecha (459-465), con
el cartel "Cambiá el estado a Pendiente para editar". O sea: el control que
desbloquea la pantalla está al final de la pantalla, después de una tabla que puede
tener veinte líneas. Es el peor lugar posible.

**D3 · Arriba no se ve el estado actual.**
No hay badge de estado en el encabezado. El badge (`quoteStatusAccent` /
`quoteStatusLabel`, `src/features/quotes/status.ts`) solo aparece dentro de las
tarjetas del calendario inline (624-638).

→ Se agrega la misma fila de opciones arriba de todo, reusando `STATUS_OPTIONS`
(48-52) y `changeQuoteStatus` (235-250). El bloque de abajo se mantiene, como pidió
el usuario.

---

### E. Borrar materiales y servicios repetidos

**E1 · Los materiales no se pueden borrar. En absoluto.**
No existe ni `deleteItem` ni `archiveItem` en `src/services/items.ts`, ni UI en
`app/(tabs)/items/[id].tsx`. La columna `archived_at` **ya existe**
(`supabase/migrations/202603160001_catalog_archive_and_quote_snapshots.sql`) y
`listItems` ya filtra archivados (`src/services/items.ts:15`): falta la mitad de
arriba.

**E2 · Los servicios sí, pero de a uno y escondido.**
`deleteService` archiva (`src/services/services.ts:57-70`) y la UI está en el
detalle (`app/(tabs)/services/[id].tsx:60-90`). Para limpiar duplicados hay que
entrar y salir de cada servicio.

**E3 · Borrado duro no es opción.**
`quote_material_items.item_id` es `references public.items(id) on delete restrict`
(`202603100002_quotes_services.sql:40`). Archivar es lo correcto: los informes
viejos siguen intactos y además guardan `item_name_snapshot`, así que no se rompe
ningún PDF ya emitido.

**E4 · Falta un modo selección en las listas.**
`app/(tabs)/items/index.tsx` y `app/(tabs)/services/index.tsx` son `FlatList` de
`Pressable` que navegan al detalle. Hay que sumar `onLongPress` → modo selección,
checkbox por fila, barra de acción con "Archivar (N)" y confirmación.

**E5 · Ayudar a encontrar los duplicados.**
El usuario dice "hay algunos que están repetidos". Agrupar por nombre normalizado y
marcar los grupos con más de un elemento hace la limpieza mucho más rápida que
buscarlos a ojo. Alcance opcional, alto valor.

---

### F. Scroll en materiales, tiendas y servicios al crear un trabajo

**F1 · Causa raíz: las listas están cortadas en 8.**
No es que no se pueda scrollear — **los resultados del 9 en adelante no existen**:

- `src/features/quotes/newQuote/useServiceDraft.ts:38` → `.slice(0, 8)`
- `src/features/quotes/newQuote/useMaterialDraft.ts:98` (tiendas) → `.slice(0, 8)`
- `src/features/quotes/newQuote/useMaterialDraft.ts:113` (materiales) → `.slice(0, 8)`

Sin escribir nada en el buscador, de todo el catálogo se ven 8.

**F2 · Y no hay panel con altura acotada.**
Las listas se renderizan con `.map()` dentro de un `View`, dentro del `ScrollView`
de la pantalla (`ServicesDraftSection.tsx:105-128`,
`MaterialsDraftSection.tsx:134-231`). Si se saca el `slice` sin más, la pantalla se
vuelve kilométrica.

**F3 · El patrón correcto ya está escrito en el repo.**
Es exactamente la pantalla que el usuario nombra como referencia
("+servicio en un trabajo creado"): `app/(tabs)/quotes/[id]/add-service.tsx:136-188`
— panel con `maxHeight: 300` (styles línea 330) y `FlatList` con
`nestedScrollEnabled`. También lo usa `QuoteItemsTable.tsx:454` con `maxHeight: 160`.

**F4 · `add-material` tiene el mismo problema, distinto síntoma.**
`app/(tabs)/quotes/[id]/add-material.tsx` no corta las listas, pero pagina las
tiendas (`paginatedStores`, línea 410) y renderiza los materiales con `.map()`
plano (491) sin panel. Por consistencia entra en el mismo cambio.

---

### G. Contraste del elemento seleccionado

**G1 · El diagnóstico: el usuario está en modo oscuro.**
`src/features/theme/store.ts` permite tema oscuro explícito. En oscuro:

- `serviceResultRowSelected` pinta `BRAND_BLUE_SOFT` `#E7EEF6`
  (`ServicesDraftSection.tsx:227-230`) — un casi-blanco fijo sobre una interfaz
  oscura. Es literal "el recuadro brilla en blanco".
- `materialResultRowSelected` igual con `BRAND_GREEN_SOFT` `#E7F6EC`
  (`MaterialsDraftSection.tsx:396-399`).
- `storeGridCellName` tiene `color: '#1A1A1A'` fijo
  (`MaterialsDraftSection.tsx:365-370`): texto casi negro sobre fondo oscuro.
  Es "no se ven los nombres de las tiendas".
- `resultMeta: '#5F6A76'` (409-413) — gris oscuro sobre fondo oscuro.

**G2 · Hay hex fijos por todos lados en este flujo.**
Contradice la regla del propio repo (`design_handoff_rediseno_ui/DESIGN_GUIDELINES.md`,
"No hardcodear colores"):

| Archivo | Hex fijos |
|---|---|
| `app/(tabs)/quotes/[id]/index.tsx` | 18 |
| `app/(tabs)/quotes/[id]/add-material.tsx` | 14 |
| `app/(tabs)/quotes/[id]/add-service.tsx` | 12 |
| `src/features/quotes/newQuote/MaterialsDraftSection.tsx` | 7 |
| `src/features/quotes/newQuote/ServicesDraftSection.tsx` | 3 |

(`QuoteItemsTable.tsx` tiene 0 — ese sí está bien hecho y sirve de modelo.)

**G3 · Los tokens correctos ya existen.**
`theme.colors.softBlue` es `#E2F4FB` en claro y `#173044` en oscuro;
`softGreen` es `#E7F6EC` / `#183527`. Reemplazar los `BRAND_*_SOFT` importados por
los tokens del tema arregla el problema sin cambiar nada en modo claro.

**G4 · Además hace falta un indicador de selección que no dependa solo del fondo.**
Regla a fijar: **borde `accentStrong` de 2px + ícono de check**, y el fondo suave
como refuerzo, nunca como única señal. Es la receta que ya usa
`add-service.tsx:350-353` (la pantalla que el usuario dice que "se ve perfecto").

---

### H. "Precio inicial" → "Costo"

**H1 · Dónde dice "precio inicial".** Todo en `app/(tabs)/items/new.tsx`:
línea 250 (título de la tarjeta), 269 (label del input), 83 / 88 / 93 (mensajes de
validación) y 118 (la nota que queda guardada en el historial de precios,
`'Precio inicial del material'`).

**H2 · Glosario inconsistente en el resto de la app.**
Ya dicen "Costo": `MaterialsDraftSection.tsx:277`, `add-material.tsx:614` y `:668`,
`QuoteItemsTable.tsx:174` y `:396`.
Siguen diciendo "Precio unitario": `QuoteItemsTable.tsx:328`,
`ServicesDraftSection.tsx:143`, `add-service.tsx:244`,
`QuoteServiceItemForm.tsx:36`.

**H3 · Criterio propuesto.**
"Costo" = lo que Nossa Clima paga por un material. "Precio unitario" = lo que se le
cobra al cliente por unidad de un servicio. Con ese criterio, los de servicios
quedan como están y solo se corrige `items/new.tsx`. Queda escrito en la skill de
UI para no volver a discutirlo.

---

## 3. Plan de trabajo

Cinco fases. El orden importa: la Fase 2 (campos nuevos) tiene que estar antes de la
Fase 3 (informe), porque el informe los imprime.

### Fase 0 — Base *(sin cambios de producto)*

| # | Tarea | Entregable |
|---|---|---|
| 0.1 | Skills del proyecto | `.claude/skills/nossa-clima-ui`, `-informe`, `-feature` |
| 0.2 | Glosario de precios (`H3`) | Sección en la skill de UI |
| 0.3 | Este documento | `docs/PLAN_FEEDBACK_USUARIOS.md` |

---

### Fase 1 — Interfaz: lo que se siente enseguida *(sin migración, riesgo bajo)*

| # | Tarea | Hallazgos | Archivos | Tamaño |
|---|---|---|---|---|
| 1.1 | Sacar los `slice(0, 8)` y meter las tres listas en paneles con `maxHeight` + `FlatList nestedScrollEnabled` | `F1` `F2` `F3` | `useServiceDraft.ts`, `useMaterialDraft.ts`, `ServicesDraftSection.tsx`, `MaterialsDraftSection.tsx` | M |
| 1.2 | Mismo patrón en `add-material` (tiendas y materiales) | `F4` | `add-material.tsx` | S |
| 1.3 | Estado seleccionado legible en ambos temas: tokens del tema + borde `accentStrong` 2px + check | `G1` `G3` `G4` | idem 1.1 + `add-material.tsx` | M |
| 1.4 | Barrer los hex fijos de los 5 archivos del flujo de trabajos | `G2` | ver tabla `G2` | M |
| 1.5 | Selector de estado arriba del detalle (se mantiene el de abajo) | `D1` `D2` `D3` | `quotes/[id]/index.tsx` | S |
| 1.6 | "Precio inicial" → "Costo" | `H1` | `items/new.tsx` | XS |

**Verificación:** `npm run lint && npm run typecheck && npm test`, y a mano con la
app en claro **y en oscuro**: crear un trabajo con el catálogo completo cargado,
scrollear las tres listas, seleccionar en cada una, abrir un trabajo terminado y
pasarlo a pendiente desde arriba.

---

### Fase 2 — Datos: notas duales, técnico y notas del cliente

| # | Tarea | Hallazgos | Archivos | Tamaño |
|---|---|---|---|---|
| 2.1 | Migración `202608150001_quote_notes_split_and_technician.sql`: agrega `technician_notes`, `client_notes`, `technician_name` a `quotes` | `B3` | `supabase/migrations/` | S |
| 2.2 | Tipos + servicio con fallback de compatibilidad (`isMissingSupabaseColumnError`) para que la app siga andando si la migración no se aplicó | `B3` | `types/db.ts`, `services/quotes.ts` | S |
| 2.3 | Esquema zod + campos en el formulario, con los labels nuevos | `B2` `B3` | `features/quotes/schemas.ts`, `QuoteForm.tsx` | M |
| 2.4 | Agenda: `getAppointmentDescription` prioriza notas del técnico; los dos `scheduleQuote` pasan `technician_notes` | `B4` | `calendarShared.ts`, `quotes/[id]/index.tsx` | S |
| 2.5 | Notificación del turno incluye las notas del técnico | `B4` | `services/notifications.ts`, `useNotificationSync.ts` | S |
| 2.6 | Actualizar el asistente: acciones y prompt de la Edge Function | `B5` | `assistant/actions.ts`, `execution.ts`, `assistant-chat/index.ts` | M |
| 2.7 | Renombrar el subtítulo `"Notas:"` del resumen para que no choque | `B6` | `workSections.ts` + test | XS |

**Labels definitivos en el formulario:**
- `notes` → **"Notas para el informe"** · placeholder: *"Qué se detectó, qué se hizo y recomendaciones. Sale en el PDF."*
- `technician_notes` → **"Notas para el técnico"** · placeholder: *"Solo para vos. No sale en el PDF."*
- `client_notes` → **"Datos de acceso"** · placeholder: *"Timbre, piso, quién recibe si no está."*
- `technician_name` → **"Técnico encargado"** · precargado con el nombre del perfil.

**Verificación:** aplicar la migración en Supabase; crear un trabajo con los cuatro
campos; confirmar que el PDF imprime tres de ellos y **nunca** las notas del técnico;
programar el trabajo y ver la nota en la agenda y en el push.

---

### Fase 3 — Informe PDF

| # | Tarea | Hallazgos | Tamaño |
|---|---|---|---|
| 3.1 | Unificar: una sola `buildQuotePdfHtml()`. Nativo `expo-print`, web `window.print()`. Borrar `exportQuotePdfWeb` y las ~280 líneas de jsPDF | `A1` | L |
| 3.2 | Sacar `jspdf` y `jspdf-autotable` de `package.json` | `A1` | XS |
| 3.3 | Logo real embebido como `data:` URI, en nativo y en web | `A2` | M |
| 3.4 | Bloque de cliente con los 5 datos, resaltados e interlineados | `A3` + Fase 2 | M |
| 3.5 | "TRABAJO REALIZADO" → "RESUMEN" | `A4` | XS |
| 3.6 | Títulos de sección con fondo navy y texto blanco | `A5` | S |
| 3.7 | Contacto de Nossa Clima al margen izquierdo, a la altura de la tarjeta de totales | `A6` | M |
| 3.8 | Subir el contraste del cuerpo a navy; gris solo para labels | `A7` | S |
| 3.9 | Limpiar el ternario muerto del CSS | `A8` | XS |
| 3.10 | Redondeo consistente de importes | `A9` | S |
| 3.11 | Pie al final de la última página en informes largos | `A11` | M |
| 3.12 | *(opcional)* N° de informe con secuencia real | `A10` | M |

**Lo que se conserva del diseño actual** (el usuario lo pidió explícitamente): la
banda navy del encabezado con el eyebrow "INFORME TÉCNICO", el título del trabajo y
el `N° · fecha`, y la tarjeta navy del total.

**Verificación:** generar el informe desde Android y desde web con el mismo trabajo y
comparar contra la captura del feedback. Probar con un resumen largo (2+ páginas),
sin resumen, sin materiales y sin servicios.

---

### Fase 4 — Limpieza del catálogo

| # | Tarea | Hallazgos | Tamaño |
|---|---|---|---|
| 4.1 | `archiveItem` / `archiveItems` en el servicio + hook | `E1` `E3` | S |
| 4.2 | Modo selección en la lista de materiales: long-press, checkbox, barra "Archivar (N)", confirmación | `E4` | M |
| 4.3 | Mismo modo selección en la lista de servicios, sobre `deleteService` que ya existe | `E2` `E4` | S |
| 4.4 | Botón de archivar en el detalle del material (paridad con servicios) | `E1` | S |
| 4.5 | *(opcional)* Marcar grupos de nombre repetido | `E5` | M |

**Verificación:** archivar un material que ya está usado en un trabajo viejo y
confirmar que **el trabajo y su PDF siguen intactos** (`item_name_snapshot`), y que
el material deja de aparecer al cargar uno nuevo.

---

### Fase 5 — Clientes

| # | Tarea | Hallazgos | Tamaño |
|---|---|---|---|
| 5.1 | `listClientDirectory` en `services/quotes.ts` + `useClientDirectory` | `C2` | S |
| 5.2 | Sugerencias bajo el input "Cliente"; al tocar, completa teléfono y domicilio | `C2` `C4` | M |
| 5.3 | Tests de la normalización y el agrupado | `C2` | S |

**Verificación:** cargar dos trabajos del mismo cliente escrito distinto y confirmar
que el directorio los agrupa; verificar que al elegir una sugerencia el formulario
queda "sucio" y el guardado del detalle la persiste.

---

## 4. Riesgos y cosas a tener a la vista

| Riesgo | Mitigación |
|---|---|
| La migración de la Fase 2 no se aplica en Supabase y la app rompe | Fallback con `isMissingSupabaseColumnError`, como ya hace `upsertQuote` con `cancelled_at` |
| Sacar jsPDF cambia la descarga en web (pasa por el diálogo de impresión) | Acordado con el usuario. Nativo, que es el uso real, no cambia |
| Archivar materiales rompe informes viejos | No: `on delete restrict` + `item_name_snapshot`. Verificar en 4.5 igual |
| Tocar `quotes/[id]/index.tsx` (1196 líneas, la pantalla más crítica) | Fase 1 solo agrega la fila de estado y cambia colores. Nada de hooks |
| El supuesto de `B3` sobre las dos clases de notas está mal | Confirmar antes de escribir la migración. Es una columna de diferencia |

## 5. Lo que este plan **no** incluye

- Tabla `clients` con ABM propio (descartado por ahora, ver decisión).
- Numeración real de informes (`A10`) — anotado, fuera de alcance.
- Date picker nativo, acentos faltantes y undo de cancelados: ya estaban listados
  como pendientes en `docs/REDISENO_UI.md` §5 y no salieron en este feedback.
