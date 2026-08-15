---
name: nossa-clima-ui
description: Reglas de interfaz de la app Nossa Clima (Expo + react-native-paper). Usar SIEMPRE antes de crear o modificar cualquier pantalla, componente, estilo o texto visible. Cubre tokens del tema, modo oscuro, estados de selección, listas dentro de formularios, glosario de precios y textos en español rioplatense.
---

# Interfaz — Nossa Clima

App Expo + expo-router + react-native-paper. Tema propio en `src/theme/index.ts`,
con **modo claro y oscuro reales** (`src/features/theme/store.ts`). El usuario usa
los dos. Toda pantalla tiene que verse bien en ambos.

Fuente de diseño: `design_handoff_rediseno_ui/DESIGN_GUIDELINES.md` y el prototipo
navegable `design_handoff_rediseno_ui/prototipo/`. Esta skill agrega las reglas que
salieron del feedback real de usuarios y que ya se rompieron una vez.

---

## Regla 1 — Nunca un hex suelto

Todo color sale de `useAppTheme()`. Sin excepción, ni "es solo un borde".

```tsx
// mal — se rompe en oscuro
style={{ color: '#1A1A1A', borderColor: '#D9E3EE' }}

// bien
const theme = useAppTheme();
style={{ color: theme.colors.titleOnSoft, borderColor: theme.colors.borderSoft }}
```

Los `BRAND_*` exportados de `src/theme` (`BRAND_BLUE_SOFT`, `BRAND_GREEN_SOFT`, …)
son **constantes de marca, no tokens de tema**: son fijas y no cambian en oscuro.
Úsalos solo para el PDF y el logo. En pantallas, siempre los tokens:

| En vez de | Usar |
|---|---|
| `BRAND_BLUE_SOFT` `#E7EEF6` | `theme.colors.softBlue` |
| `BRAND_GREEN_SOFT` `#E7F6EC` | `theme.colors.softGreen` |
| `BRAND_BLUE` como texto | `theme.colors.primary` o `titleOnSoft` |
| `#5F6A76`, `#6b7280` | `theme.colors.textMuted` |
| `#D9E3EE`, `#DCE4EC`, `#D6DEE8` | `theme.colors.borderSoft` |

Antes de dar por cerrado un archivo: `grep -c "#[0-9A-Fa-f]\{6\}"`. Tiene que dar 0.
`src/features/quotes/components/QuoteItemsTable.tsx` es el modelo: 0 hex.

---

## Regla 2 — Elegir de una lista: usar `SelectionPanel` / `SelectionRow`

`src/components/SelectionPanel.tsx` ya resuelve las dos reglas de abajo. **Usalo en
vez de escribir la lista a mano.**

```tsx
<SelectionPanel
  data={filteredServices}          // la lista COMPLETA, sin cortar
  keyExtractor={(s) => s.id}
  emptyText="No hay servicios que coincidan con la busqueda."
  renderItem={(service) => (
    <SelectionRow
      title={service.name}
      meta={service.category ?? 'Sin categoria'}
      trailing={formatCurrencyArs(service.base_price)}
      selected={service.id === selectedId}
      tone="blue"                   // 'blue' servicios/tiendas · 'green' materiales
      onPress={() => select(service)}
    />
  )}
/>
```

Las dos reglas que encapsula, por si alguna vez hace falta hacerlo a mano:

**2a. Seleccionado se marca con borde, no solo con fondo.** Un fondo claro fijo sobre
interfaz oscura "brilla en blanco" y se pierde el texto — fue el reclamo textual de un
usuario. Borde 2px `accentStrong` + ícono de check, y el fondo suave (token, no hex)
como refuerzo. **El color nunca es la única señal.** El texto de la fila no lleva color
propio: `titleOnSoft` / `textMuted`, nunca un hex.

**2b. Nunca cortar la lista con `.slice(0, N)`.** El usuario no puede elegir lo que no
ve, y no tiene forma de saber que faltan. La altura la limita el panel
(`maxHeight`, 300 por defecto), no el filtro. El `nestedScrollEnabled` es obligatorio:
la pantalla ya está dentro del `ScrollView` de `AppScreen`.

---

## Regla 3 — Borrar del catálogo: `SelectionModeBar` y archivar

Para limpiar repetidos en una lista, `src/components/SelectionModeBar.tsx` +
`SelectionCheck`: pulsación larga entra en modo selección, tocar suma/saca, y la barra
ofrece "Archivar (N)" con confirmación.

Se **archiva**, no se borra: las FK son `on delete restrict` y los trabajos ya
emitidos guardan snapshot del nombre. Ver la skill `nossa-clima-feature`.

Referencias: `app/(tabs)/items/index.tsx` y `app/(tabs)/services/index.tsx`.

---

## Regla 4 — La acción principal, arriba y alcanzable

Si un control gobierna lo que se puede hacer en la pantalla, va arriba. No al final,
después de una tabla que puede tener veinte filas.

Caso real: el selector de estado del trabajo estaba al pie y era justo lo que
desbloqueaba la edición de la pantalla.

Alta de registros: `IconButton icon="plus" mode="contained"` con
`containerColor={accent}` / `iconColor={onAccent}`, en `AppScreen.titleRight`.

---

## Regla 5 — Glosario (decidido, no rediscutir)

| Término | Significa | Dónde |
|---|---|---|
| **Costo** | Lo que Nossa Clima paga por un material | Materiales: alta, precios, líneas de material |
| **Precio unitario** | Lo que se le cobra al cliente por unidad | Servicios |
| **Margen %** | Recargo sobre el costo del material | Materiales en un trabajo |
| **Trabajo** | La unidad de negocio (tabla `quotes`) | Toda la app. Nunca "presupuesto" ni "quote" |
| **Notas para el informe** | Resumen que **sí** sale en el PDF (`quotes.notes`) | Formulario del trabajo |
| **Notas para el técnico** | Privadas, **no** salen en el PDF (`technician_notes`) | Formulario del trabajo |
| **Datos de acceso** | Timbre, piso, quién recibe (`client_notes`, sale en el PDF) | Formulario del trabajo |
| **Técnico encargado** | Quién hace el trabajo (`technician_name`, sale en el PDF) | Formulario del trabajo |
| **Catálogo** | Materiales + Servicios + Tiendas | Tab bar, `CatalogSwitcher` |

Nunca "Precio inicial". Nunca "presupuesto" en texto visible.

---

## Regla 6 — Textos

- Español rioplatense, voseo: "Cambiá", "Agregá", "Seleccioná".
- **Con acentos.** Hay strings viejas sin acentuar; si tocás la línea, corregila.
- Cortos y accionables. Nada de subtítulos que repiten el título ni ayudas obvias.
- Errores: qué pasó y qué hacer. `toUserErrorMessage(err, 'No se pudo …')`.
- Nunca mostrar el logo y al lado el nombre de la marca: el logo ya lo tiene.

---

## Recetas rápidas

**Pantalla:** `<AppScreen title="…" titleRight={…} headerContent={…}>`. El scroll y
la tab bar los pone `AppScreen`; no anides otro `ScrollView` sin `nestedScrollEnabled`.

**Buscador:** fila `surfaceVariant`, radio 12, ícono `magnify` en `textMuted`,
`TextInput` nativo, `close-circle` cuando hay texto. Ver `app/(tabs)/items/index.tsx`.

**Tarjeta de lista:** `surface` + borde `borderSoft`, radio 16, padding 14-16.
Título 15/`FONT_SANS_EXTRABOLD` en `titleOnSoft`, metadatos en `textMuted`.

**Badge de estado:** `quoteStatusAccent()` / `quoteStatusLabel()` de
`src/features/quotes/status.ts`. Punto de color **y** texto.

**Inputs:** `mode="outlined"`, `outlineStyle={{ borderRadius: 12 }}`,
`activeOutlineColor={theme.colors.accent}`.

**Vacío:** ícono grande en `borderSoft` + una línea en `textMuted`.

**Importes:** `formatCurrencyArs` de `@/lib/format`, peso 700-800,
`fontVariant: ['tabular-nums']`.

**Confirmación destructiva:** `ConfirmDeleteDialog` o `AppDialog`. Nunca borrar sin
confirmar. Feedback con `useAppToast()`.

---

## Antes de dar por terminado

1. `npm run lint && npm run typecheck && npm test`
2. Abrir la pantalla en **claro y en oscuro**.
3. `grep -c "#[0-9A-Fa-f]\{6\}"` sobre los archivos tocados → 0.
4. Ningún `.slice(0, N)` nuevo sobre una lista que el usuario tiene que elegir.
5. Toque mínimo 44px.
6. Si agregaste una lista seleccionable, ¿usaste `SelectionPanel` / `SelectionRow`?
