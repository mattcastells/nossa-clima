---
name: nossa-clima-informe
description: Cómo se arma el informe técnico PDF de Nossa Clima. Usar antes de tocar src/features/quotes/exportPdf.ts o cualquier cosa que cambie qué datos salen impresos — campos del trabajo, estética del documento, logo, totales o el pie. Incluye la paleta del informe, qué campos van y cuáles nunca, y cómo probarlo.
---

# Informe técnico PDF — Nossa Clima

Un solo archivo: `src/features/quotes/exportPdf.ts`.
Dos salidas públicas: `shareQuotePdf(detail)` y `saveQuotePdf(detail)`.

Es el único artefacto de la app que **ve el cliente final**. Un error acá se imprime
y se manda por WhatsApp. Tratalo con más cuidado que una pantalla.

---

## Arquitectura: una sola plantilla

**Regla dura: el informe se escribe UNA vez, en HTML.**

```
buildQuotePdfHtml(detail)  →  string HTML
   ├── nativo: Print.printToFileAsync({ html })  → uri → Sharing / SAF
   └── web:    misma plantilla → diálogo de impresión del navegador
```

Hubo una etapa con dos implementaciones en paralelo (HTML para nativo + jsPDF para
web) y divergieron: el logo real solo salía en web y el pie se comportaba distinto.
**No volver a eso.** Si algo hace falta solo en una plataforma, resolvelo en el
plumbing de guardado, no duplicando el documento.

`jspdf` y `jspdf-autotable` no deben volver a `package.json`.

---

## Qué se imprime y qué no

| Campo de `quotes` | ¿Sale en el PDF? | Dónde |
|---|---|---|
| `title` | Sí | Banda del encabezado |
| `client_name`, `client_phone` | Sí | Bloque de cliente |
| `description` (domicilio) | Sí | Bloque de cliente |
| `technician_name` | Sí | Bloque de cliente |
| `client_notes` (timbre, quién recibe) | Sí | Bloque de cliente |
| `notes` | Sí | Sección **RESUMEN** |
| **`technician_notes`** | **NUNCA** | — |
| `subtotal_*`, `total` | Sí | Tarjeta de totales |

`technician_notes` es privado del técnico. Si tocás el bloque de datos del cliente,
verificá que no se coló. Vale un test que falle si el HTML lo contiene.

`description` guarda el **domicilio**, no una descripción. Es una columna vieja
reutilizada; está documentado en `src/features/quotes/schemas.ts`.

---

## Anatomía del documento

```
┌──────────────────────────────────────────────────┐
│ ██ BANDA NAVY #052653                            │
│   INFORME TÉCNICO            [ logo real PNG ]   │
│   <título del trabajo>                           │
│   15/08/2026                                     │
├──────────────────────────────────────────────────┤
│  Cliente    Juan Pérez                           │
│  Teléfono   11 1234 5678                         │
│  Domicilio  Av. Mitre 1200, 2º B                 │
│  Técnico    Matías G.                            │
│  Notas      Timbre 3B, recibe la encargada       │
│                                                  │
│  ██ RESUMEN ████████████  ← título con fondo     │
│   │ diagnóstico…                                 │
│   │ Solución: …                                  │
│                                                  │
│  ██ DETALLE DE COSTOS ███                        │
│   Materiales / Mano de obra                      │
│                                                  │
│  ┌ CONTACTO ─────┐        ┌ Subtotales ────────┐ │
│  │ 11 3001 9957  │        │ ██ TOTAL navy ████ │ │
│  └───────────────┘        └────────────────────┘ │
│  * garantía 3 meses…                             │
└──────────────────────────────────────────────────┘
```

Reglas de estética, todas pedidas por el usuario:

- **Títulos de sección con fondo** (navy, texto blanco). Sin fondo se pierden.
- **Datos del cliente resaltados e interlineados**, no apretados en dos tarjetas.
- **Contacto de Nossa Clima al margen izquierdo, a la altura de la tarjeta de
  totales.** No como banda al pie.
- **Contraste alto**: cuerpo en navy oscuro `#0F1B2D`; el gris `#64748B` solo para
  labels de campo.
- La banda navy del encabezado y la tarjeta navy del total **se conservan**.

---

## Paleta (constantes de marca, no tokens de tema)

El PDF es siempre claro: no sigue el modo oscuro de la app.

```
NAVY      #052653   banda, títulos con fondo, tarjeta del total
CYAN      #22C3E6   eyebrow sobre navy, barra del resumen
CYAN_DARK #0891B2   eyebrow de sección sobre blanco
INK       #0F1B2D   cuerpo de texto
MUTED     #64748B   labels de campo, garantía
CARD_BG   #F4F6F9 / CARD_BORDER #E4E9F0
GREEN     #15803D   grupo Materiales
AMBER     #8A5A00   grupo Mano de obra
```

Datos fijos de la empresa: `COMPANY_EMAIL`, `COMPANY_PHONE`, `WARRANTY_TEXT`.
No hardcodearlos en el markup; salen de esas constantes.

---

## Logo

Se usa el PNG real (`assets/nc-logo-dark.png`, blanco, va sobre la banda navy).
Se embebe como `data:` URI para que funcione igual en nativo y en web:
`Asset.fromModule` → `downloadAsync` → `FileSystem.readAsStringAsync(base64)`.

Hubo una versión que dibujaba el logotipo a mano con `<polygon>` + `<text>` en Arial.
Si el asset no carga, degradar a eso está bien como último recurso, pero **el camino
normal es el PNG**.

---

## Trampas conocidas

**Escapado.** Todo texto que venga del usuario pasa por `escapeHtml()`. Un nombre con
`&` o `<` rompe el documento. Sin excepciones.

**Redondeo.** Los importes se muestran sin centavos pero en la base son
`numeric(12,2)`. Si redondeás cada línea y mostrás el total de la base, la columna no
suma y el cliente lo nota. Redondeá una sola vez y derivá el total impreso de las
líneas impresas.

**Paginación.** Un resumen largo genera 2+ páginas. El pie tiene que quedar al final
de la última, no flotando en el medio, y **no puede pisar el contenido** de las
anteriores. Cómo está resuelto (feedback 2026-08, el pie tapaba el detalle de costos):

- El pie es `position: fixed; bottom: 0` → se repite en cada página.
- Un `fixed` no empuja el contenido, y el margen inferior de `@page` **no** sirve
  de reserva (el WebView ubica el fixed arriba del margen, no dentro). Por eso todo
  el documento va dentro de `<table class="page-frame">` cuyo `<tfoot>` es un
  espaciador `.footer-space` del alto del pie: el motor repite el tfoot al pie de
  cada hoja y el contenido nunca llega a la zona del fixed.
- `FOOTER_HEIGHT` es la única fuente del alto: la usan el pie y el espaciador.
- Los estilos de la tabla de costos van acotados a `.costs` para no alcanzar al
  marco. No escribas reglas sueltas sobre `table`, `thead`, `tbody` o `td`.
- `.section-title` lleva `break-after: avoid`, las filas `break-inside: avoid` y
  `.closing` `break-inside: avoid`: ni títulos huérfanos ni el cierre partido.

Probar siempre con un informe largo antes de cerrar. Con Chrome headless
(`--headless=new --print-to-pdf=... --no-pdf-header-footer`) se ve lo mismo que
en el WebView de Android.

**Sin numeración.** El encabezado muestra solo la fecha. Hubo un "N° 0421" derivado
del id del trabajo: parecía un contador de informes emitidos y no lo era. No
volver a inventar un número; si algún día hay numeración real, va en la base.

**Unidad de los materiales.** La columna CANT. imprime `cantidad + unidad` solo si
la línea tiene unidad. La unidad sale de la medida (`item_measurements.unit`, ahí
sí "mt" para caños) o del ítem (`items.unit`, campo **Unidad** opcional del
formulario de material: "mt", "kg", "un"); si ninguno la define, queda `null` y se
imprime el número solo. **Nunca asumir `'mt'`** como default en ningún lado: un
capacitor no se mide en metros (feedback 2026-08; el alta guardaba `'mt'` fijo y
el usuario terminó creando medidas llamadas "Unidad" para zafar).

**Sin datos.** El informe tiene que salir bien sin resumen, sin materiales, sin
servicios y sin teléfono. Cada bloque va condicionado.

**`splitWorkSections`.** El resumen se parte en subsecciones cuando el técnico
escribe `Solución:` u `Observaciones:` en el texto
(`src/features/quotes/workSections.ts`, con tests). Si cambiás los marcadores,
actualizá el test y el placeholder del formulario.

---

## Cómo probarlo

`src/features/quotes/__tests__/exportPdf.test.ts` cubre lo que se puede automatizar
sobre la plantilla: que `technician_notes` **nunca** aparezca, que el total impreso
sea la suma de las líneas impresas, el escapado, los campos vacíos y el logo. Si
tocás la plantilla, corré esos tests primero — la plantilla se exporta como
`__buildQuotePdfHtmlForTests`.

Lo visual sigue siendo manual y obligatorio:

1. Un trabajo completo: resumen con subsecciones, materiales con medidas, servicios,
   margen global aplicado.
2. Un trabajo mínimo: solo cliente y título.
3. Un resumen largo (2+ páginas) → mirar el pie.
4. Nombre de cliente con `&` y con tilde.
5. **Confirmar que `technician_notes` no aparece.**
6. Generar desde Android **y** desde web: tienen que salir iguales.

`npm test` cubre `workSections` y `materialPricing`, que alimentan el informe.
Corrélo siempre.
